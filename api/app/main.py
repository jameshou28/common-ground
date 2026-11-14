# run: uv run uvicorn app.main:app --reload
import os
import time

import numpy as np
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from analog_core import grid
from analog_core.dem import BLOCK_PX, RES_M, NoTerrain, UpstreamError
from analog_core.scorer import CELLS, MODEL_VERSION, TARGETS, UnknownTarget, score_tile
from analog_core.tiles import tile_center

from . import store
from .schemas import BlockResult, MatchRequest, MatchResult, ScoreRequest

START = time.time() # for uptime

app = FastAPI(title="spaceapps api", version=MODEL_VERSION)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in (os.environ.get("ALLOWED_ORIGIN"), "http://localhost:3000") if o],
    allow_methods=["GET", "POST"], allow_headers=["content-type"],
)
store.LOCAL_GRIDS.mkdir(parents=True, exist_ok=True) # serve the grids we wrote to disk
app.mount("/grids", StaticFiles(directory=store.LOCAL_GRIDS), name="grids")


def err(status: int, code: str, message: str = "") -> JSONResponse:
    return JSONResponse({"error": code, "message": message}, status_code=status,
                        headers={"Cache-Control": "no-store"})


def points(result: dict) -> list[dict]:
    # 3 cheapest cells help, 3 costliest hurt, position is the cell centre in metres from the block centre
    cost = np.array(result["cell_cost"])
    order = np.argsort(cost.ravel())
    cell_m = BLOCK_PX * RES_M / CELLS
    out = []
    for effect, picks in (("help", order[:3]), ("hurt", order[::-1][:3])):
        for n, flat in enumerate(picks):
            r, c = divmod(int(flat), CELLS)
            landform = result["cell_landform"][r][c]
            out.append(dict(
                id=f"{effect}-{n}", effect=effect, landform=landform, local=result["cell_local"][r][c],
                x_m=(c + 0.5 - CELLS / 2) * cell_m, y_m=(CELLS / 2 - r - 0.5) * cell_m,
                reason=f"{landform}: {'close to' if effect == 'help' else 'far from'} the target's typical slope"))
    return out


@app.get("/health")
def health():
    return dict(ok=True, model_version=MODEL_VERSION, targets=len(TARGETS), uptime_s=round(time.time() - START))


@app.get("/targets")
def targets():
    return list(TARGETS.values())


@app.post("/score", response_model=BlockResult, responses={422: {}, 502: {}})
def score(req: ScoreRequest, response: Response): # plain def so fastapi runs it in the thread pool
    response.headers["Cache-Control"] = "no-store"
    if req.target_id not in TARGETS:
        return err(422, "unknown_target", f"target_id must be one of {sorted(TARGETS)}")
    try:
        world, lat, lon = tile_center(req.tile_id)
    except ValueError as e:
        return err(422, "bad_tile", str(e))
    if world != "earth":
        # moon and mars targets are baked offline, only earth is scored live
        return err(422, "not_scorable", "only Earth tiles are scored live")

    if hit := store.get_result(req.tile_id, req.target_id, MODEL_VERSION):
        return {**hit, "cached": True}
    try:
        result, block = score_tile(req.tile_id, req.target_id)
    except NoTerrain as e:
        return err(422, "no_terrain", str(e))
    except UnknownTarget:
        return err(422, "unknown_target")
    except UpstreamError as e:
        return err(502, "dem_read_failed", str(e))

    full = dict(
        result, tile_id=req.tile_id, world=world, center=dict(lat=lat, lon=lon), size_m=4000,
        dem_source=result.get("dem_source", "Copernicus GLO-30"), resolution_m=result.get("resolution_m", 30.0),
        measured_share=None, cached=False, points=points(result),
        grid_url=store.put_grid(req.tile_id, grid.encode(block)),
    )
    full = BlockResult(**full).model_dump() # drops cell_* and anything else outside the contract
    store.put_result(req.tile_id, req.target_id, MODEL_VERSION, full)
    return full


@app.post("/match", response_model=MatchResult, responses={501: {}})
def match(req: MatchRequest):
    # needs victors pair model and class libraries, shape is in schemas.py
    return err(501, "not_implemented", "class matching arrives with victor's pair model")
