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
  // v2.0
  tpi_near: "Height against nearby ground",
  tpi_far: "Height against the wider area",
  d_spec1: "Broad swells",
  d_spec2: "Large bumps",
  d_spec3: "Medium bumps",
  d_spec4: "Small bumps",
  d_spec5: "Fine bumps",
  d_spec6: "Finest texture",
  d_bowl: "Bowl shape",
  d_bowl_r: "Bowl size",
  d_cone: "Cone shape",
  d_cone_r: "Cone size",
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

// largest first, the ones under min left out
export function bars(values: Record<string, number>, label: (key: string) => string, min = 0.005): { rows: Bar[]; zero: number } {
  const all = Object.entries(values).map(([key, value]) => ({ key, label: label(key), value }));
  const rows = all.filter((b) => Math.abs(b.value) >= min).sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  return { rows, zero: all.length - rows.length };
}

// v2.0.1: a score split into score points that add up to it: base + terms + common + earth = total
export type Breakdown = { base: number; terms: Record<string, number>; common: number; earth: number; total: number };

export type Landform = {
  tag: string;
  label: string;
  score: number;
  similarity: number;
  earth_percentile?: number;
  validated: boolean;
  badge?: boolean;
  matches: { index: number; name: string; lat: number; lon: number }[];
  breakdown?: Breakdown;
};

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

// older cached results have no breakdown, so read it defensively
export function breakdownOf(x: unknown): Breakdown | null {
  const b = (x as { breakdown?: unknown } | null | undefined)?.breakdown as Partial<Breakdown> | undefined;
  if (!b || !isNum(b.base) || !isNum(b.common) || !isNum(b.earth) || !isNum(b.total) || typeof b.terms !== "object" || !b.terms) return null;
  return b as Breakdown;
}

export function landformOf(region: Region): Landform | null {
  const lf = region.landform as Partial<Landform> | null | undefined;
  return lf && typeof lf.tag === "string" && isNum(lf.score) ? (lf as Landform) : null;
}

// a feature tag as a plural for sentences: "wrinkle ridges in lunar maria"
export const landformPlural = (lf: Landform) => {
  const l = lf.label.toLowerCase();
  return /(s|x|sh|ch)$/.test(l) ? l : l.endsWith("y") && !/[aeiou]y$/.test(l) ? `${l.slice(0, -1)}ies` : `${l}s`;
};

// score points under this round to nothing at one decimal
export const MIN_POINTS = 0.05;

// what the two adjustments are measured against: "Moon", "lunar maria", and the share of random Earth land this block beats
export type BreakdownContext = { world: string; target: string; earthPercentile?: number | null };

// the two adjustments, named after what they measure
export function adjustmentLabels(ctx: BreakdownContext): { common: string; earth: string } {
  const pct = ctx.earthPercentile;
  return {
    // library weighting: matches against moon/mars blocks that much of Earth also matches count less
    common: `Discount: the closest ${ctx.world} blocks also match much of Earth`,
    // earth factor: floor + (1 - floor) x the share of random Earth land this block is more similar than
    earth:
      pct == null
        ? `Earth factor: how ${ctx.target} this is next to random Earth land`
        : `Earth factor: more like ${ctx.target} than ${Math.round(pct)}% of Earth land`,
  };
}

// the measurement rows plus the two adjustments, in score points
export function breakdownBars(bd: Breakdown, ctx?: BreakdownContext): { rows: Bar[]; zero: number } {
  const { rows, zero } = bars(bd.terms, contributionLabel, MIN_POINTS);
  const label = ctx ? adjustmentLabels(ctx) : { common: "Discount for terrain common on Earth", earth: "Earth factor" };
  const extra: Bar[] = [
    { key: "_common", label: label.common, value: bd.common },
    { key: "_earth", label: label.earth, value: bd.earth },
  ].filter((b) => Math.abs(b.value) >= MIN_POINTS);
  return { rows: [...rows, ...extra].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)), zero };
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
  // weak: among the least helpful cells, but still adds a little
  effect: "help" | "hurt" | "weak";
  // v2.0.1: the cell's share of the score in score points, and what all 64 cells add up to
  points?: number;
  total?: number;
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

const cellPointsOf = (site: MatchSite): number[][] | null => {
  const v = site.cell_points;
  return Array.isArray(v) && v.length === CELLS && v.every((row) => Array.isArray(row) && row.length === CELLS) ? (v as number[][]) : null;
};

// the 3 cells that help most and the 3 that help least, row 0 is north.
// v2.0.1 results rank by each cell's share of the score (cell_points), older ones by the raw mismatch (cell_cost)
// mapPartner moves a paired cell of the matched block into the lined-up view (null = outside it)
export function cellPoints(site: MatchSite, mapPartner?: (row: number, col: number) => { row: number; col: number } | null): CellPoint[] {
  const pts = cellPointsOf(site);
  const costs = site.cell_cost ?? [];
  const cells = (pts ?? costs).flatMap((row, r) => row.map((_, c) => ({ r, c, cost: costs[r]?.[c] ?? 0, points: pts?.[r][c] })));
  if (cells.length === 0) return [];
  const mean = cells.reduce((s, x) => s + x.cost, 0) / cells.length || 1;
  const total = pts ? cells.reduce((s, x) => s + (x.points ?? 0), 0) : undefined;
  // best first
  const sorted = pts ? [...cells].sort((a, b) => b.points! - a.points!) : [...cells].sort((a, b) => a.cost - b.cost);
  const effectOf = (x: (typeof cells)[number], top: boolean): CellPoint["effect"] =>
    x.points == null ? (top ? "help" : "hurt") : x.points < 0 ? "hurt" : top ? "help" : "weak";
  const pick = (list: typeof cells, top: boolean) =>
    list.slice(0, 3).map((x, n): CellPoint => {
      const p = site.partner?.[x.r * CELLS + x.c];
      return {
        id: `${top ? "top" : "bottom"}-${n}`,
        effect: effectOf(x, top),
        points: x.points,
        total,
        row: x.r,
        col: x.c,
        cost: x.cost,
        ratio: x.cost / mean,
        partner: p == null ? null : mapPartner ? mapPartner(Math.floor(p / CELLS), p % CELLS) : { row: Math.floor(p / CELLS), col: p % CELLS },
        x_m: (x.c + 0.5 - CELLS / 2) * CELL_M,
        y_m: (CELLS / 2 - x.r - 0.5) * CELL_M,
      };
    });
  return [...pick(sorted, true), ...pick([...sorted].reverse(), false)];
}
