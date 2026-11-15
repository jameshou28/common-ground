#most things here will be fetched with a s3 bucket 
from __future__ import annotations

import ssl
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import rasterio
import rasterio.enums
import rasterio.windows
from pyproj import CRS, Transformer
from scipy import ndimage

import analog_runtime as rt

GDAL_ENV = dict(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif,.TIF",
                GDAL_HTTP_MULTIPLEX="YES", GDAL_HTTP_MULTIRANGE="YES", GDAL_HTTP_MERGE_CONSECUTIVE_RANGES="YES",
                GDAL_HTTP_MAX_RETRY="3", GDAL_HTTP_RETRY_DELAY="1", VSI_CACHE="TRUE", VSI_CACHE_SIZE="67108864")
GLO30 = "https://copernicus-dem-30m.s3.amazonaws.com"
WORLDCOVER = "https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map"
GLOBAL_DEM = {   # the regional scale on the Moon and Mars (library building only)
    "moon": "/vsicurl/https://planetarymaps.usgs.gov/mosaic/Lunar_LRO_LOLA_Global_LDEM_118m_Mar2014.tif",
    "mars": "/vsicurl/https://planetarymaps.usgs.gov/mosaic/Mars/HRSC_MOLA_Blend/Mars_HRSC_MOLA_BlendDEM_Global_200mp_v2.tif",
}
POLAR_DEM = {   # Moon south of 80S: polar stereographic LOLA, readable all the way to the pole
    "site": "https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF",
    "regional": "https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF",
}
POLAR_LAT = -80.0
UA = "Mozilla/5.0 (analog-explorer)"
WC = {10: "tree", 20: "shrub", 30: "grass", 40: "crop", 50: "built", 60: "bare", 70: "snow",
      80: "water", 90: "wetland", 95: "mangrove", 100: "moss"}
WC_NAMES = ("tree", "crop", "built", "water", "snow", "bare", "sparse")
_TILES = None
# v2.1 speed: the reads for one click run at the same time. rasterio/GDAL release the GIL while waiting on the network.
# two pools so a window waiting on its tiles can never block the tiles themselves
_READ_POOL = ThreadPoolExecutor(6, thread_name_prefix="read")
_TILE_POOL = ThreadPoolExecutor(12, thread_name_prefix="tile")


def http(url, body=None, timeout=60, tries=3, headers=None):
    ctx = ssl.create_default_context()
    try:
        import certifi
        ctx = ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        pass
    for t in range(tries):
        try:
            hdr = {"User-Agent": UA, **({"Content-Type": "application/json"} if body else {}), **(headers or {})}
            with urllib.request.urlopen(urllib.request.Request(url, data=body, headers=hdr), context=ctx, timeout=timeout) as r:
                return r.read()
        except Exception:
            if t == tries - 1:
                raise
            time.sleep(1 + 2 * t)


# ---------------------------------------------------------------- the common local grid

def window_lonlat(lat, lon, R, res, n_px=rt.WINDOW_PX):
    c = (np.arange(n_px) - (n_px - 1) / 2) * res
    X, Y = np.meshgrid(c, -c)            # x east, y north; row 0 is north
    aeqd = CRS.from_proj4(f"+proj=aeqd +lat_0={lat} +lon_0={lon} +R={R} +units=m +no_defs")
    geo = CRS.from_proj4(f"+proj=longlat +R={R} +no_defs")
    return Transformer.from_crs(aeqd, geo, always_xy=True).transform(X, Y)


