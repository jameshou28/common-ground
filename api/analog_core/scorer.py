import math
import os
import urllib.request
from functools import lru_cache
from pathlib import Path

import numpy as np

from .dem import NoTerrain, UpstreamError
from .ml import readers, runtime
from .tiles import tile_center, tile_id as tile_id_of

# model.npz comes from MODEL_PATH, the repo's ml/export, or MODEL_URL (r2) downloaded once into the cache
CACHE = Path(os.environ.get("CACHE_DIR") or Path(__file__).resolve().parents[1] / "cache")
REPO_MODEL = Path(__file__).resolve().parents[2] / "ml/export/model.npz"
MODEL_PATH = Path(os.environ.get("MODEL_PATH") or (REPO_MODEL if REPO_MODEL.exists() else CACHE / "model.npz"))
MODEL_URL = os.environ.get("MODEL_URL", "")
SITE_BLOCK = slice(64, 192) # the 4 km block inside the padded site window


class NoModel(Exception):
    pass


@lru_cache(maxsize=1)
def model() -> runtime.Model:
    if not MODEL_PATH.exists():
        if not MODEL_URL:
            raise NoModel(f"no model at {MODEL_PATH} and MODEL_URL is empty")
        MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
        tmp = MODEL_PATH.with_suffix(".part")
        urllib.request.urlretrieve(MODEL_URL, tmp)
        tmp.replace(MODEL_PATH)
    return runtime.load(MODEL_PATH)


def _clean(o):
    # json has no nan, precip is nan where worldclim has no value
    if isinstance(o, float):
        return None if math.isnan(o) else o
    if isinstance(o, dict):
        return {k: _clean(v) for k, v in o.items()}
    if isinstance(o, list):
        return [_clean(v) for v in o]
    return o


def score_tile(tile_id: str) -> tuple[dict, np.ndarray]:
    # raises NoTerrain for ocean or lakes, UpstreamError when a bucket read fails
    m = model()
    _, lat, lon = tile_center(tile_id)
    try:
        dems, env = readers.fetch_earth(m, lat, lon)
    except ValueError as e:
        if str(e).startswith("no_terrain"):
            raise NoTerrain(str(e)) from e
        raise UpstreamError(str(e)) from e
    except Exception as e: # rasterio, urllib, ssl
        raise UpstreamError(f"{type(e).__name__}: {e}") from e
    result = runtime.score_click(m, dems, env)
    result["env"] = env
    # fetch_earth already refused blocks without site terrain
    return _clean(result), dems["site"][SITE_BLOCK, SITE_BLOCK].astype(np.float32)


# ponytail: fixed stand-in until victors runtime has earth_matches(model, world, lat, lon) -> [dict(name, lat, lon, score)]
DUMMY_EARTH = (("McMurdo Dry Valleys", -77.52, 161.8), ("Haughton crater", 75.38, -89.67),
               ("Meteor Crater", 35.027, -111.022), ("Lanzarote Timanfaya", 29.0, -13.75),
               ("Holuhraun lava field", 64.87, -16.83), ("Utah near MDRS", 38.4, -110.8))


def earth_matches(tile_id: str) -> dict:
    # a moon or mars block -> the earth places that look most like it, best first
    m = model()
    world, lat, lon = tile_center(tile_id)
    fn = getattr(runtime, "earth_matches", None)
    if fn:
        matches, dummy = fn(m, world, lat, lon), False
    else:
        matches, dummy = [dict(name=n, lat=a, lon=o, score=90.0 - 8 * i) for i, (n, a, o) in enumerate(DUMMY_EARTH)], True
    for s in matches:
        s.setdefault("tile_id", tile_id_of("earth", s["lat"], s["lon"]))
    return _clean(dict(model_version=m.version, dummy=dummy, matches=matches))


def library_block(index: int) -> np.ndarray:
    # the matched moon or mars block as a 128 px grid, read live from its source dem (about 1 s)
    m = model()
    if not 0 <= index < len(m.lib_world):
        raise IndexError(index)
    try:
        return readers.library_block_dem(m, index).astype(np.float32)
    except Exception as e:
        raise UpstreamError(f"{type(e).__name__}: {e}") from e
