# fills the score cache for the best sites by scoring each one through the api once, so they open instantly.
# the api writes every result to supabase itself, so this needs no keys. run after a model update is deployed:
#   uv run python -m scripts.prefill_scores https://<api-url>            (or http://localhost:8000)
# reads ml/export/best_sites.json; safe to rerun (cached sites come back at once)
import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[2]


def tiles() -> list[str]:
    data = json.loads((ROOT / "ml/export/best_sites.json").read_text())
    ids = [s["tile_id"] for regs in data.get("worlds", {}).values() for r in regs for s in r["sites"]]
    ids += [s["tile_id"] for lf in data.get("landforms", []) for s in lf["sites"]]
    return sorted(set(ids))


def main(api: str, workers: int = 4) -> None:
    ids = tiles()
    print(f"{len(ids)} best-site blocks -> {api}")
    client = httpx.Client(timeout=120)
    t0, done, cached, failed = time.time(), 0, 0, 0

    def one(tile_id: str):
        r = client.post(f"{api.rstrip('/')}/score", json={"tile_id": tile_id})
        return tile_id, r.status_code, (r.json().get("cached") if r.status_code == 200 else r.text[:120])

    with ThreadPoolExecutor(workers) as ex:   # a few at a time, so live clicks still get through
        for tile_id, status, info in ex.map(one, ids):
            done += 1
            cached += status == 200 and info is True
            failed += status != 200
            if status != 200:
                print(f"  {tile_id}: {status} {info}")
            if done % 25 == 0:
                print(f"  {done}/{len(ids)} in {time.time() - t0:.0f}s ({cached} were cached, {failed} failed)")
    print(f"done: {done} blocks, {cached} already cached, {failed} failed, {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000")
