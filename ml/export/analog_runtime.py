from __future__ import annotations

import math

import numpy as np
from scipy import ndimage
from scipy.optimize import linear_sum_assignment
from scipy.special import expit

#  grid and constants

SCALES = {   # the same feature code runs at both scales; everything below is in pixels
    "site": dict(res=31.25, flat_deg=1.0, sun_low=1.5, sun_mid=10.0),
    "regional": dict(res=250.0, flat_deg=0.25, sun_low=1.0, sun_mid=4.0),
}
BLOCK_PX = 128                      # the block: 4 km (site) or 32 km (regional)
PAD_PX = 64                         # margin on every side, for shadows cast from outside the block
WINDOW_PX = BLOCK_PX + 2 * PAD_PX   # 256 px padded window
CELL_PX = 16                        # 8 x 8 = 64 cells (tokens) per block
LOWPASS_PX = 1.0                    # the same Gaussian blur on every world: one effective resolution
ROUGH_FINE_PX, ROUGH_COARSE_PX, TPI_PX = 3, 11, 39      # filter window widths
TPI_NEAR_PX, TPI_FAR_PX = 17, 97                         # v2.0 spatial context windows (the 64 px padding covers both)
RING_PX, N_RINGS = 6, 10                                 # radial profile: 10 rings of 6 px around each candidate centre
LF_SHORT, LF_K = 15, 5                                   # landform scores: shortlist and top-k (v2.1: 30 -> 15, faster clicks)
SHADOW_PX, SVF_PX = 64, 32          # horizon search distances
RADIUS_M = {"earth": 6_371_000.0, "moon": 1_737_400.0, "mars": 3_396_190.0}
WORLDS = ("moon", "mars")

# v1.1: 13 -> 7 token features. dropped the ones that mostly measure DEM noise (rough_fine, curv) and the
# near-duplicates (slope_p90, cell_relief, svf ~ slope_mean; geo_flat = 1 - convex - concave). see ml/diag.ipynb
TOKEN_FEATURES = (
    "slope_mean", "rough_coarse", "geo_convex", "geo_concave",
    "shadow_low", "shadow_mid", "norm_height",
    "tpi_near", "tpi_far",          # v2.0: height against the surroundings ~0.5 and ~1.5 km out, over the block's relief
)
SPEC_BANDS = ((64, 128), (32, 64), (16, 32), (8, 16), (4, 8), (2, 4))   # wavelength bands in pixels for the power spectrum
BLOCK_FEATURES = ("relief", "hurst", "linearity", "depression_area", "depression_depth",
                  *(f"spec{k + 1}" for k in range(len(SPEC_BANDS))),   # v2.0: share of relief in each wavelength band
                  "bowl", "bowl_r", "cone", "cone_r")                  # v2.0: best radially symmetric bowl / cone, and its radius
INPUT_NAMES = TOKEN_FEATURES + tuple("d_" + b for b in BLOCK_FEATURES)
N_TOK, N_IN = len(TOKEN_FEATURES), len(TOKEN_FEATURES) + len(BLOCK_FEATURES)
ENV_NAMES = ("tree", "crop", "built", "water", "snow", "bare", "sparse", "precip", "aridity")   # what the readers return for a click
GATE_NAMES = ("tree", "crop", "built", "water", "open", "sparse", "precip", "aridity")  # what the conditions model sees (v2.1: + aridity)
GRID = np.linspace(0.0, 1.0, 1001)
QUANTILES = (np.arange(8) + 0.5) / 8

# 8 azimuths as (row step, col step). Row 0 is north. Closed under 90 degree rotation and mirroring.
DIRS = ((0, 1), (-1, 1), (-1, 0), (-1, -1), (0, -1), (1, -1), (1, 0), (1, 1))


#  terrain features (no training)

def fill_nans(z: np.ndarray) -> np.ndarray:
    bad = np.isnan(z)
    if not bad.any():
        return z
    if bad.all():
        raise ValueError("window has no valid pixels")
    idx = ndimage.distance_transform_edt(bad, return_distances=False, return_indices=True)
    return z[tuple(idx)]


def detrend(z: np.ndarray) -> np.ndarray:
    # Remove the best-fit plane, so a regional tilt doesn't count as texture.
    n = z.shape[0]
    yy, xx = np.mgrid[0:n, 0:n] - (n - 1) / 2.0
    A = np.c_[xx.ravel(), yy.ravel(), np.ones(n * n)]
    return z - (A @ np.linalg.lstsq(A, z.ravel(), rcond=None)[0]).reshape(n, n)


def stripe_score(z_block: np.ndarray, n_bins: int = 18) -> float:
    n = z_block.shape[0]
    w = np.hanning(n)
    P = np.abs(np.fft.fftshift(np.fft.fft2(detrend(z_block) * w[:, None] * w[None, :]))) ** 2
    ky, kx = np.mgrid[0:n, 0:n] - n // 2
    k = np.hypot(kx, ky)
    m = (k >= n / 8) & (k < n / 2)                      # wavelengths of 2 to 8 pixels
    b = np.minimum(((np.degrees(np.arctan2(ky, kx)) % 180) / (180 / n_bins)).astype(int), n_bins - 1)
    e = np.bincount(b[m], weights=P[m], minlength=n_bins)
    return float(e.max() / max(e.sum(), 1e-30))


def slope_deg(z: np.ndarray, res: float) -> np.ndarray:
    gy, gx = np.gradient(z, res)
    return np.degrees(np.arctan(np.hypot(gx, gy)))


