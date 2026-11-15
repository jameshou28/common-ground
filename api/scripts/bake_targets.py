# bakes the moon targets from the lola 5 m site files in cache/ into targets.json and the grids
# run from api/: uv run python -m scripts.bake_targets
# needs cache/Site{01,04}_{surf,ldec}.tif from nasa pgda (41 MB each)
import json
from pathlib import Path

import numpy as np
import rasterio
from pyproj import Transformer
from rasterio.enums import Resampling

from analog_core import grid
from analog_core.dem import BLOCK_PX, RES_M, read_window
from analog_core.features import features, slope_deg
from analog_core.tiles import tile_id

ROOT = Path(__file__).resolve().parents[1]
SUN = 1.5 # deg, lunar south pole lighting
SITES = { # target id: (site file, name, how to pick the 4 km block inside the 16 km file)
    "connecting_ridge": ("Site01", "Connecting Ridge (LOLA Site01)", "centre"),
    "shackleton_rim": ("Site04", "Shackleton rim (LOLA Site04)", "rim"),
}


def rim_window(surf: Path) -> tuple[float, float]:
    # site04 centre sits on the inner wall, so pick the calmest block that still has real wall in it
    # (15% of pixels steeper than 25 deg) so the rim crest crosses it
    with rasterio.open(surf) as ds:
        n = int(ds.width * ds.res[0] / RES_M) # 512 px at 31.25 m
        z = ds.read(1, out_shape=(n, n), resampling=Resampling.average).astype(np.float64)
        b = ds.bounds
    s = slope_deg(z)
    best = None
    lo, hi = BLOCK_PX // 2, n - BLOCK_PX - BLOCK_PX // 2 # keep the padded window inside the file
    for r in range(lo, hi + 1, 8):
        for c in range(lo, hi + 1, 8):
            blk = s[r:r + BLOCK_PX, c:c + BLOCK_PX]
            if (blk > 25).mean() >= 0.15:
                m = float(np.median(blk))
                if best is None or m < best[0]:
                    best = (m, r, c)
    m, r, c = best
    print(f"   rim search: median slope {m:.1f} deg at row {r}, col {c}")
    return b.left + (c + BLOCK_PX / 2) * RES_M, b.top - (r + BLOCK_PX / 2) * RES_M


def main():
    out = {}
    for tid, (site, name, how) in SITES.items():
        surf, ldec = ROOT / f"cache/{site}_surf.tif", ROOT / f"cache/{site}_ldec.tif"
        print(f"== {tid}")
        with rasterio.open(surf) as ds:
            b, crs = ds.bounds, ds.crs
        cx, cy = ((b.left + b.right) / 2, (b.bottom + b.top) / 2) if how == "centre" else rim_window(surf)
        lon, lat = Transformer.from_crs(crs, crs.geodetic_crs, always_xy=True).transform(cx, cy)
        win = read_window("moon", lat, lon, src=str(surf))
        f = features(win.dem, SUN)
        with rasterio.open(ldec) as ds: # returns per 5 m pixel, 0 means interpolated
            half = BLOCK_PX * RES_M / 2
            w = rasterio.windows.from_bounds(cx - half, cy - half, cx + half, cy + half, ds.transform)
            measured = float((ds.read(1, window=w) > 0).mean())
        t = tile_id("moon", lat, lon)
        (ROOT / "cache/grids").mkdir(parents=True, exist_ok=True)
        (ROOT / f"cache/grids/{t}.bin").write_bytes(grid.encode(win.block))
        out[tid] = dict(id=tid, world="moon", name=name, lat=round(lat, 5), lon=round(lon, 5), tile_id=t,
                        sun_elevation_deg=SUN, dem_source="LOLA 5 m (Barker et al. 2021)", resolution_m=5.0,
                        measured_share=round(measured, 3), features={k: round(v, 4) for k, v in f.items()})
        print(f"   {lat:.4f}, {lon:.4f}  {t}  measured {measured:.2f}\n   {out[tid]['features']}")
    (ROOT / "targets.json").write_text(json.dumps(out, indent=2) + "\n")
    print("wrote targets.json")


if __name__ == "__main__":
    main()
