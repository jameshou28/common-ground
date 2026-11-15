# run: uv run uvicorn app.main:app --reload
import json
import os
import resource
import sys
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from analog_core import grid, scorer
from analog_core.dem import NoTerrain, UpstreamError
from analog_core.scorer import NoModel
from analog_core.tiles import tile_center

from . import store
from .schemas import LibraryBlock, ScoreRequest, ScoreResult

START = time.time() # for uptime
TARGETS: dict = json.loads((Path(__file__).resolve().parents[1] / "targets.json").read_text())


@asynccontextmanager
async def lifespan(app: FastAPI):
    # load the model before the first click, a missing model only breaks /score and /library
    try:
        scorer.model()
    except NoModel as e:
        print(f"model not loaded: {e}", file=sys.stderr)
    yield


app = FastAPI(title="spaceapps api", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in (os.environ.get("ALLOWED_ORIGIN"), "http://localhost:3000") if o],
    allow_methods=["GET", "POST"], allow_headers=["content-type"],
)


@app.middleware("http")
async def log_io(request, call_next):
    # one json line per call on stdout (render logs): what came in, what went out. grids are binary, skipped
    t = time.time()
    body = (await request.body()).decode(errors="replace")
    resp = await call_next(request)
    if request.url.path.startswith("/grids"):
        return resp
    out = b"".join([c async for c in resp.body_iterator])
    print(json.dumps(dict(method=request.method, path=request.url.path, query=str(request.url.query), req=body,
                          status=resp.status_code, ms=round(1000 * (time.time() - t)),
                          resp=out.decode(errors="replace"))), flush=True)
    return Response(out, status_code=resp.status_code, headers=dict(resp.headers), media_type=resp.media_type)


store.LOCAL_GRIDS.mkdir(parents=True, exist_ok=True) # serve the grids we wrote to disk
app.mount("/grids", StaticFiles(directory=store.LOCAL_GRIDS), name="grids")


def err(status: int, code: str, message: str = "") -> JSONResponse:
    return JSONResponse({"error": code, "message": message}, status_code=status,
                        headers={"Cache-Control": "no-store"})


def rss_mb() -> float:
    # peak resident memory, macos reports bytes and linux kb
    peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return round(peak / (2 ** 20 if sys.platform == "darwin" else 2 ** 10), 1)


@app.get("/health")
def health():
    try:
        version = scorer.model().version
    except NoModel:
        version = None
    return dict(ok=version is not None, model_version=version, targets=len(TARGETS),
                peak_rss_mb=rss_mb(), uptime_s=round(time.time() - START))


@app.get("/targets")
def targets():
    # featured moon and mars sites for the globe pins, baked by scripts/bake_targets.py
    return list(TARGETS.values())


@app.post("/score", response_model=ScoreResult, responses={422: {}, 502: {}, 503: {}})
def score(req: ScoreRequest, response: Response): # plain def so fastapi runs it in the thread pool
    response.headers["Cache-Control"] = "no-store"
    try:
        world, lat, lon = tile_center(req.tile_id)
    except ValueError as e:
        return err(422, "bad_tile", str(e))
    if world != "earth":
        # the moon and mars side lives inside the model, only earth is scored live
        return err(422, "not_scorable", "only Earth tiles are scored live")
    try:
        version = scorer.model().version
    except NoModel as e:
        return err(503, "no_model", str(e))

    if hit := store.get_result(req.tile_id, version):
        return {**hit, "cached": True}
    try:
        result, block = scorer.score_tile(req.tile_id)
    except NoTerrain as e:
        return err(422, "no_terrain", str(e))
    except UpstreamError as e:
        return err(502, "dem_read_failed", str(e))

    full = dict(result, tile_id=req.tile_id, center=dict(lat=lat, lon=lon), size_m=4000, cached=False,
                grid_url=store.put_grid(req.tile_id, grid.encode(block)))
    full = ScoreResult(**full).model_dump()
    store.put_result(req.tile_id, version, full)
    return full


@app.get("/library/{index}", response_model=LibraryBlock, responses={404: {}, 502: {}, 503: {}})
def library(index: int):
    # height grid of a matched moon or mars block, read once then served from r2
    try:
        m = scorer.model()
    except NoModel as e:
        return err(503, "no_model", str(e))
    if not 0 <= index < len(m.lib_world):
        return err(404, "unknown_index", f"index must be 0 to {len(m.lib_world) - 1}")
    # library rows are renumbered every model, so the version is part of the key
    name = f"lib/{m.version}/{index}"
    url = store.grid_url(name)
    if url is None:
        try:
            url = store.put_grid(name, grid.encode(scorer.library_block(index)))
        except UpstreamError as e:
            return err(502, "dem_read_failed", str(e))
    return dict(index=index, world=str(m.lib_world[index]), model_version=m.version, grid_url=url)