def horizon_tangents(z, res, pad, radius_m):
    n = z.shape[0] - 2 * pad
    c = z[pad:pad + n, pad:pad + n]
    far, near = np.empty((8, n, n)), np.empty((8, n, n))
    for a, (dr, dc) in enumerate(DIRS):
        step = math.hypot(dr, dc)
        kmax = min(int(SHADOW_PX // step), pad)
        best = np.full((n, n), -np.inf)
        best_near = np.full((n, n), -np.inf)
        for k in range(1, kmax + 1):
            d = k * step * res
            s = z[pad + k * dr: pad + k * dr + n, pad + k * dc: pad + k * dc + n]
            t = (s - c - d * d / (2.0 * radius_m)) / d
            np.maximum(best, t, out=best)
            if k * step <= SVF_PX:
                np.maximum(best_near, t, out=best_near)
        far[a], near[a] = best, best_near
    return far, near


def hurst_exponent(z: np.ndarray) -> float:
    lags = np.array([1, 2, 4, 8, 16, 32])
    gam = []
    for L in lags:
        dx = z[:, L:] - z[:, :-L]
        dy = z[L:, :] - z[:-L, :]
        gam.append(0.25 * (np.mean(dx * dx) + np.mean(dy * dy)))
    gam = np.maximum(np.array(gam), 1e-12)
    return float(np.polyfit(np.log(lags), np.log(gam), 1)[0] / 2.0)


def depressions(z: np.ndarray, pad: int, relief: float):
    f = 4
    n = z.shape[0] // f
    zc = z[:n * f, :n * f].reshape(n, f, n, f).mean(axis=(1, 3))
    filled = np.full_like(zc, zc.max())
    filled[0, :], filled[-1, :], filled[:, 0], filled[:, -1] = zc[0, :], zc[-1, :], zc[:, 0], zc[:, -1]
    for _ in range(4 * n):
        nxt = np.maximum(zc, ndimage.minimum_filter(filled, size=3, mode="nearest"))
        if np.array_equal(nxt, filled):
            break
        filled = nxt
    p = pad // f
    depth = (filled - zc)[p:n - p, p:n - p]
    rel = max(relief, 1e-6)
    return float((depth > 0.03 * rel).mean()), float(min(depth.mean() / rel, 1.0))


def layout_features(zc: np.ndarray, z: np.ndarray, pad: int, relief: float):
    # Block-level shape numbers the cell matching cannot see (it compares cells as an unordered set).
    gy, gx = np.gradient(detrend(zc))
    jxx, jyy, jxy = (gx * gx).mean(), (gy * gy).mean(), (gx * gy).mean()
    linearity = math.sqrt((jxx - jyy) ** 2 + 4 * jxy * jxy) / max(jxx + jyy, 1e-12)   # 0 = no grain, 1 = one direction
    p2 = np.percentile(zc, 2)
    hyps = float(np.clip((zc.mean() - p2) / max(relief, 1e-6), 0.0, 1.0))             # low = flat floor with peaks
    dep_area, dep_depth = depressions(z, pad, relief)
    return float(linearity), hyps, dep_area, dep_depth


def spectrum_bands(zc: np.ndarray) -> np.ndarray:
    # radially averaged power spectrum: share of the block's (detrended, edge-tapered) relief in each wavelength band.
    # direction-free, so rotating the block doesn't change it
    n = zc.shape[0]
    w = np.hanning(n)
    F = np.abs(np.fft.fft2(detrend(zc) * w[:, None] * w[None, :])) ** 2
    f = np.fft.fftfreq(n)
    fr = np.hypot(f[:, None], f[None, :])
    lam = np.divide(1.0, fr, out=np.full_like(fr, np.inf), where=fr > 0)
    band = np.array([F[(lam > lo) & (lam <= hi)].sum() for lo, hi in SPEC_BANDS])
    tot = band.sum()
    return band / tot if tot > 0 else np.full(len(SPEC_BANDS), 1.0 / len(SPEC_BANDS))


def radial_shapes(zc: np.ndarray, relief: float):
    # best bowl (rim higher than centre) and best cone (centre higher than surroundings) over a 5 x 5 grid of centres.
    # strength = height difference over relief x how much of the area's variance the ring profile explains
    n = zc.shape[0]
    zn = (zc - zc.mean()) / max(relief, 1.0)
    yy, xx = np.mgrid[0:n, 0:n]
    best_b, best_c = (0.0, 0.0), (0.0, 0.0)
    for cy in range(n // 4, 3 * n // 4 + 1, n // 8):
        for cx in range(n // 4, 3 * n // 4 + 1, n // 8):
            ring = (np.hypot(yy - cy, xx - cx) / RING_PX).astype(int)
            m = ring < N_RINGS
            lab, v = ring[m], zn[m]
            cnt = np.bincount(lab, minlength=N_RINGS)
            if (cnt == 0).any():
                continue
            p = np.bincount(lab, v, minlength=N_RINGS) / cnt
            sst = ((v - v.mean()) ** 2).sum()
            r2 = 1.0 - ((v - p[lab]) ** 2).sum() / sst if sst > 0 else 0.0
            b, c = max(0.0, p[1:].max() - p[0]) * r2, max(0.0, p[0] - p[1:].min()) * r2
            if b > best_b[0]:
                best_b = (b, (np.argmax(p[1:]) + 1.5) * RING_PX / (n / 2))
            if c > best_c[0]:
                best_c = (c, (np.argmin(p[1:]) + 1.5) * RING_PX / (n / 2))
    return best_b[0], best_b[1], best_c[0], best_c[1]


def to_cells(a: np.ndarray, cell_px: int) -> np.ndarray:
    # (H, H) map -> (n_cells, cell_px^2), cells in row-major order (cell index = i * n + j).
    n = a.shape[0] // cell_px
    return a.reshape(n, cell_px, n, cell_px).transpose(0, 2, 1, 3).reshape(n * n, cell_px * cell_px)


def compute_features(z_padded: np.ndarray, radius_m: float, scale: str = "site", return_maps: bool = False):
    cfg = SCALES[scale]
    res, pad, cell_px = cfg["res"], PAD_PX, CELL_PX
    z = ndimage.gaussian_filter(fill_nans(np.asarray(z_padded, dtype=np.float64)), LOWPASS_PX, mode="nearest")
    n = z.shape[0] - 2 * pad

    def crop(a):
        return a[pad:pad + n, pad:pad + n]

    slope = crop(slope_deg(z, res))
    rc = crop(z - ndimage.uniform_filter(z, ROUGH_COARSE_PX, mode="nearest"))

    tpi = crop(z - ndimage.uniform_filter(z, TPI_PX, mode="nearest"))
    tpi_n = crop(z - ndimage.uniform_filter(z, TPI_NEAR_PX, mode="nearest"))
    tpi_f = crop(z - ndimage.uniform_filter(z, TPI_FAR_PX, mode="nearest"))
    thr = 0.5 * (TPI_PX // 2) * res * np.tan(np.radians(cfg["flat_deg"]))
    flat = (np.abs(tpi) < thr).astype(float)
    convex = (tpi >= thr).astype(float)
    concave = (tpi <= -thr).astype(float)

    far, near = horizon_tangents(z, res, pad, radius_m)
    shadow_low = (far > np.tan(np.radians(cfg["sun_low"]))).mean(axis=0)
    shadow_mid = (far > np.tan(np.radians(cfg["sun_mid"]))).mean(axis=0)
    svf = 1.0 - np.sin(np.arctan(np.maximum(near, 0.0))).mean(axis=0)

    zc = crop(z)
    p2, p98 = np.percentile(zc, [2, 98])
    relief = p98 - p2

    S, RC, CV, CC, SL, SM, ZC, TN, TF = (to_cells(a, cell_px) for a in (slope, rc, convex, concave, shadow_low, shadow_mid, zc,
                                                                        tpi_n / max(relief, 1.0), tpi_f / max(relief, 1.0)))
    tokens = np.stack([
        S.mean(1),
        np.sqrt((RC ** 2).mean(1)),
        CV.mean(1), CC.mean(1),
        SL.mean(1),
        SM.mean(1),
        (ZC.mean(1) - p2) / max(relief, 1.0),
        TN.mean(1), TF.mean(1),
    ], axis=1)
    linearity, _, dep_area, dep_depth = layout_features(zc, z, pad, relief)
    block = np.array([relief, hurst_exponent(zc), linearity, dep_area, dep_depth, *spectrum_bands(zc), *radial_shapes(zc, relief)])
    if return_maps:
        return tokens, block, dict(dem=zc, slope=slope, tpi=tpi, shadow_low=shadow_low, svf=svf)
    return tokens, block


#  sketches and matching (no training)

def sketch_raw(tokens_scaled: np.ndarray) -> np.ndarray:
    q = np.quantile(tokens_scaled, QUANTILES, axis=-2)
    q = np.moveaxis(q, 0, -2) / np.sqrt(len(QUANTILES))
    return q.reshape(*q.shape[:-2], -1)


def block_diff(bu: np.ndarray, BV: np.ndarray) -> np.ndarray:
    # Block-level mismatches: |log relief ratio|, then plain absolute differences.
    BV = np.atleast_2d(BV)
    d = np.abs(BV - bu[None, :])
    d[:, 0] = np.abs(np.log1p(np.maximum(BV[:, 0], 0.0)) - math.log1p(max(bu[0], 0.0)))
    return d


def pair_inputs_many(U: np.ndarray, V: np.ndarray, bu: np.ndarray, BV: np.ndarray):
    V = np.asarray(V, dtype=np.float64)
    C = (U * U).sum(1)[None, :, None] + (V * V).sum(2)[:, None, :] - 2.0 * np.einsum("if,sjf->sij", U, V)
    raw = np.empty((len(V), N_IN))
    partner = np.empty((len(V), U.shape[0]), dtype=np.int64)
    for s in range(len(V)):
        _, c = linear_sum_assignment(C[s])
        d = U - V[s][c]
        raw[s, :N_TOK] = (d * d).mean(axis=0)
        partner[s] = c
    raw[:, N_TOK:] = block_diff(bu, BV)
    return raw, raw[:, :N_TOK].sum(1), partner


#  the trained model

class Model:
    # everything in model.npz, plus a few derived lookups

    def __init__(self, z: dict):
        self.z = z
        self.version = str(z["version"])
        self.scales = [str(s) for s in z["scales"]]
        self.S = {}
        for s in self.scales:
            g = lambda k, s=s: z[f"{s}__{k}"]
            self.S[s] = dict(
                scale=g("scaler_scale"), pca_mean=g("pca_mean"), pca_comp=g("pca_components"),
                pct_table=g("pct_table"), curve=g("curve_vals"), bias=float(g("bias")),
                ens_curve=g("ens_curve_vals"), ens_bias=g("ens_bias"),
                tokens=g("lib_tokens"),                       # (N, 64, N_TOK) scaled, float16 on disk
                block=g("lib_block").astype(np.float64), sketch=g("lib_sketch").astype(np.float64),
                earth_sketch=g("earth_sketch"), ood_threshold=float(g("ood_threshold")),
                weight=float(g("combo_weight")),
                logw=(z[f"{s}__lib_logw"].astype(np.float64) if f"{s}__lib_logw" in z else np.zeros(len(z["lib_world"]))),
                block_mask=(z[f"{s}__block_mask"].astype(np.float64) if f"{s}__block_mask" in z else np.ones(len(BLOCK_FEATURES))),
            )
        # library: one row per Moon or Mars location, with tokens at every scale
        self.lib_world = z["lib_world"]
        self.lib_region = z["lib_region"]                     # index into region_keys
        self.lib_tag, self.lib_name = z["lib_tag"], z["lib_name"]
        self.lib_lat, self.lib_lon, self.lib_href = z["lib_lat"], z["lib_lon"], z["lib_href"]
        self.region_keys = [str(s) for s in z["region_keys"]]       # "moon:maria", ...
        self.region_title = [str(s) for s in z["region_title"]]
        self.region_world = [k.split(":")[0] for k in self.region_keys]
        self.members = [np.flatnonzero(self.lib_region == r) for r in range(len(self.region_keys))]
        self.calib = {s: [np.sort(z[f"{s}__calib__{r}"]) for r in range(len(self.region_keys))] for s in self.scales}
        self.combo_bias = float(z["combo_bias"])
        self.top_k, self.shortlist = int(z["top_k"]), int(z["shortlist"])
        # Earth-side conditions; they can only discount the landscape score
        self.gate_names = [str(s) for s in z["gate_names"]]
        self.gate_table, self.gate_curve = z["gate_table"], z["gate_curve_vals"]
        self.gate_bias = float(z["gate_bias"])
        self.discount_floor = float(z["discount_floor"])
        self.built_penalty = float(z["built_penalty"]) if "built_penalty" in z else 0.0
        self.built_full = float(z["built_full"]) if "built_full" in z else 0.05
        # Earth-relative factor: each region's similarity is discounted when that much similarity is common on Earth
        self.earth_floor = float(z["earth_floor"]) if "earth_floor" in z else 1.0
        self.earth_gamma = float(z["earth_gamma"]) if "earth_gamma" in z else 1.0          # v2.1
        self.surface_beta = float(z["surface_beta"]) if "surface_beta" in z else None     # v2.1; None = v2.0's sqrt(landscape x surface)
        self.terrain_power = float(z["terrain_power"]) if "terrain_power" in z else 1.0   # v2.1: similarity = 100 x p^k
        self.aridity = z["aridity_grid"] if "aridity_grid" in z else None                 # v2.1: aridity index x 10000, same grid as precip
        self.earth_ref = [np.sort(z[f"earth_ref__{r}"]) if f"earth_ref__{r}" in z else None for r in range(len(self.region_keys))]
        self.precip = z["precip_grid"]                        # mm per year, row 0 = 90 N, col 0 = 180 W
        # v1.3.1 display scale: surface is shown out of its real maximum, overall is the geometric mean, and the
        # overall percentile among random Earth land is stored per world. none of this changes any ranking
        self.surface_max = float(z["surface_max"]) if "surface_max" in z else 100.0
        self.overall_ref = {w: np.sort(z[f"overall_ref__{w}"]) for w in WORLDS if f"overall_ref__{w}" in z}
        # v2.0 library weighting: a match against terrain that's common on Earth counts less
        self.weight_lambda = float(z["weight_lambda"]) if "weight_lambda" in z else 0.0
        # v2.0 landform scores: one per (region, landform tag) with enough blocks
        self.lf_keys = [str(x) for x in z["lf_keys"]] if "lf_keys" in z else []
        nl = len(self.lf_keys)
        self.lf_region = np.asarray(z["lf_region"], int) if nl else np.zeros(0, int)
        self.lf_tag = np.asarray(z["lf_tag"]).astype(str) if nl else np.zeros(0, str)
        self.lf_label = [t.replace("_", " ") for t in self.lf_tag]
        self.lf_valid = np.asarray(z["lf_valid"], bool) if "lf_valid" in z else np.zeros(nl, bool)
        self.lf_members = [np.flatnonzero((self.lib_region == self.lf_region[i]) & (self.lib_tag.astype(str) == self.lf_tag[i])) for i in range(nl)]
        self.lf_calib = {s: [np.sort(z[f"{s}__lfcal__{i}"]) if f"{s}__lfcal__{i}" in z else None for i in range(nl)] for s in self.scales}
        self.lf_earth = [np.sort(z[f"lf_earth__{i}"]) if f"lf_earth__{i}" in z else None for i in range(nl)]
        self.lf_badge_min = float(z["lf_badge_min"]) if "lf_badge_min" in z else 60.0


def load(path) -> Model:
    with np.load(path, allow_pickle=False) as f:
        return Model({k: f[k] for k in f.files})


def aridity_at(model, lat: float, lon: float) -> float:
    # v2.1: aridity index (rain / potential evaporation; under 0.05 hyper-arid, over 0.65 humid) from the grid inside
    # the model file (Global Aridity Index v3.1, Zomer et al. 2022, CC BY 4.0). NaN where unknown or with an older model
    g = getattr(model, "aridity", None)
    if g is None:
        return float("nan")
    i = min(max(int((90.0 - lat) / 180.0 * g.shape[0]), 0), g.shape[0] - 1)
    j = min(max(int(((lon + 180.0) % 360.0) / 360.0 * g.shape[1]), 0), g.shape[1] - 1)
    v = float(g[i, j])
    return float("nan") if v >= 65535 else v / 10000.0


def sim_curve(model, x):
    # similarity (0-100) from a combined logit. v2.1: 100 x p^k with k <= 1 lifts mid-range matches more than the
    # best ones, without changing the order (k = 1 is v2.0)
    return 100.0 * float(expit(x)) ** getattr(model, "terrain_power", 1.0)


def earth_factor(model, pct: float) -> float:
    # landscape = similarity x this. v2.1 adds the gamma: under 1 it is gentler on land that is only mid-ranked
    return model.earth_floor + (1.0 - model.earth_floor) * pct ** getattr(model, "earth_gamma", 1.0)


def overall_of(model, landscape: float, surface: float) -> float:
    # v2.1: surface as a soft discount, landscape x (surface / 100)^beta, so a bare place keeps nearly its terrain score
    # and surface can't lift a weak terrain match. older models: the v1.3.1 geometric mean
    beta = getattr(model, "surface_beta", None)
    if beta is None:
        return float(np.sqrt(max(landscape, 0.0) * surface))
    return float(max(landscape, 0.0) * (max(surface, 0.0) / 100.0) ** beta)


def precip_at(model: Model, lat: float, lon: float) -> float:
    # Mean annual precipitation (mm) from the small grid inside the model file. NaN where unknown.
    g = model.precip
    i = min(max(int((90.0 - lat) / 180.0 * g.shape[0]), 0), g.shape[0] - 1)
    j = min(max(int(((lon + 180.0) % 360.0) / 360.0 * g.shape[1]), 0), g.shape[1] - 1)
    v = float(g[i, j])
    return float("nan") if v >= 65535 else v


def top_k_for(model: Model, n_members: int) -> int:
    return max(3, min(model.top_k, n_members // 4))


def embed(model: Model, dems: dict, radius_m: float) -> dict:
    # {scale: padded DEM} -> {scale: (scaled tokens, block features, sketch)}.
    out = {}
    for s in model.scales:
        if dems.get(s) is None:
            continue
        P = model.S[s]
        tok_raw, blk = compute_features(dems[s], radius_m, s)
        blk = blk * P["block_mask"]                 # block features that failed the planet check are switched off
        tok = tok_raw / P["scale"]
        out[s] = (tok, blk, (sketch_raw(tok) - P["pca_mean"]) @ P["pca_comp"].T)
    if not out:
        raise ValueError("no DEM given")
    return out


def to_z(table: np.ndarray, raw: np.ndarray) -> np.ndarray:
    # raw (n, F) -> percentiles (n, F) in [0, 1] using per-input quantile tables (F, 1001).
    raw = np.atleast_2d(raw)
    return np.stack([np.interp(raw[:, k], table[k], GRID) for k in range(raw.shape[1])], axis=1)


def curves_at(curve_vals: np.ndarray, Z: np.ndarray) -> np.ndarray:
    # Curve values (n, F) for percentiles Z (n, F); curves are tabulated on GRID.
    return np.stack([np.interp(Z[:, k], GRID, curve_vals[k]) for k in range(Z.shape[1])], axis=1)


def pair_logit(model: Model, scale: str, raw: np.ndarray, ensemble: bool = False):
    # Pair model of one scale: (logit (n,), contributions (n, 19)[, ensemble logits (n, E)]).
    P = model.S[scale]
    Z = to_z(P["pct_table"], raw)
    contrib = curves_at(P["curve"], Z)
    lg = P["bias"] + contrib.sum(1)
    if not ensemble:
        return lg, contrib
    ens = np.stack([b + curves_at(cv, Z).sum(1) for cv, b in zip(P["ens_curve"], P["ens_bias"])], axis=1)
    return lg, contrib, ens


def calibrated(calib_sorted: np.ndarray, A: float, drop_self: float | None = None) -> float:
    n = len(calib_sorted)
    below = np.searchsorted(calib_sorted, A, side="right")
    if drop_self is not None:            # evaluation only: remove the query's own entry
        n -= 1
        below -= int(drop_self <= A)
    return float((below + 0.5) / (n + 1))


def to_logit(score_0_100: float) -> float:
    p = min(max(score_0_100 / 100.0, 0.02), 0.98)
    return float(np.log(p / (1 - p)))


#  v2.0.1 breakdowns: every shown score split into score points that add up to it exactly

def _secant(g, a: float, b: float, min_w: float = 0.5) -> float:
    # average slope of g between a and b, taken over at least min_w so a step in a calibration table can't blow it up
    lo, hi = min(a, b), max(a, b)
    if hi - lo < min_w:
        mid = 0.5 * (lo + hi)
        lo, hi = mid - 0.5 * min_w, mid + 0.5 * min_w
    return float((g(hi) - g(lo)) / (hi - lo))


def _breakdown(score: float, sim: float, parts: dict, L: float, common: float, power: float = 1.0):
    # score = base + sum(terms) + common + earth, all in score points.
    #   terms: each measurement (logit points of the combined logit L, times the average slope of the 0-100 score)
    #   common: the library weighting (matches against terrain that's common on Earth count less)
    #   earth: the Earth factor (score - similarity; this place looks like ordinary Earth land)
    #   base: what's left, i.e. the score of a typical match with every measurement at its typical value
    tot = float(sum(parts.values()) + common)
    r = _secant(lambda x: 100.0 * float(expit(x)) ** power, L - tot, L)
    terms = {n: float(r * v) for n, v in parts.items()}
    com = float(r * common)
    earth = float(score - sim)
    return dict(base=float(score - sum(terms.values()) - com - earth), terms=terms, common=com, earth=earth,
                total=float(score)), r


def _cell_logits(model: "Model", scale: str, raw: np.ndarray, contrib: np.ndarray, d: np.ndarray) -> np.ndarray:
    # each 500 m cell's share of the cell-feature part of one pair logit. a cell feature's input is the mean squared
    # mismatch over the 64 matched cell pairs, so its effect is split evenly over the cells, then shifted towards cells
    # that match better or worse than the block's average (by the local slope of that feature's curve). sums exactly
    # to the cell features' contributions.
    P = model.S[scale]
    d2 = d * d
    r0 = np.asarray(raw, dtype=float)[:N_TOK]
    step = np.maximum(0.1 * r0, 1e-9)
    hi, lo = np.array(raw, dtype=float), np.array(raw, dtype=float)
    hi[:N_TOK] = r0 + step
    lo[:N_TOK] = np.maximum(r0 - step, 0.0)
    h = curves_at(P["curve"], to_z(P["pct_table"], np.stack([hi, lo])))
    slope = (h[0, :N_TOK] - h[1, :N_TOK]) / np.maximum(hi[:N_TOK] - lo[:N_TOK], 1e-12)
    n = d2.shape[0]
    return ((np.asarray(contrib, dtype=float)[:N_TOK] / n)[None, :] + slope[None, :] * (d2 - r0[None, :]) / n).sum(1)


def _scale_parts(model: "Model", per: dict, calib_of) -> tuple[np.ndarray, float]:
    # per scale: (mean contributions of the top pairs, mean weighting term, aggregate). the shown score goes
    # aggregate -> calibrated score -> logit -> weighted sum; each scale's step is replaced by its average slope from
    # the typical pair (logit = bias) to this aggregate
    w_all = sum(model.S[s]["weight"] for s in model.scales)
    w_sum = sum(model.S[s]["weight"] for s in per)
    rescale = w_all / w_sum if 0 < w_sum < w_all else 1.0
    items, comm = np.zeros(N_IN), 0.0
    for s, v in per.items():
        cal = calib_of(s)
        if cal is None or not len(cal):
            continue
        m = _secant(lambda a, cal=cal: to_logit(100.0 * calibrated(cal, a)), model.S[s]["bias"], v["aggregate"])
        m *= model.S[s]["weight"] * rescale
        items = items + m * np.asarray(v["cbar"])
        comm += m * v["comm"]
    return items, comm


def landform_aggregates(model: Model, emb: dict, ids, exclude: np.ndarray | None = None) -> dict:
    # {landform id: {scale: dict(aggregate, top)}}: mean of the top LF_K weighted pair logits over the landform's blocks
    out = {}
    for i in ids:
        memt = model.lf_members[i]
        if exclude is not None:
            memt = memt[~exclude[memt]]
        if len(memt) < LF_K:
            continue
        per = {}
        for s, (tok, blk, sk) in emb.items():
            P = model.S[s]
            sh = memt[np.argsort(((P["sketch"][memt] - sk) ** 2).sum(1))[:LF_SHORT]]
            raw_t, _, _ = pair_inputs_many(tok, P["tokens"][sh], blk, P["block"][sh])
            lg_t, c_t = pair_logit(model, s, raw_t)
            lw_t = model.weight_lambda * P["logw"][sh]
            lg_t = lg_t + lw_t
            o = np.argsort(-lg_t)
            per[s] = dict(aggregate=float(lg_t[o[:LF_K]].mean()), top=[int(j) for j in sh[o[:3]]],
                          cbar=c_t[o[:LF_K]].mean(0), comm=float(lw_t[o[:LF_K]].mean()))
        out[int(i)] = per
    return out


def landform_score(model: Model, i: int, per: dict) -> dict:
    # same steps as the region score: calibrate per scale, combine the scales, then the Earth factor
    w_all = sum(model.S[s]["weight"] for s in model.scales)
    L, w_s, scales = model.combo_bias, 0.0, {}
    for s, v in per.items():
        cal = model.lf_calib.get(s, [None] * (i + 1))[i]
        sc = 100.0 * calibrated(cal, v["aggregate"]) if cal is not None and len(cal) else 50.0
        scales[s] = dict(score=sc, aggregate=v["aggregate"])
        L += model.S[s]["weight"] * to_logit(sc)
        w_s += model.S[s]["weight"]
    if 0 < w_s < w_all:
        L = model.combo_bias + (L - model.combo_bias) * w_all / w_s
    sim = sim_curve(model, L)
    ref = model.lf_earth[i] if i < len(model.lf_earth) else None
    pct = float(np.searchsorted(ref, L, side="right") / len(ref)) if ref is not None and len(ref) else 1.0
    f = earth_factor(model, pct)
    out = dict(score=sim * f, similarity=sim, earth_percentile=100.0 * pct, logit=float(L), scales=scales)
    if all("cbar" in v for v in per.values()):
        items, comm = _scale_parts(model, per, lambda s: model.lf_calib.get(s, [None] * (i + 1))[i])
        out["breakdown"], _ = _breakdown(sim * f, sim, dict(zip(INPUT_NAMES, items.tolist())), float(L), comm, model.terrain_power)
    return out


def region_scores(model: Model, emb: dict, world: str, exclude: np.ndarray | None = None,
                  n_best: int = 5, with_cells: bool = False, landforms: bool = False):
    out = []
    for r, key in enumerate(model.region_keys):
        if model.region_world[r] != world:
            continue
        mem = model.members[r]
        if exclude is not None:
            mem = mem[~exclude[mem]]
        if len(mem) < 4:
            continue
        k = top_k_for(model, len(mem))
        per_scale, cand, parts, w_sum, L = {}, {}, {}, 0.0, model.combo_bias
        for s, (tok, blk, sk) in emb.items():
            P = model.S[s]
            short = mem[np.argsort(((P["sketch"][mem] - sk) ** 2).sum(1))[:model.shortlist]]
            raw, W, partner = pair_inputs_many(tok, P["tokens"][short], blk, P["block"][short])
            lg, contrib = pair_logit(model, s, raw)
            lw = model.weight_lambda * P["logw"][short]
            lg = lg + lw                                            # v2.0: matches against common terrain count less
            o_k = np.argsort(-lg)[:k]
            A = float(lg[o_k].mean())
            score = 100.0 * calibrated(model.calib[s][r], A)
            per_scale[s] = dict(score=score, aggregate=A)
            parts[s] = dict(aggregate=A, cbar=contrib[o_k].mean(0), comm=float(lw[o_k].mean()))
            cand[s] = dict(short=short, lg=lg, lw=lw, contrib=contrib, W=W, partner=partner, raw=raw)
            L += P["weight"] * to_logit(score)
            w_sum += P["weight"]
        w_all = sum(model.S[s]["weight"] for s in model.scales)
        if 0 < w_sum < w_all:             # a scale is missing: the others carry its weight
            L = model.combo_bias + (L - model.combo_bias) * w_all / w_sum

        lead = "site" if "site" in cand else next(iter(cand))
        c0 = cand[lead]
        top = np.argsort(-c0["lg"])[:max(30, n_best)]        # the 30 best at the lead scale are re-ranked with every scale
        joint = c0["lg"][top].copy()
        others, others_c, others_w = {}, {}, {}
        for s in emb:
            if s == lead:
                continue
            tok, blk, _ = emb[s]
            P = model.S[s]
            raw_o, _, _ = pair_inputs_many(tok, P["tokens"][c0["short"][top]], blk, P["block"][c0["short"][top]])
            lg_o, others_c[s] = pair_logit(model, s, raw_o)
            others_w[s] = model.weight_lambda * P["logw"][c0["short"][top]]
            others[s] = lg_o + others_w[s]
            joint = joint + others[s]
        joint = joint / (1 + len(others))
        best = []
        for o in np.argsort(-joint)[:n_best]:
            i = top[o]
            j = int(c0["short"][i])
            b = dict(index=j, name=str(model.lib_name[j]), tag=str(model.lib_tag[j]), region=key,
                     lat=float(model.lib_lat[j]), lon=float(model.lib_lon[j]), href=str(model.lib_href[j]),
                     pair_score=float(100 * expit(joint[o])), logit=float(joint[o]),
                     scale_logits={lead: float(c0["lg"][i]), **{s: float(v[o]) for s, v in others.items()}},
                     W=float(c0["W"][i]),
                     contributions={n: float(v) for n, v in zip(INPUT_NAMES, c0["contrib"][i])}, _o=int(o))
            if with_cells:
                tok = emb[lead][0]
                d = tok - model.S[lead]["tokens"][j].astype(np.float64)[c0["partner"][i]]
                b["cell_cost"] = (d * d).sum(1).reshape(8, 8).tolist()
                b["partner"] = c0["partner"][i].tolist()
                b["_d"] = d
            best.append(b)
        sim = sim_curve(model, L)
        ref = model.earth_ref[r]
        pct = float(np.searchsorted(ref, L, side="right") / len(ref)) if ref is not None and len(ref) else 1.0
        factor = earth_factor(model, pct)
        # v1.3.2: put each best site on the region score's scale. the region's logit L sits where the average of its
        # top pairs sits, so a site's logit is shifted by the same amount, then gets the same Earth factor.
        # contributions become score points (logit points x the slope of the score at that site), so they read like "+4"
        ref_j = float(np.mean(np.sort(joint)[::-1][:min(k, len(joint))]))
        for b in best:
            p0 = float(expit(b["logit"] - ref_j + L))
            p = p0 ** model.terrain_power                     # v2.1: the same lift as the region's similarity
            b["pair_score_raw"] = b["pair_score"]
            b["pair_score"] = 100.0 * p * factor
            slope = 100.0 * model.terrain_power * p * (1.0 - p0) * factor
            b["contributions_logit"] = b["contributions"]
            b["contributions"] = {n: v * slope for n, v in b["contributions"].items()}
            # v2.0.1: exact breakdown of pair_score, averaged over the scales like the pair logit itself
            o = b.pop("_o")
            i = top[o]
            n_sc = 1 + len(others)
            feats = (c0["contrib"][i] + sum(others_c[s][o] for s in others)) / n_sc
            comm = (float(c0["lw"][i]) + sum(float(others_w[s][o]) for s in others)) / n_sc
            b["breakdown"], r_b = _breakdown(b["pair_score"], 100.0 * p, dict(zip(INPUT_NAMES, feats.tolist())),
                                             b["logit"] - ref_j + L, comm, model.terrain_power)
            if "_d" in b:
                # each cell's share of the 4 km cell features, in the same score points (they add up to those terms)
                cl = _cell_logits(model, lead, c0["raw"][i], c0["contrib"][i], b.pop("_d"))
                b["cell_points"] = (r_b * cl / n_sc).reshape(8, 8).tolist()
        items, comm_l = _scale_parts(model, parts, lambda s: model.calib[s][r])
        region_bd, _ = _breakdown(sim * factor, sim, dict(zip(INPUT_NAMES, items.tolist())), float(L), comm_l, model.terrain_power)
        lf, lf_all = None, []
        if landforms and model.lf_keys:
            for i, per in landform_aggregates(model, emb, np.flatnonzero(model.lf_region == r), exclude).items():
                d = landform_score(model, i, per)
                lead_ = "site" if "site" in per else next(iter(per))
                d.update(tag=str(model.lf_tag[i]), label=model.lf_label[i], validated=bool(model.lf_valid[i]),
                         matches=[dict(index=j, name=str(model.lib_name[j]), lat=float(model.lib_lat[j]), lon=float(model.lib_lon[j]))
                                  for j in per[lead_]["top"]])
                lf_all.append(d)
            if lf_all:
                # v2.0.1: show the best validated landform when the region has one, else the best one (marked unvalidated)
                lf = max([d for d in lf_all if d["validated"]] or lf_all, key=lambda d: d["score"])
                lf["badge"] = bool(lf["validated"] and lf["score"] >= model.lf_badge_min and lf["score"] >= sim * factor)
        out.append(dict(region_id=r, region=key, title=model.region_title[r], score=sim * factor, similarity=sim,
                        earth_percentile=100.0 * pct, earth_factor=factor,
                        logit=float(L), scales=per_scale, n_members=int(len(mem)), best=best, breakdown=region_bd,
                        landform=lf, landform_scores={d["tag"]: float(d["score"]) for d in lf_all}))
    out.sort(key=lambda d: -d["score"])
    return out


def gate_inputs(env: dict, names=GATE_NAMES) -> np.ndarray:
    # conditions inputs from the raw land-cover shares. "open" = bare ground + snow and ice: neither hides the
    # terrain, so snow isn't penalised (polar analogs like the Dry Valleys are mostly snow, ice and bare rock)
    e = {k: float(v) for k, v in env.items()}
    bare = e.get("bare", np.nan)
    e["open"] = np.nan if np.isnan(bare) else bare + float(np.nan_to_num(e.get("snow", 0.0)))
    return np.array([e.get(n, np.nan) for n in names], dtype=float)


def conditions(model: Model, env: dict):
    # Earth-side conditions: (logit, {input: contribution in logit points}). One-sided curves.
    x = gate_inputs(env, model.gate_names)
    built = float(np.nan_to_num(env.get("built", 0.0)))
    Z = to_z(model.gate_table, np.nan_to_num(x, nan=0.0)[None, :])[0]
    Z[np.isnan(x)] = 0.5                 # missing -> typical land
    h = np.array([np.interp(Z[m], GRID, model.gate_curve[m]) for m in range(len(x))])
    terms = {n: float(v) for n, v in zip(model.gate_names, h)}
    fixed = -model.built_penalty * min(built / model.built_full, 1.0)       # buildings never occur at analog sites
    terms["built"] = terms.get("built", 0.0) + fixed
    return float(model.gate_bias + h.sum() + fixed), terms


def score_click(model: Model, dems: dict, env: dict, worlds=WORLDS, n_best: int = 5) -> dict:
    # Everything the API returns for one Earth click: one entry per world (the two tabs).
    emb = embed(model, dems, RADIUS_M["earth"])
    G, terms = conditions(model, env)
    ood = {s: bool(np.sqrt(((model.S[s]["earth_sketch"] - emb[s][2]) ** 2).sum(1).min()) > model.S[s]["ood_threshold"])
           for s in emb}
    blk = emb["site"][1] if "site" in emb else next(iter(emb.values()))[1]
    raw = float(100 * expit(G))                                    # the conditions model's probability, at most surface_max
    surface = float(min(100.0, 100.0 * raw / model.surface_max))   # shown out of 100: 100 = as bare and dry as the model allows
    out = dict(model_version=model.version, scales_used=list(emb), ood=any(ood.values()), ood_by_scale=ood,
               conditions=dict(score=surface, raw=raw, logit=G, discount=surface / 100.0, terms_logit=terms,
                               # terms in surface-score points: logit points x the slope of the 0-100 surface score here
                               terms={n: v * 100.0 * (raw / 100.0) * (1.0 - raw / 100.0) * 100.0 / model.surface_max
                                      for n, v in terms.items()}),
               block={n: float(v) for n, v in zip(BLOCK_FEATURES, blk)}, worlds={})
    for w in worlds:
        regs = region_scores(model, emb, w, n_best=n_best, with_cells=True, landforms=True)
        for reg in regs:
            # geometric mean: both terrain and surface have to be good, without squashing two good scores into a low one
            reg["overall"] = overall_of(model, reg["score"], surface)
        regs.sort(key=lambda d: -d["overall"])
        best = max((b for reg in regs for b in reg["best"]), key=lambda b: b["logit"])
        ref = model.overall_ref.get(w)
        pct = float(100.0 * np.searchsorted(ref, regs[0]["overall"], side="right") / len(ref)) if ref is not None else None
        out["worlds"][w] = dict(regions=regs, best_region=regs[0]["region"], landscape_score=regs[0]["score"],
                                overall=regs[0]["overall"], overall_percentile=pct, best_match=best)
    return out


_WORKER_MODELS = {}


def region_logits_task(args):
    # (model path, embedding) -> (region logits (R,), per-scale scores (R, n_scales)). for process pools: the
    # notebook scores thousands of Earth blocks with it; the server doesn't need it
    path, emb = args
    m = _WORKER_MODELS.get(path)
    if m is None:
        m = _WORKER_MODELS[path] = load(path)
    logit = np.full(len(m.region_keys), np.nan)
    per = np.full((len(m.region_keys), len(m.scales)), np.nan)
    for w in WORLDS:
        for reg in region_scores(m, emb, w, n_best=1):
            logit[reg["region_id"]] = reg["logit"]
            per[reg["region_id"]] = [reg["scales"].get(s, {}).get("score", np.nan) for s in m.scales]
    return logit, per


def landform_task(args):
    # (model path, embedding, landform ids, exclude mask) -> landform_aggregates, for process pools in the notebook
    path, emb, ids, exclude = args
    m = _WORKER_MODELS.get(path)
    if m is None:
        m = _WORKER_MODELS[path] = load(path)
    return landform_aggregates(m, emb, ids, exclude)
