# Locations

Exported from the regions-1.3-v1 model and the site lists. Coordinates are degrees (lat, lon; lon in -180..180).

| File | Rows | What |
| --- | --- | --- |
| `moon_library.csv` | 2236 | Every Moon block the model compares against: region, landform tag, display name, centre, source DEM (`index` = row in model.npz, same as `best[].index` in a /score response) |
| `mars_library.csv` | 2400 | Same for Mars |
| `earth_analog_sites.csv` | 104 | Sourced Earth analog sites, with kind (terrain / habitat / sample), coordinate quality, the region each is an analog for, and sources |
| `earth_featured.csv` | 9 | The featured sites, with the expected order written before scoring (1 = worst analog) |
| `earth_negative.csv` | 16 | Places that should never look like good analogs (the standing negative test) |
| `earth_craters.csv` | 38 | Earth impact craters (USGS locations, Wikidata diameters) |

Library blocks are 4 km squares centred on the point. Region keys match `worlds.{w}.regions[].region` in the API response.
