# worker functions for discover.ipynb (in a module so process pools can import them)
import os, sys
from pathlib import Path

os.environ.setdefault("GDAL_HTTP_TIMEOUT", "45")           # a stuck read must not hang a worker all night
os.environ.setdefault("GDAL_HTTP_CONNECTTIMEOUT", "15")
sys.path.insert(0, str(Path(__file__).resolve().parent / "export"))

import numpy as np
import rasterio, rasterio.enums, rasterio.windows
from scipy.special import expit

import analog_runtime as rt
import analog_readers as rd

_M = {}


def get_model(path):
    m = _M.get(path)
    if m is None:
        m = _M[path] = rt.load(path)
        rd.glo30_tiles(Path(__file__).resolve().parent / "datasets/glo30_tileList.txt")   # local copy of the tile list
    return m


def surface_score(m, env):
    # the 0-100 surface score, the same formula as score_click
    G, _ = rt.conditions(m, env)
    return float(min(100.0, 100.0 * 100.0 * expit(G) / m.surface_max))


def coarse_cover(lat, lon, half_m, px=96):
    # rd.worldcover_shares over a wide window, read decimated so it's one small request. None when there's no tile
    dlat = np.degrees(half_m / rt.RADIUS_M["earth"])
    dlon = dlat / max(np.cos(np.radians(lat)), 1e-3)
    la0, lo0 = int(np.floor(lat / 3) * 3), int(np.floor(lon / 3) * 3)
    name = f"ESA_WorldCover_10m_2021_v200_{'N' if la0 >= 0 else 'S'}{abs(la0):02d}{'E' if lo0 >= 0 else 'W'}{abs(lo0):03d}_Map.tif"
    try:
        with rasterio.Env(**rd.GDAL_ENV), rasterio.open(f"/vsicurl/{rd.WORLDCOVER}/{name}") as ds:
            w = rasterio.windows.from_bounds(lon - dlon, lat - dlat, lon + dlon, lat + dlat, ds.transform)
            w = w.round_offsets().round_lengths().intersection(rasterio.windows.Window(0, 0, ds.width, ds.height))
            a = ds.read(1, window=w, out_shape=(max(1, min(px, int(w.height))), max(1, min(px, int(w.width)))),
                        resampling=rasterio.enums.Resampling.nearest)
    except Exception:
        return None
    a = a[a > 0]
    if a.size == 0:
        return None
    s = {n: float(np.mean(a == k)) for k, n in rd.WC.items()}
    return dict(tree=s["tree"] + s["mangrove"], crop=s["crop"], built=s["built"], water=s["water"] + s["wetland"],
                snow=s["snow"], bare=s["bare"], sparse=s["shrub"] + s["grass"] + s["moss"])


def _key(lat, lon):
    return f"{lat:.4f},{lon:.4f}"


def screen_task(args):
    # stage 1: one 32 km cell. surface first (one small read); terrain only if the surface could pass
    path, lat, lon, surface_min = args
    row = dict(key=_key(lat, lon), lat=lat, lon=lon, status="ok")
    for attempt in range(2):
        try:
            m = get_model(path)
            env = coarse_cover(lat, lon, 16000.0) or {n: np.nan for n in rd.WC_NAMES}
            env["precip"] = rt.precip_at(m, lat, lon)
            row.update(surface=surface_score(m, env), snow=env.get("snow", np.nan), precip=env["precip"])
            if row["surface"] < surface_min:
                row["status"] = "low_surface"
                return row
            dem = rd.read_glo30_window(lat, lon, rt.SCALES["regional"]["res"])
            if np.isnan(dem).mean() > 0.4 or rd.flat_fraction(np.nan_to_num(dem, nan=-1e9)) > 0.5:
                row["status"] = "no_terrain"
                return row
            emb = rt.embed(m, {"regional": dem}, rt.RADIUS_M["earth"])
            for w in rt.WORLDS:
                for reg in rt.region_scores(m, emb, w, n_best=1):
                    row[reg["region"]] = reg["score"]
            return row
        except Exception as e:
            row["status"] = f"error: {type(e).__name__}: {str(e)[:80]}"
    return row


def full_task(args):
    # stages 2 and 3: one 4 km block scored exactly like a click
    path, lat, lon, source = args
    row = dict(key=_key(lat, lon), lat=lat, lon=lon, status="ok", source=source)
    for attempt in range(2):
        try:
            m = get_model(path)
            dems, env = rd.fetch_earth(m, lat, lon)
            r = rt.score_click(m, dems, env, n_best=1)
            row.update(status="ok", surface=r["conditions"]["score"], snow=env.get("snow", np.nan), ood=int(r["ood"]),
                       scales="+".join(r["scales_used"]))
            for W in r["worlds"].values():
                for reg in W["regions"]:
                    row[reg["region"]] = reg["score"]
                    lf = reg.get("landform")
                    if lf:
                        row["lf_" + reg["region"]] = f"{lf['tag']}:{lf['score']:.1f}:{int(lf['validated'])}"
            return row
        except ValueError as e:
            if str(e).startswith("no_terrain"):
                row["status"] = "no_terrain"
                return row
            row["status"] = f"error: ValueError: {str(e)[:80]}"
        except Exception as e:
            row["status"] = f"error: {type(e).__name__}: {str(e)[:80]}"
    return row