def read_raster_window(href, lat, lon, R, res, max_nodata=0.02):
    lon_g, lat_g = window_lonlat(lat, lon, R, res)
    with rasterio.Env(**GDAL_ENV), rasterio.open(href) as ds:
        crs = CRS.from_wkt(ds.crs.to_wkt())
        if crs.is_projected:
            xs, ys = Transformer.from_crs(crs.geodetic_crs, crs, always_xy=True).transform(lon_g, lat_g)
            native = abs(ds.res[0])
        else:
            xs, ys = lon_g, lat_g
            if ds.bounds.right > 180.5:                      # a 0..360 raster
                xs = np.mod(xs, 360.0)
            native = abs(ds.res[1]) * np.pi / 180.0 * R
        cols, rows = ~ds.transform * (xs, ys)
        cols, rows = np.asarray(cols) - 0.5, np.asarray(rows) - 0.5        # pixel-centre coordinates
        c0, c1 = int(np.floor(cols.min())) - 3, int(np.ceil(cols.max())) + 4
        r0, r1 = int(np.floor(rows.min())) - 3, int(np.ceil(rows.max())) + 4
        if c0 < 0 or r0 < 0 or c1 > ds.width or r1 > ds.height:
            raise ValueError("window leaves the raster")
        if (c1 - c0) > 0.4 * ds.width or (c1 - c0) * (r1 - r0) > 30_000_000:
            raise ValueError("window crosses the map edge or is too close to a pole")
        a = ds.read(1, window=rasterio.windows.Window(c0, r0, c1 - c0, r1 - r0), masked=True)
    z = a.astype(np.float64).filled(np.nan)
    z[z < -30000] = np.nan
    bad = ndimage.map_coordinates(np.isnan(z).astype(float), [rows - r0, cols - c0], order=1, mode="nearest")
    if (bad > 0.5).mean() > max_nodata:
        raise ValueError("too much nodata")
    z = rt.fill_nans(z)
    factor = res / native
    if factor > 1.2:
        z = ndimage.gaussian_filter(z, 0.5 * factor)
    return ndimage.map_coordinates(z, [rows - r0, cols - c0], order=1, mode="nearest"), native


#  Earth terrain: Copernicus GLO-30

def glo30_tile_name(la, lo):
    return f"Copernicus_DSM_COG_10_{'N' if la >= 0 else 'S'}{abs(la):02d}_00_{'E' if lo >= 0 else 'W'}{abs(lo):03d}_00_DEM"


def glo30_tiles(cache_path=None):
    # Names of the tiles that exist (land). Fetched once; pass cache_path to keep a local copy.
    global _TILES
    if _TILES is None:
        if cache_path is not None and cache_path.exists():
            text = cache_path.read_text()
        else:
            text = http(f"{GLO30}/tileList.txt").decode()
            if cache_path is not None:
                cache_path.write_text(text)
        _TILES = {s.strip() for s in text.splitlines() if s.strip()}
    return _TILES


def read_glo30_window(lat, lon, res):
    R = rt.RADIUS_M["earth"]
    lon_g, lat_g = window_lonlat(lat, lon, R, res)
    lon_g = (lon_g + 180.0) % 360.0 - 180.0
    out = np.full(lon_g.shape, np.nan)
    lat_f, lon_f = np.floor(lat_g).astype(int), np.floor(lon_g).astype(int)
    tiles = glo30_tiles()

    def one(la, lo):
        # one GLO-30 tile's part of the window: (selection mask, heights), or None when the tile doesn't exist (sea)
        name = glo30_tile_name(la, lo)
        if name not in tiles:
            return None
        sel = (lat_f == la) & (lon_f == lo)
        with rasterio.Env(**GDAL_ENV), rasterio.open(f"/vsicurl/{GLO30}/{name}/{name}.tif") as ds:
            dx, dy = ds.res
            w = rasterio.windows.from_bounds(lon_g[sel].min() - 9 * dx, lat_g[sel].min() - 9 * dy,
                                             lon_g[sel].max() + 9 * dx, lat_g[sel].max() + 9 * dy, ds.transform)
            w = w.round_offsets().round_lengths().intersection(rasterio.windows.Window(0, 0, ds.width, ds.height))
            native_m = dy * np.pi / 180.0 * R
            f = max((k for k in (1, 2, 4, 8) if k * native_m <= res), default=1)   # overview level
            shape = (max(1, int(round(w.height / f))), max(1, int(round(w.width / f))))
            arr = ds.read(1, window=w, out_shape=shape, resampling=rasterio.enums.Resampling.average).astype(np.float64)
            t = ds.window_transform(w)
        sx, sy = t.a * w.width / shape[1], t.e * w.height / shape[0]          # degrees per decimated pixel
        factor = res / (abs(sy) * np.pi / 180.0 * R)
        if factor > 1.2:
            arr = ndimage.gaussian_filter(arr, 0.5 * factor, mode="nearest")
        col = (lon_g[sel] - t.c) / sx - 0.5
        row = (lat_g[sel] - t.f) / sy - 0.5
        return sel, ndimage.map_coordinates(arr, [row, col], order=1, mode="nearest")

    # v2.1 speed: the 1-4 tiles a window touches are read at the same time
    keys = sorted({(int(a), int(b)) for a, b in zip(lat_f.ravel(), lon_f.ravel())})
    for got in _TILE_POOL.map(lambda k: one(*k), keys):
        if got is not None:
            out[got[0]] = got[1]
    return out


def flat_fraction(z):
    # Share of pixels identical to both neighbours: GLO-30 flattens water bodies.
    same = (z[:-1, :-1] == z[:-1, 1:]) & (z[:-1, :-1] == z[1:, :-1])
    return float(same.mean())


