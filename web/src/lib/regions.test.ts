import { describe, expect, it } from "vitest";
import type { ScoreResult } from "./api";
import { bars, cellPoints, contributionLabel, parseTab, pickMatch } from "./regions";
import meteor from "./fixtures/meteor_score.json";

// meteor crater from the local api with the smoke model, nov 14
const r = meteor as unknown as ScoreResult;

describe("pickMatch", () => {
  it("defaults to the moon, its best region and its best match", () => {
    const m = pickMatch(r)!;
    expect(m.tab).toBe("moon");
    expect(m.region.region).toBe(r.worlds.moon.best_region);
    expect(m.site.index).toBe(r.worlds.moon.best_match.index);
  });
  it("follows the url, and falls back when a value is unknown", () => {
    const mars = r.worlds.mars;
    const other = mars.regions.find((x) => x.region !== mars.best_region)!;
    const m = pickMatch(r, "mars", other.region, String(other.best[1].index))!;
    expect([m.tab, m.region.region, m.site.index]).toEqual(["mars", other.region, other.best[1].index]);
    expect(pickMatch(r, "venus", "nope", "nope")!.region.region).toBe(r.worlds.moon.best_region);
    expect(parseTab("mars")).toBe("mars");
  });
});

describe("cells", () => {
  it("picks the 3 cheapest cells as helps and the 3 costliest as hurts", () => {
    const site = r.worlds.moon.best_match;
    const pts = cellPoints(site);
    const costs = site.cell_cost.flat().sort((a, b) => a - b);
    expect(pts.map((p) => p.effect)).toEqual(["help", "help", "help", "hurt", "hurt", "hurt"]);
    expect(pts[0].cost).toBe(costs[0]);
    expect(pts[3].cost).toBe(costs[costs.length - 1]);
    // row 0 is north, so a north-west cell sits at -x and +y
    const nw = cellPoints({ ...site, cell_cost: site.cell_cost.map((row, i) => row.map((_, j) => (i === 0 && j === 0 ? -1 : 1))) })[0];
    expect([nw.row, nw.col, nw.x_m, nw.y_m]).toEqual([0, 0, -1750, 1750]);
  });
});

describe("labels and bars", () => {
  it("names known keys, falls back on new ones, drops zeros", () => {
    expect(contributionLabel("shadow_low")).toBe("Shadow at a low Sun");
    expect(contributionLabel("d_new_thing")).toBe("New thing");
    const { rows, zero } = bars({ a: 0, b: -0.3, c: 0.5 }, (k) => k);
    expect(rows.map((x) => x.key)).toEqual(["c", "b"]);
    expect(zero).toBe(1);
  });
});
