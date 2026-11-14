import os
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path

# gdal settings, set before rasterio loads so range reads stay quick
for _k, _v in {
    "GDAL_DISABLE_READDIR_ON_OPEN": "EMPTY_DIR",
    "CPL_VSIL_CURL_ALLOWED_EXTENSIONS": ".tif",
    "GDAL_HTTP_MULTIRANGE": "YES",
    "GDAL_HTTP_MERGE_CONSECUTIVE_RANGES": "YES",
    "GDAL_HTTP_MAX_RETRY": "3",
    "GDAL_HTTP_RETRY_DELAY": "1",
    "VSI_CACHE": "TRUE",
    "VSI_CACHE_SIZE": "67108864",
    "GDAL_CACHEMAX": "256",
}.items():
    os.environ.setdefault(_k, _v)

import numpy as np
import rasterio
from pyproj import CRS, Transformer
from rasterio.errors import RasterioIOError
from rasterio.windows import Window as RWindow
from scipy import ndimage

from .tiles import RADIUS_M

RES_M = 31.25
WINDOW_PX = 256 # 8 km, the 4 km block plus 2 km margin for shadows
BLOCK_PX = 128
GLO30 = "https://copernicus-dem-30m.s3.amazonaws.com"
CACHE = Path(os.environ.get("CACHE_DIR", Path(__file__).resolve().parents[1] / "cache"))


class NoTerrain(Exception):
    pass # ocean or mostly water


@dataclass
class Window:
    dem: np.ndarray # (256, 256) metres, row 0 = north, no nans
    resolution_m: float # source res before resampling
    source: str
    valid_share: float # how much of the centre block is real land

    @property
    def block(self) -> np.ndarray:
        return center(self.dem)


def center(a: np.ndarray) -> np.ndarray:
    p = (a.shape[0] - BLOCK_PX) // 2
    return a[p:p + BLOCK_PX, p:p + BLOCK_PX]


def local_xy(n: int = WINDOW_PX, res: float = RES_M):
    # x east, y north of the window centre in metres
    c = (np.arange(n) - (n - 1) / 2) * res
    return np.meshgrid(c, -c)


def glo30_name(lat_floor: int, lon_floor: int) -> str:
    ns, ew = ("N" if lat_floor >= 0 else "S"), ("E" if lon_floor >= 0 else "W")
    return f"Copernicus_DSM_COG_10_{ns}{abs(lat_floor):02d}_00_{ew}{abs(lon_floor):03d}_00_DEM"


def _sample(path: str, xs: np.ndarray, ys: np.ndarray, dst_res: float) -> tuple[np.ndarray, float]:
    # bilinear sample at points given in the raster's own crs, nan outside it
    with rasterio.open(path) as ds:
        dx, dy = abs(ds.res[0]), abs(ds.res[1])
        # degrees to metres on the raster's own body (mars is in degrees)
        native = dx if ds.crs.is_projected else np.radians(dy) * CRS.from_user_input(ds.crs).ellipsoid.semi_major_metre
        pad = 3 + (int(dst_res / native) if native < dst_res else 0)
        c0, r0 = ~ds.transform * (xs.min(), ys.max())
        c1, r1 = ~ds.transform * (xs.max(), ys.min())
        w = RWindow(int(c0) - pad, int(r0) - pad, int(c1 - c0) + 2 * pad + 2, int(r1 - r0) + 2 * pad + 2)
        try:
            w = w.intersection(RWindow(0, 0, ds.width, ds.height))
        except rasterio.errors.WindowError:
            return np.full(xs.shape, np.nan, np.float32), native
        arr = ds.read(1, window=w, out_dtype="float32", masked=True).filled(np.nan)
        arr = arr * ds.scales[0] + ds.offsets[0] # int16 mosaics store 0.5 m counts
        t = ds.window_transform(w)
    factor = dst_res / native
    if factor > 1.5: # blur before downsampling so fine dems dont alias
        bad = np.isnan(arr)
        arr = ndimage.gaussian_filter(np.where(bad, np.nanmean(arr) if not bad.all() else 0, arr), 0.5 * factor)
        arr[bad] = np.nan
    col = (xs - t.c) / t.a - 0.5
    row = (ys - t.f) / t.e - 0.5
    out = ndimage.map_coordinates(arr, [row, col], order=1, mode="nearest").astype(np.float32)
    h, wd = arr.shape
    out[(row < -0.5) | (row > h - 0.5) | (col < -0.5) | (col > wd - 0.5)] = np.nan
    return out, native


def read_window(world: str, lat: float, lon: float, src: str | None = None,
                n: int = WINDOW_PX, res: float = RES_M) -> Window:
    R = RADIUS_M[world]
    aeqd = CRS.from_proj4(f"+proj=aeqd +lat_0={lat} +lon_0={lon} +R={R} +units=m +no_defs") # sphere, same as training
    X, Y = local_xy(n, res)

    if src is not None:
        with rasterio.open(src) as ds:
            src_crs = ds.crs
        xs, ys = Transformer.from_crs(aeqd, src_crs, always_xy=True).transform(X, Y)
        dem, native = _sample(src, xs, ys, res)
        source = Path(src).name
    else:
        if world != "earth":
            raise NoTerrain(f"no live dem for {world}")
        geo = CRS.from_proj4(f"+proj=longlat +R={R} +no_defs")
        lon_g, lat_g = Transformer.from_crs(aeqd, geo, always_xy=True).transform(X, Y)
        lon_g = (lon_g + 180.0) % 360.0 - 180.0
        lat_f, lon_f = np.floor(lat_g).astype(int), np.floor(lon_g).astype(int)
        wanted = list({(int(a), int(b)) for a, b in zip(lat_f.ravel(), lon_f.ravel())})
        dem = np.full(X.shape, np.nan, np.float32)

        def one(tile):
            la, lo = tile
            name = glo30_name(la, lo)
            sel = (lat_f == la) & (lon_f == lo)
            try:
                return sel, _sample(f"/vsicurl/{GLO30}/{name}/{name}.tif", lon_g[sel], lat_g[sel], res)[0]
            except RasterioIOError:
                return sel, np.full(int(sel.sum()), np.nan, np.float32) # no tile, so ocean

        # one range read per tile, in parallel
        with ThreadPoolExecutor(len(wanted)) as ex:
            for sel, part in ex.map(one, wanted):
                dem[sel] = part
        native, source = 30.0, "Copernicus GLO-30"

    blk = center(dem)
    bad = np.isnan(blk)
    if src is None:
        # glo30 flattens water, pixels equal to both neighbours
        flat = np.zeros_like(bad)
        flat[:-1, :-1] = (blk[:-1, :-1] == blk[:-1, 1:]) & (blk[:-1, :-1] == blk[1:, :-1])
        bad = bad | flat
    valid = 1.0 - float(bad.mean())
    if valid < 0.5:
        raise NoTerrain(f"only {valid:.0%} of the block is land")
    nan = np.isnan(dem)
    if nan.any(): # fill gaps with nearest pixel so slopes stay defined
        idx = ndimage.distance_transform_edt(nan, return_distances=False, return_indices=True)
        dem = dem[tuple(idx)]
    return Window(dem, round(float(native), 2), source, valid)
