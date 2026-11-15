# How the model works

Notes that go with `model.ipynb`, in the same order as the notebook.

## Overview

The notebook builds the Moon and Mars region libraries, trains the models, checks them, and exports four files:

| File | What it is |
| --- | --- |
| `export/model.npz` | Everything the server loads: library tokens, curves, calibration, rainfall grid |
| `export/analog_runtime.py` | The scorer, `score_click(model, dems, env)`. numpy + scipy only, no network |
| `export/analog_readers.py` | Reference code that fetches a coordinate's inputs. James can swap it for his own reads |
| `export/regions.npz` | Moon and Mars region maps (0.125° grids) for the front end |

Training goes through the same runtime and reader functions the server uses, so the two can't drift apart.

Set `PROFILE` in the first cell and run everything from the `ml/` folder. Run `download_datasets.ipynb` first. Reads are cached in `data/cache/`, so reruns take minutes.

## What a click returns

Two tabs, Moon and Mars, with four regions each:

| Moon | Mars |
| --- | --- |
| Lunar maria | Southern cratered highlands |
| Lunar highlands | Northern lowlands |
| Impact basin rings and ejecta | Volcanic provinces |
| South polar region | Outflow channels and chaos |

Each region gets a landscape score (0–100, how much the place looks like terrain from that region) and its 1–3 closest real sites, each with a tag like "crater rim, 12 km from Tycho". The Earth place also gets a separate site-conditions score from land cover and rainfall. Forest, farms, towns, water, snow and rain can only pull it down.

## How a click is scored

```
Earth click (lat, lon)
  readers:  GLO-30 -> 8 km window at 31 m ("site") and 64 km window at 250 m ("regional")
            WorldCover -> land-cover shares; rainfall from the grid in model.npz
  runtime:  each window -> 64 terrain tokens (13 features per cell) + 6 block-shape numbers
    for each world, each region, each scale:
        shortlist 100 library blocks by sketch -> exact cell matching -> 19 mismatch numbers per pair
        pair model: logit = bias + sum of g_k(z_k)      (trained, one monotone curve per mismatch)
        region score = mean of the top 25 pair logits, calibrated against the region's own blocks
    landscape score = learned blend of the two scales
    best sites = blocks with the highest pair logit
  site conditions = bias + sum of h_m(land cover, rainfall)   (trained, one-sided curves)
```

## Changes from the first version

1. Regions instead of 21 landform classes. Regions come from the global geologic maps; landforms are kept as tags and as a training label.
2. Two scales. A 4 km block can't show broad terrain, so each spot is also read at 32 km from the global LOLA and MOLA–HRSC DEMs.
3. Cleaner inputs. Striped Kaguya blocks get rejected, and every DEM gets the same low-pass filter, so all three worlds end up at one effective resolution.
4. Layout features: linearity, hypsometry, closed-depression area and depth. Cell matching can't see these.
5. Earth-to-planet training pairs. Earth craters and volcanoes are paired with crater-tagged and volcanic library blocks, with half held out for testing.
6. Landscape and conditions are separate scores, plus a learned blend.

## The exported modules

The first cells write `analog_runtime.py` and `analog_readers.py`, and the rest of the notebook imports them.

At click time the server doesn't store any dataset. Earth terrain comes from GLO-30 on AWS (1–3 s cold), land cover from WorldCover (~0.5 s), and rainfall from a small grid in `model.npz`. The Moon and Mars are never read; their tokens are already in `model.npz`. The one exception is `library_block_dem`, which reads a matched block's heights so the front end can draw it (~1 s, worth caching on R2).

## Regions

Each world's regions come from its global geologic map: the Unified Geologic Map of the Moon (2020) and the Geologic Map of Mars (Tanaka et al. 2014). Every map unit is assigned to a region, the polygons are rasterised to 0.125°, and that grid tells you which region any point is in.

| Region | Map units |
| --- | --- |
| Lunar maria | Mare units, mare domes, dark mantling |
| Lunar highlands | Terra, plains, plateau and grooved units |
| Impact basin rings and ejecta | Basin massif, lineated, undivided and secondary-crater units; Orientale, Imbrium and Nectaris formations |
| South polar region | Everything south of 80°S (overrides the units) |
| Southern cratered highlands | Highland units, plus the Hellas and Argyre basin units |
| Northern lowlands | Lowland units |
| Volcanic provinces | Volcanic, volcanic-edifice and volcanic-field units |
| Outflow channels and chaos | Transition units, including the outflow unit |

