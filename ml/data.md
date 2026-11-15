# Model data

What the model reads, what the back end hosts, and what to download for training. Last updated Nov 14, 2026.

## Short version

- The back end doesn't store any terrain. A click is scored from two live reads of public AWS buckets (Earth terrain and land cover) plus the model file.
- Moon and Mars terrain is never read at click time. It's turned into tokens offline in `model.ipynb`, and the tokens live inside `model.npz`.
- For training, run `download_datasets.ipynb` once. It puts everything in `ml/datasets/` (gitignored).
- Hosted total is about 1 GB of R2's 10 GB, and most of that is optional display grids.

## What changes for James in v1.1

The click flow is the same: same call, same two live reads. The response and a few hosting details change:

- `model_version` becomes `regions-1.1-v1`. Bump the cache key, since old Supabase rows are scored by the old model.
- `overall` is now `landscape score × conditions.discount`, where `discount = 0.4 + 0.6 × conditions.score / 100`. The learned blend is gone, so `overall` differs per region again. New field `conditions.discount` holds the multiplier, handy for a "−12 for site conditions" note in the UI.
- Regions inside each tab are now sorted by `overall`, which in practice is the same order as `score`.
- `block` lost `hypsometry`. It now has relief, hurst, linearity, depression_area and depression_depth.
- `best[].contributions` has 12 names instead of 19 (7 terrain features plus 5 block differences). Don't hard-code the list; read the keys.
- The Moon tab finally has all 4 regions. South polar matches have an `href` pointing to the polar LOLA file on `pgda.gsfc.nasa.gov` (a cloud-optimised GeoTIFF), so drawing those blocks live needs outbound HTTPS to that host too.
- `model.npz` grows to roughly 20–60 MB at v1. Measure memory on Render after the first deploy.
- About-page credit to add: LOLA polar DEMs (NASA GSFC PGDA, Barker et al.).

## What changes for James in v1.3 (trained, `regions-1.3-v1`)

- Each region now has `score` (what to show and sort by), plus `similarity` (raw likeness to the Moon/Mars region), `earth_percentile` and `earth_factor`. `score = similarity x earth_factor`, and `overall = score x conditions.score / 100`.
- `conditions.terms` adds `sparse` (shrub, grass, moss); `built` now includes a fixed penalty. `env` in the response adds `sparse`.
- Regions are sorted by `score`, so the order always matches the numbers shown.
- Matches are "terrain like this", not landform identifications. Please word the UI that way (e.g. "similar terrain: crater rim near Tycho"), since landform-level matching isn't validated.

## What changes for James in v1.2 (not trained yet)

- `model_version` will be `regions-1.2-v1`.
- `overall` is now `landscape score × conditions.score / 100` (the 0.4 floor is gone, because farmland was getting through).
- `conditions.terms` keys change to tree, crop, built, water, open, precip. "open" is bare ground plus snow and ice. `env` in the response still has the raw shares, including snow and bare.
- `best[].contributions` still has 12 names; `rough_coarse` is always 0 at the 4 km scale now.
- Scoring a click takes a bit longer (roughly 0.3 s to 0.45 s) because the best matches are re-ranked with both scales.
- `analog_runtime.py` has one extra helper, `region_logits_task`. The server doesn't need it.

## What a click reads

| Step | Data | Source | Stored by us | Time |
| --- | --- | --- | --- | --- |
| Earth terrain, 8 km at 31 m | Copernicus GLO-30 | `copernicus-dem-30m` bucket, range reads into the 1° tile | No | 0.5–3 s cold, ~0.02 s warm |
| Earth terrain, 64 km at 250 m | Same tiles, via their overviews | Same bucket | No | 0.5–1 s |
| Land cover over the 4 km block | ESA WorldCover 2021 | `esa-worldcover` bucket, range read | No | ~0.5 s |
| Rainfall | WorldClim 2.1, 10′ | Grid inside `model.npz` | Yes | instant |
| Moon/Mars comparison | Library tokens | Inside `model.npz` | Yes | 0.2–0.6 s |
| Picture of the matched Moon/Mars block | Kaguya or CTX DTM | `library_block_dem` range read, or a pre-baked grid on R2 | Optional | ~1 s live |

The server needs outbound HTTPS to `copernicus-dem-30m.s3.amazonaws.com` and `esa-worldcover.s3.eu-central-1.amazonaws.com`, plus `astrogeo-ard.s3-us-west-2.amazonaws.com` and `pgda.gsfc.nasa.gov` if matched blocks are drawn live.

The scorer itself (`analog_runtime.py`) makes no network calls. `analog_readers.py` is the part that fetches, and it's reference code James can replace with his own reads.

## What James hosts

