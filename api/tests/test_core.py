import math

import numpy as np
import pytest

from analog_core import grid, scorer
from analog_core.dem import WINDOW_PX, Window, center, local_xy
from analog_core.features import features, slope_deg
from analog_core.tiles import TILE_RE, tile_center, tile_id

X, Y = local_xy()


def test_tile_ids_round_trip():
    assert tile_id("earth", 35.0275, -111.0225) == "earth:g:974:-2527" # meteor crater
    assert tile_id("moon", -89.4632, -137.4896) == "moon:ps:s:-3:-3"
    rng = np.random.default_rng(0)
    for world in ("earth", "moon", "mars"):
        for lat, lon in zip(rng.uniform(-89.9, 89.9, 300), rng.uniform(-180, 180, 300)):
            t = tile_id(world, lat, lon)
            assert TILE_RE.match(t), t
            w, clat, clon = tile_center(t)
            assert tile_id(w, clat, clon) == t
    with pytest.raises(ValueError):
        tile_center("earth:g:99999:0")


def test_grid_round_trip():
    z = np.random.default_rng(1).normal(1500, 300, (128, 128)).astype(np.float32)
    b = grid.encode(z)
    assert len(b) == 32776 # 8 byte header + 128 * 128 * 2
    assert np.abs(grid.decode(b) - z).max() <= (z.max() - z.min()) / 65535


def test_features_match_analytic_shapes():
    flat = features(np.zeros((WINDOW_PX, WINDOW_PX)))
    assert flat["slope_med_deg"] == 0 and flat["relief_m"] == 0 and flat["shadow"] == 0

    ramp = features(X * math.tan(math.radians(20)))
    assert ramp["slope_med_deg"] == pytest.approx(20, rel=0.02)
    assert ramp["relief_m"] == pytest.approx(0.96 * 4000 * math.tan(math.radians(20)), rel=0.02) # p98 - p2

    hill = 300 * np.exp(-(X ** 2 + Y ** 2) / (2 * 800 ** 2))
    peak_slope = math.degrees(math.atan(300 / 800 * math.exp(-0.5))) # steepest at r = sigma
    assert center(slope_deg(hill)).max() == pytest.approx(peak_slope, rel=0.02)
    assert features(hill)["relief_m"] == pytest.approx(300, rel=0.1)


def test_wall_shadows_low_sun():
    # 500 m wall 100 m east of the block, shadow search reaches 2 km
    # sun due east shadows x > 100 m (47.5%), ne and se reach 1414 m (x > 686 m, 33%), the rest see no wall
    z = np.where(X > 2100, 500.0, 0.0)
    assert features(z, sun_el_deg=1.5)["shadow"] == pytest.approx((0.475 + 2 * 0.3285) / 8, abs=0.01)
    # sun above the wall's angular height (atan(500 / 100 m) = 79 deg) casts nothing
    assert features(z, sun_el_deg=80)["shadow"] == 0


def hill_window():
    return Window((200 * np.exp(-(X ** 2 + Y ** 2) / (2 * 900 ** 2))).astype(np.float32), 30.0, "synthetic", 1.0)


def test_contributions_sum_to_logit():
    for target in scorer.TARGETS:
        r = scorer.score_window(hill_window(), target)
        eta = r["bias"] + sum(c["contribution"] for c in r["contributions"])
        assert eta == pytest.approx(math.log(r["score"] / (100 - r["score"])), abs=1e-6)
        assert 0 < r["score"] < 100


def test_target_scores_itself_at_the_bias(monkeypatch):
    for tid, tgt in scorer.TARGETS.items():
        monkeypatch.setattr(scorer, "features", lambda *a, tgt=tgt, **k: tgt["features"])
        r = scorer.score_window(hill_window(), tid)
        assert r["score"] == pytest.approx(100 / (1 + math.exp(-scorer.BIAS)))
