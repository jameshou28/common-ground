import { describe, expect, it } from "vitest";
import type { ScoreResult } from "./api";
import { CSV_HEADER, exportName, toCsv, toJson } from "./export";
import { pickMatch } from "./regions";
import meteor from "./fixtures/meteor_score.json";

const r = meteor as unknown as ScoreResult;
const m = pickMatch(r)!;

// minimal rfc 4180 reader, enough to check quoting round trips
const parse = (s: string) =>
  s.trimEnd().split("\r\n").map((line) => [...line.matchAll(/"((?:[^"]|"")*)"/g)].map((x) => x[1].replace(/""/g, '"')));

describe("csv export", () => {
  it("has the header and one row per number", () => {
    const rows = parse(toCsv(r, m));
    expect(rows[0]).toEqual(CSV_HEADER);
    const n = [r.block, r.env, r.conditions.terms, m.site.contributions].reduce((a, o) => a + Object.keys(o).length, 0);
    // + region_overall and region_score; this older fixture has no feature or breakdowns
    expect(rows.length - 1).toBe(n + 2 + 7);
    expect(rows.every((x) => x.length === CSV_HEADER.length)).toBe(true);
  });
  it("survives commas and quotes in a site name", () => {
    const odd = { ...m, site: { ...m.site, name: 'Crater, "the big one"' } };
    expect(parse(toCsv(r, odd))[1][4]).toBe('Crater, "the big one"');
  });
});

describe("json export", () => {
  it("keeps the result lossless", () => {
    const j = JSON.parse(toJson(r, m, "http://x"));
    expect(j.result).toEqual(r);
    expect(j.selection).toEqual({ world: m.tab, region: m.region.region, site_index: m.site.index });
  });
  it("names files from the tile", () => {
    expect(exportName(r, m, "csv")).toMatch(/^analog-[^:]+-moon\.csv$/);
  });
});
