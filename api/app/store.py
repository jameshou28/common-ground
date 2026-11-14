from pathlib import Path

# in memory for now, supabase and r2 come later
LOCAL_GRIDS = Path(__file__).resolve().parents[1] / "cache" / "grids"

_mem: dict[tuple, dict] = {}


def get_result(tile_id: str, target_id: str, version: str) -> dict | None:
    return _mem.get((tile_id, target_id, version))


def put_result(tile_id: str, target_id: str, version: str, result: dict) -> None:
    _mem[(tile_id, target_id, version)] = result


def put_grid(tile_id: str, data: bytes) -> str:
    # write the 128 px grid to disk, return the url it is served at
    LOCAL_GRIDS.mkdir(parents=True, exist_ok=True)
    (LOCAL_GRIDS / f"{tile_id}.bin").write_bytes(data)
    return f"/grids/{tile_id}.bin"
