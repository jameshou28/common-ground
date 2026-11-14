import json
import math
import os
from pathlib import Path

import numpy as np

from .dem import BLOCK_PX, RES_M, Window, read_window
from .features import features, slope_deg
from .tiles import tile_center

# @victor add ur model when its done
MODEL_VERSION = os.environ.get("MODEL_VERSION", "stub-0.1")
TARGETS: dict = json.loads((Path(__file__).resolve().parents[1] / "targets.json").read_text())
CELLS = 8
BIAS = 2.0 # a block identical to the target scores sigmoid(2) = 88

# key: (label, unit, group, kind, weight)
# ratio = |ln(value / target)|, diff = |value - target|
TERMS = {
    "relief_m": ("Relief", "m", "shape", "ratio", 0.6),
    "slope_med_deg": ("Median slope", "deg", "slope", "ratio", 0.6),
    "slope_p90_deg": ("Steep slopes (p90)", "deg", "slope", "ratio", 0.6),
    "rms_150m": ("Roughness at 150 m", "m", "roughness", "ratio", 0.4),
    "rms_1500m": ("Roughness at 1.5 km", "m", "roughness", "ratio", 0.4),
    "hypsometric": ("Hypsometric integral", "", "shape", "diff", 3.0),
    "shadow": ("Shadow at target Sun", "share", "light", "diff", 3.0),
}


class UnknownTarget(Exception):
    pass


def _landform(slope_mean: float, relief: float) -> str:
    if slope_mean < 3:
        return "flat plain"
    if slope_mean > 25:
        return "steep slope"
    return "ridge or rim" if relief > 150 else "mixed slopes"


def score_window(win: Window, target_id: str) -> dict:
    # takes already read window so tests and bakes need no network
    if target_id not in TARGETS:
        raise UnknownTarget(target_id)
    tgt = TARGETS[target_id]
    f = features(win.dem, tgt["sun_elevation_deg"])

    # every term pulls the score down by weight * distance, so the bars sum to the logit
    contributions, eta = [], BIAS
    for key, (label, unit, group, kind, w) in TERMS.items():
        v, t = f[key], tgt["features"][key]
        d = abs(math.log((v + 0.1) / (t + 0.1))) if kind == "ratio" else abs(v - t)
        eta -= w * d
        contributions.append(dict(key=key, label=label, group=group, value=v, target_value=t,
                                  distance=d, percentile=None, contribution=-w * d, unit=unit))
    score = 100.0 / (1.0 + math.exp(-eta))

    # CELLS: 8 x 8 cells of 500 m, cost = how far the cell's slope is from the target's median slope
    px = BLOCK_PX // CELLS
    cell = lambda a, fn: fn(a.reshape(CELLS, px, CELLS, px), axis=(1, 3))
    s_mean = cell(_center_slope(win), np.mean)
    relief = cell(win.block, np.max) - cell(win.block, np.min)
    cost = np.abs(s_mean - tgt["features"]["slope_med_deg"])

    return dict(
        target_id=target_id, model_version=MODEL_VERSION,
        score=score, score_range=dict(low=score, high=score),
        percentile=None, typicality=None, typicality_percentile=None,
        physics_score=score, bias=BIAS, contributions=contributions,
        cell_cost=cost.tolist(),
        cell_landform=[[_landform(s_mean[r, c], relief[r, c]) for c in range(CELLS)] for r in range(CELLS)],
        cell_local=[[dict(slope_mean=round(float(s_mean[r, c]), 2), cell_relief=round(float(relief[r, c]), 1))
                     for c in range(CELLS)] for r in range(CELLS)],
        nearest_analog=None,
        confidence="lower" if (win.resolution_m > 1.1 * RES_M or win.valid_share < 0.9) else "normal",
        ood=False,
        dem_source=win.source, resolution_m=win.resolution_m,
    )


def _center_slope(win: Window) -> np.ndarray:
    p = (win.dem.shape[0] - BLOCK_PX) // 2
    return slope_deg(win.dem)[p:p + BLOCK_PX, p:p + BLOCK_PX]


def score_tile(tile_id: str, target_id: str) -> tuple[dict, np.ndarray]:
    # raises NoTerrain (ocean or mostly water) or UnknownTarget
    if target_id not in TARGETS:
        raise UnknownTarget(target_id)
    world, lat, lon = tile_center(tile_id)
    win = read_window(world, lat, lon)
    return score_window(win, target_id), win.block.astype(np.float32)