#  Earth surface: ESA WorldCover 2021

def worldcover_shares(lat, lon, half_m=2000.0):
    # Land-cover shares over the 4 km block: tree, crop, built, water, snow, bare. NaN when unknown.
    dlat = np.degrees(half_m / rt.RADIUS_M["earth"])
    dlon = dlat / max(np.cos(np.radians(lat)), 1e-3)
    la0, lo0 = int(np.floor(lat / 3) * 3), int(np.floor(lon / 3) * 3)
    name = f"ESA_WorldCover_10m_2021_v200_{'N' if la0 >= 0 else 'S'}{abs(la0):02d}{'E' if lo0 >= 0 else 'W'}{abs(lo0):03d}_Map.tif"
    try:
        with rasterio.Env(**GDAL_ENV), rasterio.open(f"/vsicurl/{WORLDCOVER}/{name}") as ds:
            w = rasterio.windows.from_bounds(lon - dlon, lat - dlat, lon + dlon, lat + dlat, ds.transform)
            w = w.round_offsets().round_lengths().intersection(rasterio.windows.Window(0, 0, ds.width, ds.height))
            a = ds.read(1, window=w)
    except Exception:
        # no tile. Antarctica (WorldCover stops at 60 S): no trees, crops, buildings or open water down there, and the
        # split between ice and bare rock is unknown (the surface head reads unknown as typical). elsewhere: all unknown
        if lat < -60.0:
            return dict(tree=0.0, crop=0.0, built=0.0, water=0.0, snow=np.nan, bare=np.nan, sparse=np.nan)
        return {n: np.nan for n in WC_NAMES}
    a = a[a > 0]
    if a.size == 0:
        return {n: np.nan for n in WC_NAMES}
    s = {name: float(np.mean(a == k)) for k, name in WC.items()}
    return dict(tree=s["tree"] + s["mangrove"], crop=s["crop"], built=s["built"],
                water=s["water"] + s["wetland"], snow=s["snow"], bare=s["bare"],
                sparse=s["shrub"] + s["grass"] + s["moss"])     # shrubland, grassland, moss and lichen


#  one click, start to finish

def fetch_earth(model, lat, lon, scales=None):
    # Everything score_click needs for an Earth coordinate: ({scale: padded DEM}, env dict).
    # v2.1 speed: both elevation windows and the land cover are read at the same time (they used to go one by one)
    futs = {s: _READ_POOL.submit(read_glo30_window, lat, lon, rt.SCALES[s]["res"]) for s in (scales or model.scales)}
    f_env = _READ_POOL.submit(worldcover_shares, lat, lon)
    dems = {s: f.result() for s, f in futs.items()}
    site = dems.get("site", next(iter(dems.values())))
    if np.isnan(site).mean() > 0.5 or flat_fraction(np.nan_to_num(site, nan=-1e9)) > 0.5:
        raise ValueError("no_terrain: the block is mostly ocean, lake or missing data")
    for s in list(dems):
        if np.isnan(dems[s]).mean() > 0.6:
            del dems[s]                                  # e.g. a small island: no regional context
    env = f_env.result()
    env["precip"] = rt.precip_at(model, lat, lon)
    env["aridity"] = rt.aridity_at(model, lat, lon)      # v2.1, from the grid inside model.npz
    return dems, env


def score_latlon(model, lat, lon, **kw):
    dems, env = fetch_earth(model, lat, lon)
    out = rt.score_click(model, dems, env, **kw)
    out["env"] = env
    return out


def library_block_dem(model, index, scale="site", pad_px=0):
    # The matched Moon or Mars block as a (128, 128) height grid, read from its source DEM (about 1 s).
    # pad_px (at most PAD_PX) keeps that much margin on every side, so the viewer can shift the block to line it up
    world, lat = str(model.lib_world[index]), float(model.lib_lat[index])
    href = str(model.lib_href[index]) if scale == "site" else GLOBAL_DEM[world]
    if scale != "site" and world == "moon" and lat <= POLAR_LAT:
        href = POLAR_DEM[scale]
    dem, _ = read_raster_window(href, float(model.lib_lat[index]), float(model.lib_lon[index]),
                                rt.RADIUS_M[world], rt.SCALES[scale]["res"], max_nodata=0.2)
    c = rt.PAD_PX - int(min(max(pad_px, 0), rt.PAD_PX))
    return dem[c:dem.shape[0] - c, c:dem.shape[1] - c]
