import math

import numpy as np

from .dem import BLOCK_PX, RES_M, center

SHADOW_DIST_M = 2000.0 # same as the window margin so rays stay inside it
AZIMUTHS = range(0, 360, 45)


def box_mean(z: np.ndarray, k: int) -> np.ndarray:
    # moving mean over k x k, edge padded, done with cumulative sums
    p = k // 2
    c = np.cumsum(np.cumsum(np.pad(z, p, mode="edge").astype(np.float64), 0), 1)
    c = np.pad(c, ((1, 0), (1, 0)))
    return (c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]) / (k * k)


def slope_deg(z: np.ndarray, px: float = RES_M) -> np.ndarray:
    gy, gx = np.gradient(z.astype(np.float64), px)
    return np.degrees(np.arctan(np.hypot(gx, gy)))


def shadow_fraction(win: np.ndarray, sun_el_deg: float, px: float = RES_M) -> float:
    # share of the centre block in shadow, averaged over 8 sun directions
    pad = (win.shape[0] - BLOCK_PX) // 2
    steps = min(pad, int(SHADOW_DIST_M / px))
    rows, cols = np.indices((BLOCK_PX, BLOCK_PX)) + pad
    z0, tan_el = center(win), math.tan(math.radians(sun_el_deg))
    total = 0.0
    for az in AZIMUTHS:
        dx, dy = math.sin(math.radians(az)), -math.cos(math.radians(az)) # cols go east, rows go south
        shadow = np.zeros(z0.shape, bool)
        for s in range(1, steps + 1):
            r, c = np.rint(rows + dy * s).astype(int), np.rint(cols + dx * s).astype(int)
            shadow |= (win[r, c] - z0) / (s * px) > tan_el
        total += shadow.mean()
    return total / len(AZIMUTHS)


def features(win: np.ndarray, sun_el_deg: float = 1.5, px: float = RES_M) -> dict[str, float]:
    z = center(win)
    slope = center(slope_deg(win, px))
    lo, hi = np.percentile(z, [2, 98]) # percentiles so one spike doesnt set the relief
    out = {
        "relief_m": float(hi - lo),
        "slope_med_deg": float(np.median(slope)),
        "slope_p90_deg": float(np.percentile(slope, 90)),
    }
    # ROUGHNESS:
    for base_m in (150, 1500):
        k = max(3, int(round(base_m / px)) | 1)
        out[f"rms_{base_m}m"] = float(np.sqrt(np.mean(center(win - box_mean(win, k)) ** 2)))
    zmin, zmax = float(z.min()), float(z.max())
    out["hypsometric"] = float((z.mean() - zmin) / (zmax - zmin)) if zmax > zmin else 0.5
    out["shadow"] = float(shadow_fraction(win, sun_el_deg, px))
    return out
