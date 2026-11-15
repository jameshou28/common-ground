import type { World } from "./tiles";

// landing sites and well-known features on the moon and mars, pinned on their globes for reference. they are not
// scored: the model scores earth blocks against moon and mars regions. coordinates are the published landing points
// (nasa nssdca) and feature centres (iau gazetteer of planetary nomenclature), east longitudes positive
export type Place = { id: string; world: Exclude<World, "earth">; name: string; lat: number; lon: number; kind: "landing" | "feature"; note: string };

export const PLACES: Place[] = [
  // moon, landings
  { id: "apollo11", world: "moon", name: "Apollo 11", lat: 0.6741, lon: 23.473, kind: "landing", note: "First crewed landing, 1969. Mare Tranquillitatis." },
  { id: "apollo12", world: "moon", name: "Apollo 12", lat: -3.0124, lon: -23.4216, kind: "landing", note: "1969, next to the Surveyor 3 probe. Oceanus Procellarum." },
  { id: "apollo14", world: "moon", name: "Apollo 14", lat: -3.6453, lon: -17.4714, kind: "landing", note: "1971. Fra Mauro highlands, ejecta from the Imbrium basin." },
  { id: "apollo15", world: "moon", name: "Apollo 15", lat: 26.1322, lon: 3.6339, kind: "landing", note: "1971, first lunar rover. Hadley Rille at the edge of the Apennine mountains." },
  { id: "apollo16", world: "moon", name: "Apollo 16", lat: -8.973, lon: 15.5002, kind: "landing", note: "1972. Descartes highlands, the only Apollo landing in the highlands." },
  { id: "apollo17", world: "moon", name: "Apollo 17", lat: 20.1908, lon: 30.7717, kind: "landing", note: "1972, the last crewed landing. Taurus-Littrow valley." },
  { id: "change3", world: "moon", name: "Chang'e 3", lat: 44.1214, lon: -19.5116, kind: "landing", note: "2013, Yutu rover. Mare Imbrium." },
  { id: "change4", world: "moon", name: "Chang'e 4", lat: -45.4446, lon: 177.5991, kind: "landing", note: "2019, first landing on the far side. Von Kármán crater." },
  { id: "change5", world: "moon", name: "Chang'e 5", lat: 43.0576, lon: -51.9161, kind: "landing", note: "2020 sample return. Young mare basalts near Mons Rümker." },
  { id: "change6", world: "moon", name: "Chang'e 6", lat: -41.6385, lon: -153.9852, kind: "landing", note: "2024, first far-side sample return. Apollo basin." },
  { id: "chandrayaan3", world: "moon", name: "Chandrayaan-3", lat: -69.3733, lon: 32.3191, kind: "landing", note: "2023, closest landing to the south pole at the time." },
  // moon, features
  { id: "shackleton", world: "moon", name: "Shackleton crater", lat: -89.67, lon: 129.78, kind: "feature", note: "21 km crater at the south pole with permanently shadowed ice traps. Artemis target area." },
  { id: "tycho", world: "moon", name: "Tycho", lat: -43.31, lon: -11.36, kind: "feature", note: "Young 85 km crater with bright rays." },
  { id: "copernicus", world: "moon", name: "Copernicus", lat: 9.62, lon: -20.08, kind: "feature", note: "93 km crater with terraced walls and central peaks." },
  // mars, landings
  { id: "viking1", world: "mars", name: "Viking 1", lat: 22.27, lon: -47.95, kind: "landing", note: "1976, first successful Mars landing. Chryse Planitia." },
  { id: "viking2", world: "mars", name: "Viking 2", lat: 47.64, lon: 134.29, kind: "landing", note: "1976. Utopia Planitia, northern lowlands." },
  { id: "pathfinder", world: "mars", name: "Mars Pathfinder", lat: 19.13, lon: -33.22, kind: "landing", note: "1997, Sojourner rover. Ares Vallis outflow channel." },
  { id: "spirit", world: "mars", name: "Spirit", lat: -14.5684, lon: 175.4726, kind: "landing", note: "2004 rover. Gusev crater." },
  { id: "opportunity", world: "mars", name: "Opportunity", lat: -1.9462, lon: -5.5272, kind: "landing", note: "2004 rover, 45 km driven. Meridiani Planum." },
  { id: "phoenix", world: "mars", name: "Phoenix", lat: 68.22, lon: -125.75, kind: "landing", note: "2008, found water ice just under the surface. Polygonal ground in Vastitas Borealis." },
  { id: "curiosity", world: "mars", name: "Curiosity", lat: -4.5895, lon: 137.4417, kind: "landing", note: "2012 rover, Bradbury Landing in Gale crater below Mount Sharp." },
  { id: "insight", world: "mars", name: "InSight", lat: 4.502, lon: 135.623, kind: "landing", note: "2018 lander that measured marsquakes. Elysium Planitia." },
  { id: "perseverance", world: "mars", name: "Perseverance", lat: 18.4447, lon: 77.4508, kind: "landing", note: "2021 rover in Jezero crater, an old river delta." },
  { id: "zhurong", world: "mars", name: "Zhurong", lat: 25.066, lon: 109.925, kind: "landing", note: "2021 rover. Utopia Planitia." },
  // mars, features
  { id: "olympus", world: "mars", name: "Olympus Mons", lat: 18.65, lon: -133.8, kind: "feature", note: "The largest volcano in the solar system, about 22 km high." },
  { id: "valles", world: "mars", name: "Valles Marineris", lat: -13.9, lon: -59.2, kind: "feature", note: "Canyon system about 4,000 km long and up to 7 km deep." },
  { id: "hellas", world: "mars", name: "Hellas Planitia", lat: -42.4, lon: 70.5, kind: "feature", note: "Impact basin about 2,300 km across, the lowest ground on Mars." },
];

export const placesOn = (world: World) => PLACES.filter((p) => p.world === world);

// the landmark a moon or mars block was opened from: the nearest one within max_km of the block centre, so a click a
// little off the pin still finds it
export function placeNear(world: World, lat: number, lon: number, maxKm = 6): Place | undefined {
  const R = world === "moon" ? 1737.4 : world === "mars" ? 3396.19 : 6371;
  const rad = Math.PI / 180;
  let best: Place | undefined;
  let bestKm = maxKm;
  for (const p of placesOn(world)) {
    const a = Math.sin(((p.lat - lat) * rad) / 2) ** 2 + Math.cos(lat * rad) * Math.cos(p.lat * rad) * Math.sin(((p.lon - lon) * rad) / 2) ** 2;
    const km = 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
    if (km <= bestKm) {
      best = p;
      bestKm = km;
    }
  }
  return best;
}