Crater units (and Mars's impact and apron units) aren't regions; those pixels take the nearest region around them. Mars's polar units are left out because there are no CTX terrain models past 75°. Adding them back is one line in `MARS_UNITS` and a fifth entry in `REGIONS`.

## Landform tags

A region is a place, not one kind of terrain, so half of each region's blocks are placed on mapped landforms and get a tag. Tags show up with each match and are one of the two training labels tested later.

| Source | Tags | Placement |
| --- | --- | --- |
| Robbins crater catalogues (1.3 M Moon, 385 k Mars craters ≥ 1 km) | Small crater, crater rim, crater floor | Centre of a 1–3 km crater; rim at D/2 in a random direction; floor at 20–45% of the radius |
| Geologic map line layers | Wrinkle ridge, graben, sinuous rille, channel, scarp, lava-flow front, yardang, crater chain | A point every `line_step_km` along the line |
| IAU gazetteer | Massif, volcanic edifice, mesa, chaos, canyon, plus every block's display name | Inner half of the feature's bounding box |

The other half are background blocks: random points in the region, tagged only with the region. Every feature is equally likely to be picked, and blocks from the same feature share a group (its 10° cell), so cross-validation holds out whole features.

## Region libraries

Background points are drawn uniformly and kept if they land in the region. Tagged points come from the step above. Every spot is read at two scales on the same local grid:

| Scale | Moon | Mars |
| --- | --- | --- |
| Site (4 km, 31 m) | Kaguya TC DTMs v2, found by a STAC point search | CTX DTMs, with candidates only drawn where one of the 44,628 footprints exists |
| Regional (32 km, 250 m) | LOLA global 118 m | MOLA–HRSC blend 200 m |

Kaguya windows with a `stripe_score` above `stripe_max` are skipped, and the next DTM covering the point is tried. Reads keep going in rounds until each region has `per_region` blocks.

## Earth blocks

Earth blocks are read the same way the server reads a click. There are five sets:

| Set | Role |
| --- | --- |
| `random` | Random land. Negatives for the conditions model, plus the scaling, percentile and out-of-distribution references |
| `analog` | Known analog field sites (hand list). Positives for the conditions model |
| `featured` | The app's featured sites, with the expected order written before scoring. Never trained on |
| `crater` | Well-exposed Earth impact craters. Half train the pair model, half are the cross-world test |
| `volcano` | Smithsonian shield volcanoes, calderas, volcanic fields and cinder cones. Same split, against Mars's volcanic region |

The USGS "Known Terrestrial Analog Sites" list turned out to be 190 impact structures out of 192 points, so it's not a field-site list. The positives are a hand list instead (Desert RATS, BASALT, FINESSE, HI-SEAS, PANGAEA, AMADEE, Apollo training, long-running Mars analog sites). The coordinates are from memory and only good to a few km, so check them before quoting any conditions number. Sites within 50 km of a featured site are dropped.

Rainfall is WorldClim 2.1 at 10′, summed to mm per year. It has no data over Antarctica, so the model treats rainfall there as typical.

## Scaling, sketches and mismatch tables

Done once per scale:

- Scaler: each token feature is divided by its IQR over the library and random Earth land, so slope in degrees doesn't drown out 0–1 shares.
- Sketch: 8 quantiles per feature, projected to 32 numbers. Sketch distance roughly lower-bounds the real matching cost, so it's a safe shortlist filter.
- Pair inputs: `rt.pair_inputs_many` matches the 64 cells of two blocks exactly (Hungarian method) and returns 19 mismatch numbers: 13 per-feature costs and 6 block-shape differences.
- Percentile table: each mismatch becomes the share of random pairs that match worse.

Pairs are only computed where they're needed (training triplets, evaluation shortlists, tables).

## Training the pair models

The pair model answers: for one block, which library blocks are the same kind of terrain? The server only compares pair scores for the same query, so it's trained as a ranking problem.

The model is `s(a, b) = sum of g_k(z_k)` over the 19 mismatch percentiles. Each `g_k` can only go down as mismatch goes up. M1 uses straight lines, M2 uses smoothed splines, and M0 is the untrained baseline.

Training rows are triplets (anchor, positive, negative) with a logistic ranking loss:

| Triplets | Anchor | Positive | Negative |
| --- | --- | --- | --- |
| Library, label = region | Library block | Same region, other group | Another region, same world |
| Library, label = tag | Library block | Same tag, other group | Another tag |
| Cross-world | Earth crater (training half) | Crater-tagged Moon or Mars block | Non-crater block |
| Cross-world | Earth volcano (training half) | Block in Mars's volcanic region | Mars block in another region |

Cross-world triplets get `cross_weight` of the loss. They're the only rows where the model sees Earth terrain. A Platt step then rescales the output so `100·σ(logit)` reads as a probability; it doesn't change any ranking.

Evaluation uses 5 folds over 10° groups. Each held-out block is scored against all four regions of its world, the same way the server does it. The main metric is region accuracy (chance 0.25), with P@10 by region and by tag alongside. Both labels and both curve shapes are tried, and the simplest one within one standard error of the best ships, per scale.

To combine the scales, a two-weight logistic model (weights ≥ 0) learns how much each scale counts. A weight of 0 means that scale adds nothing.

The final fit uses every triplet, with a bootstrap for uncertainty bands. A second fit without the cross-world triplets is kept for comparison.

## The model file

Everything goes into one dict, `MZ`, which becomes `model.npz`. Per scale: scaler, sketch projection, percentile table, curves, bias, bootstrap curves, library tokens (16-bit), block features, sketches, calibration lists and blend weight. Shared: each library block's world, region, tag, name, coordinates and source link, plus the region names, rainfall grid and conditions model.

Calibration stores each evaluation block's score against its own region, so a click's region score reads as "higher than x% of real blocks from that region".

## Landscape checks

1. Runtime agreement: the server's code path has to pick the same region as the notebook's evaluation.
2. Planet check: can a block's sketch alone tell which world it's from? 0.33 is chance. High numbers mean the DEM sources still look different to the model. The first version got 0.82.
3. Cross-world transfer on held-out Earth blocks: the share of crater-tagged matches for Earth craters, and whether Earth volcanoes land in Mars's volcanic region. Both are reported with and without the cross-world triplets.

## Site conditions

This asks whether an Earth place could work as an analog site, whatever its terrain looks like. The Moon and Mars have no forests, farms, towns, lakes, snow or rain, so this has to be learned from Earth alone.

Known analog sites are the positives and random land the negatives, weighted equally. The inputs are the six WorldCover shares plus rainfall, each as a percentile among random land (missing counts as typical).

Each input gets a curve with a fixed direction: tree, crop, built, water, snow and rainfall can only lower the score, and bare ground can only raise it. The data decide how steep each curve is, but never its direction.

The overall score blends landscape and conditions with two learned non-negative weights, fitted on out-of-fold conditions scores. The notebook reports where held-out analog sites rank among random land for landscape alone, conditions alone, and the blend.

## Featured sites

The expected order (1 = worst, 6 = best) was written before any scoring, and none of these sites are in training. Each one is scored through `rt.score_click`, the same as the API.

## Export and round trip

The notebook writes the four files, then scores Meteor Crater in a fresh Python process that only imports the runtime, and checks the scores match. Setting `CHECK_LIVE = True` also times one live read through `analog_readers`.

## One click, start to finish

The last cell prints Meteor Crater the way the site would show it. `export/example_response.json` holds that exact response for the front end.

## Known limits

- `smoke` is just a pipeline check (60 blocks per region) and its numbers are noisy. `v1` (600 per region) is the first one worth shipping; `full` is 2,000.
- The south polar region stops at 86.5°S because the global LOLA mosaic can't be windowed closer, and Kaguya's polar DTMs are noisy. Shackleton-rim sites need the polar LOLA products.
- Mars has no polar tab, since there are no CTX models past 75°.
- Stripe rejection thins out smooth lunar terrain, where stitching artefacts show most.
- Analog-site coordinates are approximate.
- WorldClim has no rainfall over Antarctica, so the Dry Valleys get typical rainfall.
- Matched Moon/Mars blocks are read live (~1 s). Baking each block's 128 px grid to R2 would avoid that; they're already in `data/cache/library_*_r1.npz` as `dem_site`.