| Item | Size | Where | Notes |
| --- | --- | --- | --- |
| `export/model.npz` | ~3 MB smoke, 20–60 MB for v1/full | R2, loaded at startup | Tokens, curves, calibration, rainfall grid |
| `export/analog_runtime.py` | 25 KB | API image | numpy + scipy |
| `export/analog_readers.py` | 10 KB | API image | rasterio + pyproj |
| `export/regions.npz` | <200 KB | R2 or front end | Moon/Mars region maps at 0.125° |
| `export/example_response.json` | ~75 KB | Repo | Meteor Crater response, for building the UI |
| Library display grids (optional) | 32 KB each, ~150 MB at v1 | R2, `grids/lib/{index}.bin` | Skips the 1 s live read when showing a match |
| `scores` rows | 3–6 KB each | Supabase | Drop `cell_cost` and `partner` if rows get big |
| Earth click grids | 32 KB each | R2, `grids/{tile_id}.bin` | Same as before |

Memory: the model should add 50–150 MB on top of the ~188 MB GDAL stack, so the 512 MB Render plan probably fits at v1. Worth measuring after the first deploy.

No raw Moon, Mars or Earth DEMs are hosted.

## Datasets the model uses

| Dataset | World | Used for | Download? |
| --- | --- | --- | --- |
| Kaguya TC DTMs v2 (USGS STAC) | Moon | 4 km site blocks | No, range-read per block (the full set is terabytes) |
| CTX DTMs (USGS STAC) | Mars | 4 km site blocks | No, range-read per block. Only the footprint outlines are downloaded (`ctx_dtm_footprints.npz`, 8.5 MB) |
| LOLA polar 20 m and 80 m (NASA PGDA, 80–90°S) | Moon | South polar region, both scales | Yes (2.7 GB + 190 MB). Kaguya is striped near the pole and the global map can't be windowed there |
| LOLA 118 m global | Moon | 32 km regional blocks | Optional (8.5 GB). Makes training a lot faster. James has it |
| MOLA–HRSC blend 200 m | Mars | 32 km regional blocks | Optional (11.4 GB). Same deal |
| Geologic maps (Moon 2020, Mars 2014) | Moon, Mars | Region labels, ridges/grabens/channels | Yes, just the 4 layers (~160 MB, pulled out of the zips) |
| Robbins crater catalogues | Moon, Mars | Crater tags | Yes (177 MB) |
| IAU gazetteer | Moon, Mars | Landform tags, block names | Yes (29 MB) |
| Copernicus GLO-30 | Earth | Every Earth block | No, range-read. Only the tile list is downloaded |
| ESA WorldCover 2021 | Earth | Land cover for the conditions score | No, range-read |
| WorldClim 2.1 rainfall | Earth | Rainfall for the conditions score | Yes (7 MB) |
| Smithsonian GVP volcanoes | Earth | Cross-world volcano test | Yes (1 MB) |
| Hand lists | Earth | 61 analog sites, 28 craters, 9 featured sites | No, they're in the notebook |

So you don't download all of them. `download_datasets.ipynb` gets the required ones (about 3.3 GB now, mostly the polar LOLA file). Set `GET_BIG_DEMS = True` for the two optional global DEMs, or copy James's files into `ml/datasets/dem/`. Most of the required files are also already in `spaceapps_planning/data/raw/` if copying is quicker.

Training still needs internet for the per-block reads (Kaguya, CTX, GLO-30, WorldCover) and the Kaguya STAC point search.

## What James already has

| File | Size | Needed? |
| --- | --- | --- |
| LOLA global 118 m | 8.49 GB | Optional speed-up for training |
| MOLA–HRSC 200 m | 11.38 GB | Optional speed-up for training |
| SLDEM2015 59 m | 22.65 GB | Not used by the model |
| LOLA 5 m south-pole sites, HiRISE Jezero | small | Not used by the model, still good for the featured target views |

## Dropped from the old list

- MODIS NDVI/snow/LST, aridity index, MERRA-2 dust, JRC water, permafrost, SMAP. WorldCover and rainfall cover the conditions model for now, with no logins needed.
- The 0.05° environment stack on R2.
- Diviner, TES/MCD, SWIM/GRS, GLiM, Macrostrat, EMIT, cave and mine points. Not used by this model, but still good for info cards.
- USGS Known Terrestrial Analog Sites. 190 of its 192 points are impact structures, so it isn't a field-site list. The notebook uses a hand list instead.
- Mars dune database and LROC lobate scarps. Optional extra tags, not wired in.

## To check

- [ ] Analog sites come only from our hand list (no third-party lists). The coordinates are still approximate. v1.1 auto-nudges sites whose block is mostly trees, crops, buildings or water, and drops the ones with nothing clean within 6 km (the notebook prints the list). Still worth a look on a map before quoting conditions numbers.
- [ ] Memory on Render with the v1 model, after ~20 scores.
- [ ] Outbound requests from Render to the AWS, USGS and PGDA hosts are allowed and fast enough.
- [ ] Licences for the About page: Copernicus DEM (ESA, attribution), WorldCover (CC BY 4.0), WorldClim (non-commercial, cite Fick and Hijmans 2017), USGS and IAU (public domain), Robbins (public domain, cite the papers), GVP (cite the database), LOLA polar DEMs (NASA PGDA, cite Barker et al.).
