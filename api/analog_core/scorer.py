import math
import os
import urllib.request
from functools import lru_cache
from pathlib import Path

import numpy as np

from .dem import NoTerrain, UpstreamError
from .ml import readers, runtime
from .tiles import tile_center

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


def library_block(index: int, pad_px: int = 0) -> np.ndarray:
    # the matched moon or mars block as a 128 px grid, read live from its source dem (about 1 s).
    # pad_px keeps that much margin on every side (128 + 2 pad_px), so the site can shift it to line up with the click
    m = model()
    if not 0 <= index < len(m.lib_world):
        raise IndexError(index)
    try:
        if pad_px:
            return readers.library_block_dem(m, index, pad_px=pad_px).astype(np.float32)
        return readers.library_block_dem(m, index).astype(np.float32)
    except Exception as e:
        raise UpstreamError(f"{type(e).__name__}: {e}") from e
