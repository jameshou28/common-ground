import type { MatchSite, Region, ScoreResult, WorldScore } from "./api";

export type Tab = "moon" | "mars";
export const TABS: Tab[] = ["moon", "mars"];

// the model's measurement keys change between versions, unknown ones get a readable fallback
const CONTRIBUTION_LABEL: Record<string, string> = {
  slope_mean: "Mean slope",
  slope_p90: "Steep slopes",
  rough_fine: "Fine roughness",
  rough_coarse: "Coarse roughness",
  curv: "Curvature",
  geo_flat: "Flat ground",
  geo_convex: "Ridges and knobs",
  geo_concave: "Hollows",
  cell_relief: "Relief inside each cell",
  shadow_low: "Shadow at a low Sun",
  shadow_mid: "Shadow at a higher Sun",
  svf: "Open sky",
  norm_height: "Height within the block",
  d_relief: "Relief",
  d_hurst: "How roughness grows with distance",
  d_linearity: "Straight features",
  d_hypsometry: "Share of high ground",
  d_depression_area: "Area in hollows",
  d_depression_depth: "Depth of hollows",
};

const CONDITION_LABEL: Record<string, string> = {
  tree: "Tree cover",
  crop: "Farmland",
  built: "Buildings and roads",
  water: "Open water",
  snow: "Snow and ice",
  bare: "Bare ground",
  precip: "Rainfall",
};

const BLOCK_LABEL: Record<string, [label: string, unit: string]> = {
  relief: ["Relief", "m"],
  hurst: ["How roughness grows with distance", ""],
  linearity: ["Straight features", ""],
  hypsometry: ["Share of high ground", ""],
  depression_area: ["Area in hollows", "share"],
  depression_depth: ["Depth of hollows", ""],
};

const fallback = (key: string) => {
  const words = key.replace(/^d_/, "").replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

export const contributionLabel = (key: string) => CONTRIBUTION_LABEL[key] ?? fallback(key);
export const conditionLabel = (key: string) => CONDITION_LABEL[key] ?? fallback(key);
export const blockLabel = (key: string): [string, string] => BLOCK_LABEL[key] ?? [fallback(key), ""];

export type Bar = { key: string; label: string; value: number };

// logit points, largest first, the zeros left out
export function bars(values: Record<string, number>, label: (key: string) => string): { rows: Bar[]; zero: number } {
  const all = Object.entries(values).map(([key, value]) => ({ key, label: label(key), value }));
  const rows = all.filter((b) => Math.abs(b.value) >= 0.005).sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  return { rows, zero: all.length - rows.length };
}

export const parseTab = (v: string | null | undefined): Tab => (v === "mars" ? "mars" : "moon");

export type Match = { tab: Tab; world: WorldScore; region: Region; site: MatchSite };

// what the result page shows: the tab, then the region (default the best), then the site (default the best match)
export function pickMatch(r: ScoreResult, tabParam?: string | null, regionParam?: string | null, siteParam?: string | null): Match | null {
  const tab = parseTab(tabParam);
  const world = r.worlds[tab];
  if (!world?.regions.length) return null;
  const region = world.regions.find((x) => x.region === regionParam) ?? world.regions.find((x) => x.region === world.best_region) ?? world.regions[0];
  const sites = region.region === world.best_match.region ? [world.best_match, ...region.best] : region.best;
  const site = sites.find((x) => String(x.index) === siteParam) ?? sites[0];
  return site ? { tab, world, region, site } : null;
}

export const CELLS = 8;
const CELL_M = 4000 / CELLS;

export type CellPoint = {
  id: string;
  effect: "help" | "hurt";
  row: number;
  col: number;
  cost: number;
  // cost against the block's average cell
  ratio: number;
  // the matched block's cell this one was paired with
  partner: { row: number; col: number } | null;
  // metres east and north of the block centre
  x_m: number;
  y_m: number;
};

// the 3 cells that match best and the 3 that match worst, row 0 is north
export function cellPoints(site: MatchSite): CellPoint[] {
  const cells = site.cell_cost.flatMap((row, r) => row.map((cost, c) => ({ r, c, cost })));
  if (cells.length === 0) return [];
  const mean = cells.reduce((s, x) => s + x.cost, 0) / cells.length || 1;
  const sorted = [...cells].sort((a, b) => a.cost - b.cost);
  const pick = (list: typeof cells, effect: CellPoint["effect"]) =>
    list.slice(0, 3).map(({ r, c, cost }, n): CellPoint => {
      const p = site.partner[r * CELLS + c];
      return {
        id: `${effect}-${n}`,
        effect,
        row: r,
        col: c,
        cost,
        ratio: cost / mean,
        partner: p == null ? null : { row: Math.floor(p / CELLS), col: p % CELLS },
        x_m: (c + 0.5 - CELLS / 2) * CELL_M,
        y_m: (CELLS / 2 - r - 0.5) * CELL_M,
      };
    });
  return [...pick(sorted, "help"), ...pick(sorted.reverse(), "hurt")];
}
