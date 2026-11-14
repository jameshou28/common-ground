import os
from pathlib import Path

import httpx

# supabase caches the scores and r2 holds the grids, with the env vars empty both fall back to local
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
R2_ENDPOINT = os.environ.get("R2_ENDPOINT", "")
R2_BUCKET = os.environ.get("R2_BUCKET", "")
R2_PUBLIC_BASE = os.environ.get("R2_PUBLIC_BASE", "").rstrip("/")
LOCAL_GRIDS = Path(__file__).resolve().parents[1] / "cache" / "grids"

_mem: dict[tuple, dict] = {}
_http = httpx.Client(timeout=10, headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"})
_s3 = None


def get_result(tile_id: str, target_id: str, version: str) -> dict | None:
    if not SUPABASE_URL:
        return _mem.get((tile_id, target_id, version))
    r = _http.get(f"{SUPABASE_URL}/rest/v1/scores", params={
        "tile_id": f"eq.{tile_id}", "target_id": f"eq.{target_id}", "model_version": f"eq.{version}",
        "select": "result"})
    r.raise_for_status()
    rows = r.json()
    return rows[0]["result"] if rows else None


def put_result(tile_id: str, target_id: str, version: str, result: dict) -> None:
    if not SUPABASE_URL:
        _mem[(tile_id, target_id, version)] = result
        return
    # merge-duplicates so a rescore overwrites the old row
    _http.post(f"{SUPABASE_URL}/rest/v1/scores", headers={"Prefer": "resolution=merge-duplicates"},
               json=dict(tile_id=tile_id, target_id=target_id, model_version=version, result=result)
               ).raise_for_status()


def put_grid(tile_id: str, data: bytes) -> str:
    # store the 128 px grid, return its public url
    key = f"grids/{tile_id}.bin"
    if not R2_ENDPOINT:
        LOCAL_GRIDS.mkdir(parents=True, exist_ok=True)
        (LOCAL_GRIDS / f"{tile_id}.bin").write_bytes(data)
        return f"/{key}"
    global _s3
    if _s3 is None:
        import boto3 # only needed when r2 is on
        _s3 = boto3.client("s3", endpoint_url=R2_ENDPOINT, region_name="auto",
                           aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
                           aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"])
    _s3.put_object(Bucket=R2_BUCKET, Key=key, Body=data, ContentType="application/octet-stream",
                   CacheControl="public, max-age=31536000, immutable")
    return f"{R2_PUBLIC_BASE}/{key}"
