import json
import math
from pathlib import Path

import numpy as np
import pytest
from fastapi.testclient import TestClient

from analog_core import dem, grid, scorer
from analog_core.dem import WINDOW_PX, center, local_xy
from analog_core.features import features, slope_deg
from analog_core.ml import readers, runtime
from analog_core.tiles import TILE_RE, tile_center, tile_id
from app import store
from app.main import app
from app.schemas import ScoreResult

X, Y = local_xy()
client = TestClient(app)


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
    assert tile_center("earth:p:35.0270:-111.0220") == ("earth", 35.027, -111.022) # centred on the click
    assert not TILE_RE.match("earth:p:35.027:-111.022")
    with pytest.raises(ValueError):
        tile_center("earth:p:95.0000:0.0000")


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


def fake_fetch(model, lat, lon, scales=None):
    # a 200 m hill at both scales, dry and bare, so no bucket reads
    n = runtime.WINDOW_PX
    yy, xx = np.mgrid[:n, :n] - n / 2
    hill = 200 * np.exp(-(xx ** 2 + yy ** 2) / (2 * 30 ** 2))
    env = dict(tree=0.0, crop=0.0, built=0.0, water=0.0, snow=0.0, bare=0.9, precip=float("nan"))
    return {s: hill.copy() for s in model.scales}, env


def test_example_response_fits_the_contract():
    # victors meteor crater response plus our wrapper fields
    r = json.loads((Path(__file__).parent / "example_response.json").read_text())
    r.update(tile_id="earth:g:974:-2527", center=dict(lat=35.027, lon=-111.022), cached=False,
             env=dict(bare=0.9, precip=None), grid_url="/grids/x.bin")
    out = ScoreResult(**r).model_dump()
    assert set(out["worlds"]) == {"moon", "mars"}
    assert out["worlds"]["moon"]["best_match"]["contributions"] # passes through whatever keys the model has


needs_model = pytest.mark.skipif(not scorer.MODEL_PATH.exists(), reason="set MODEL_PATH to victors model.npz")


@needs_model
def test_score_tile_offline(monkeypatch):
    monkeypatch.setattr(readers, "fetch_earth", fake_fetch)
    r, block = scorer.score_tile("earth:g:974:-2527")
    assert block.shape == (128, 128)
    assert r["env"]["precip"] is None # nan cleaned for json
    for w in ("moon", "mars"):
        regs = r["worlds"][w]["regions"]
        assert regs and all(0 <= g["score"] <= 100 for g in regs)
        assert [g["score"] for g in regs] == sorted((g["score"] for g in regs), reverse=True)


def test_api_without_model(monkeypatch):
    def gone():
        raise scorer.NoModel("none")
    monkeypatch.setattr(scorer, "model", gone)
    assert client.get("/health").json()["ok"] is False
    assert client.post("/score", json=dict(tile_id="earth:g:974:-2527")).status_code == 503


@needs_model
def test_api(monkeypatch):
    assert client.get("/health").json()["ok"] is True
    ok = dict(tile_id="earth:g:974:-2527")
    assert client.post("/score", json={"tile_id": "earth:nope"}).status_code == 422
    assert client.post("/score", json={"tile_id": "moon:ps:s:0:0"}).json()["error"] == "not_scorable"

    def ocean(*a, **k):
        raise ValueError("no_terrain: the block is mostly ocean")
    monkeypatch.setattr(readers, "fetch_earth", ocean)
    r = client.post("/score", json=ok)
    assert r.status_code == 422 and r.json()["error"] == "no_terrain"

    def offline(*a, **k):
        raise OSError("bucket down")
    monkeypatch.setattr(readers, "fetch_earth", offline)
    assert client.post("/score", json=ok).json()["error"] == "dem_read_failed"

    monkeypatch.setattr(readers, "fetch_earth", fake_fetch)
    first = client.post("/score", json=ok)
    assert first.status_code == 200, first.text
    a, b = first.json(), client.post("/score", json=ok).json()
    assert (a["cached"], b["cached"]) == (False, True)
    assert a["worlds"] == b["worlds"]
    assert len(client.get(a["grid_url"]).content) == 32776

    idx = a["worlds"]["moon"]["best_match"]["index"]
    (store.LOCAL_GRIDS / f"lib/{a['model_version']}/{idx}.bin").unlink(missing_ok=True) # left by an earlier run
    calls = []
    monkeypatch.setattr(readers, "library_block_dem", lambda m, i: calls.append(i) or np.zeros((128, 128)))
    lib = client.get(f"/library/{idx}").json()
    assert lib["world"] == "moon" and client.get(f"/library/{idx}").json() == lib
    assert calls == [idx] # second call served from the stored grid
    assert len(client.get(lib["grid_url"]).content) == 32776
    assert client.get("/library/999999").status_code == 404
