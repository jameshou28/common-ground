# Updating the model

The API and the website both read the model straight from `ml/export/`. Nobody copies files into `api/` or changes settings in Vercel. Merging a PR that updates `ml/export/` to `main` is the whole switch.

## What the API and website use

| File | Who uses it |
| --- | --- |
| `export/model.npz` | API: built into the Docker image |
| `export/analog_runtime.py` | API: loaded at startup |
| `export/analog_readers.py` | API: loaded at startup |
| `export/example_response.json` | API tests, and the website build reads `model_version` from it |
| `export/regions.npz` | not used by the API |

## Steps

1. **Bump the version.** Give the new model a new `version` inside `model.npz`, like `regions-1.4-v1`. Scores are cached per version (Supabase, and the browser), so if you reuse a version people keep seeing the old model's scores.
2. **Export.** Run `model.ipynb` so it writes everything in `export/`. Make sure `example_response.json` is regenerated with the new model, because its `model_version` must match `model.npz`. The tests check this.
3. **Keep the response shape.** The website expects these fields on the response:
   - `worlds.{moon,mars}.regions[]`, each with `region`, `title`, `score`, `overall`, `scales`, `best[]`
   - `conditions.score` and `conditions.terms`
   - `best_match` and `best_region` on each world

   Adding new fields is fine, they pass through. Renaming or removing one breaks the site, so tell James first.
4. **Run the tests** (optional, CI runs them on the PR too):
   ```
   cd api
   uv sync
   uv run pytest -q
   ```
5. **Write up the changes** in `ml/v<version>changes.md`, like the earlier ones.
6. **Open a PR to `main`.** CI runs the API tests against your new model. When it's green, merge.
7. **Deploy.** Vercel rebuilds the website on its own. Render redeploys the API if auto-deploy is on, otherwise press Manual Deploy on the Render dashboard.

## Moon and Mars clicks: Earth places like this

Clicking the Moon or Mars calls `POST /earth-matches`, which lists the Earth places that look most like the clicked block. Right now it returns a fixed placeholder list (`dummy: true`, and the site says "placeholder list, model coming").

To plug in the real model, add this function to `export/analog_runtime.py`:

```python
def earth_matches(model: Model, world: str, lat: float, lon: float) -> list[dict]:
    # world is "moon" or "mars", lat/lon is the centre of the clicked 4 km block
    # return Earth places best first, each dict(name=str, lat=float, lon=float, score=0..100)
    # extra keys are fine, they pass through to the response
```

The API uses it as soon as it exists, so you don't need to change anything in `api/`. Each place becomes a link to its Earth result page.

## Checking it's live

- https://spaceapps-ypoe.onrender.com/health shows `model_version`, the model the live API is running. It should be the new one.
- The bottom right of the website says `Model <version>`.
- Render's logs show one line per request with the full input and output, so you can see what the model returned.

## Clearing old cached scores (optional)

Old versions are never served, so you only do this to free space. In Supabase, open SQL Editor and run:

```sql
delete from scores where model_version = 'regions-1.3-v1';
```

## If something goes wrong

- **The website still shows the old version:** the Vercel build couldn't read `../ml` and used `NEXT_PUBLIC_MODEL_VERSION` instead. Either set that variable in Vercel to the new version string (same as `/health`), or turn on "Include files outside the root directory" in the Vercel project settings. Redeploy after either one.
- **`/health` shows the old version:** Render didn't redeploy. Press Manual Deploy.
- **`/score` returns 503 `no_model`:** `model.npz` is missing from the image. Check it's committed. `.gitignore` allows `ml/export/*.npz`.
- **To roll back:** revert the PR on `main`.
