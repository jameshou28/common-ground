import type { ScoreResult } from "./api";
import type { Breakdown, Match } from "./regions";
import { breakdownOf, landformOf } from "./regions";

type Row = [string, string, unknown];

const breakdownRows = (section: string, bd: Breakdown | null): Row[] =>
  bd
    ? [
        [section, "base", bd.base],
        ...Object.entries(bd.terms).map(([k, v]): Row => [section, k, v]),
        [section, "common", bd.common],
        [section, "earth", bd.earth],
        [section, "total", bd.total],
      ]
    : [];

const feature = (m: Match): Row[] => {
  const lf = landformOf(m.region);
  return lf
    ? [
        ["feature", "tag", lf.tag],
        ["feature", "score", lf.score],
        ["feature", "validated", lf.validated],
        ...breakdownRows("feature_breakdown", breakdownOf(lf)),
      ]
    : [];
};

export const CSV_HEADER = ["tile_id", "model_version", "world", "region", "site", "section", "key", "value"];
const CITE = "Common Ground, NASA Space Apps 2026. Cite the tile id and model version with any use of this data.";

// rfc 4180: quote every field, double any quotes inside
const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

// long format, one number per row, raw values so nothing is lost to rounding
export function toCsv(r: ScoreResult, m: Match): string {
  const rows: [string, string, unknown][] = [
    ...Object.entries(r.block).map(([k, v]) => ["block", k, v] as [string, string, unknown]),
    ...Object.entries(r.env).map(([k, v]) => ["env", k, v] as [string, string, unknown]),
    ...Object.entries(r.conditions.terms).map(([k, v]) => ["conditions", k, v] as [string, string, unknown]),
    ["conditions", "score", r.conditions.score],
    ["conditions", "discount", r.conditions.discount],
    ...Object.entries(m.site.contributions).map(([k, v]) => ["contribution", k, v] as [string, string, unknown]),
    ["score", "overall", m.world.overall],
    ["score", "landscape_score", m.world.landscape_score],
    ["score", "region_overall", m.region.overall],
    ["score", "region_score", m.region.score],
    ...feature(m),
    ...breakdownRows("region_breakdown", breakdownOf(m.region)),
    ...breakdownRows("site_breakdown", breakdownOf(m.site)),
    ["score", "pair_score", m.site.pair_score],
    ["score", "site_lat", m.site.lat],
    ["score", "site_lon", m.site.lon],
  ];
  const lead = [r.tile_id, r.model_version, m.tab, m.region.region, m.site.name];
  return [CSV_HEADER, ...rows.map((x) => [...lead, ...x])].map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}

// the whole result untouched, wrapped with where and when it came from
export function toJson(r: ScoreResult, m: Match, source = typeof location === "undefined" ? "" : location.href): string {
  return JSON.stringify(
    {
      exported_at: new Date().toISOString(),
      source,
      model_version: r.model_version,
      cite: CITE,
      selection: { world: m.tab, region: m.region.region, site_index: m.site.index },
      result: r,
    },
    null,
    2,
  );
}

export const exportName = (r: ScoreResult, m: Match, ext: string) => `analog-${r.tile_id.replace(/:/g, "_")}-${m.tab}.${ext}`;

export function download(name: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}
