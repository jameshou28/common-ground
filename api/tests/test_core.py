import numpy as np
import pytest

from analog_core import grid
from analog_core.tiles import TILE_RE, tile_center, tile_id


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
