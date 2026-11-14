# run: uv run uvicorn app.main:app --reload
import os
import time

from fastapi import FastAPI

MODEL_VERSION = os.environ.get("MODEL_VERSION", "stub-0.1")
START = time.time()  # for uptime

app = FastAPI(title="spaceapps api", version=MODEL_VERSION)


@app.get("/health")
def health():
    return dict(ok=True, model_version=MODEL_VERSION, uptime_s=round(time.time() - START))
