import { pointTile } from "./tiles";

// example sites for the front page: places where the model's answer matches what the analog literature says, from
// very good down to very bad. band = the v3.0 overall score of the block at these exact coordinates, on the tab it
// opens (live, nov 15; the check sites keep their own coordinates so pin and row are the same block):
// very good 80+, good 60-80, average 40-60, bad 20-40, very bad under 20. rescore when the model changes
export type Band = "very good" | "good" | "average" | "bad" | "very bad";

export const BANDS: { band: Band; min: number; cls: string }[] = [
  { band: "very good", min: 80, cls: "bg-help" },
  { band: "good", min: 60, cls: "bg-help/60" },
  { band: "average", min: 40, cls: "bg-warn" },
  { band: "bad", min: 20, cls: "bg-hurt/60" },
  { band: "very bad", min: 0, cls: "bg-hurt" },
];

export type Example = { id: string; name: string; region: string; lat: number; lon: number; tab: "moon" | "mars"; band: Band; why: string };

export const EXAMPLES: Example[] = [
  { id: "mauna-kea", name: "Mauna Kea summit", region: "Hawaii, United States", lat: 19.8206, lon: -155.4681, tab: "moon", band: "very good", why: "Volcanic tephra; NASA tests lunar rovers and resource extraction here" },
  { id: "atacama-yungay", name: "Atacama, Yungay", region: "Chile", lat: -24.062, lon: -69.923, tab: "moon", band: "very good", why: "The driest non-polar desert; Mars rover trials" },
  { id: "meteor-crater", name: "Meteor Crater", region: "Arizona, United States", lat: 35.027, lon: -111.022, tab: "moon", band: "very good", why: "Fresh 1.2 km impact crater; Apollo crews trained here" },
  { id: "dry-valleys", name: "McMurdo Dry Valleys", region: "Antarctica", lat: -77.47, lon: 161.8, tab: "moon", band: "good", why: "Cold, hyper-arid valleys; the classic Mars analog" },
  { id: "timanfaya", name: "Timanfaya", region: "Lanzarote, Spain", lat: 29.01, lon: -13.76, tab: "moon", band: "good", why: "Lava fields and tubes; ESA astronaut geology training" },
  { id: "askja", name: "Askja", region: "Iceland", lat: 65.033, lon: -16.783, tab: "moon", band: "good", why: "Volcanic plains where Apollo crews trained in 1965 and 1967" },
  { id: "holuhraun", name: "Holuhraun lava field", region: "Iceland", lat: 64.87, lon: -16.83, tab: "mars", band: "good", why: "Fresh flood basalt from 2014-15" },
  { id: "utah-mdrs", name: "Utah near MDRS", region: "Utah, United States", lat: 38.406, lon: -110.792, tab: "moon", band: "average", why: "Mars-like sediments, but the terrain itself is only partly similar" },
  { id: "himalaya", name: "Himalayan ridge", region: "Khumbu, Nepal", lat: 27.99, lon: 86.93, tab: "moon", band: "bad", why: "Rugged, but snowy, glaciated and far too steep" },
  { id: "amazon", name: "Amazon rainforest", region: "Brazil", lat: -2.6, lon: -60.2, tab: "mars", band: "very bad", why: "Forest canopy and rain: nothing like the Moon or Mars" },
];

export const exampleTile = (e: Example) => pointTile("earth", e.lat, e.lon).id;
export const bandOf = (b: Band) => BANDS.find((x) => x.band === b)!;
