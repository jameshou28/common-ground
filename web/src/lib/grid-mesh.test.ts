import { describe, expect, it } from "vitest";
import type { Grid } from "./grid";
import { matchScale, meshHeights } from "./grid-mesh";

// 4 x 4 ramp, 100 m in the north-west corner rising to 400 m along the south edge
const z = Float32Array.from([100, 100, 100, 100, 200, 200, 200, 200, 300, 300, 300, 300, 400, 400, 400, 400]);
const g: Grid = { n: 4, cellM: 1000, lo: 100, hi: 400, z };

describe("grid mesh", () => {
  it("keeps row 0 north and measures from the lowest point in km", () => {
    const h = meshHeights(g, 3, 1);
    expect(Array.from(h.slice(0, 4))).toEqual([0, 0, 0, 0]);
    expect(h[12]).toBeCloseTo(0.3, 6);
  });
  it("applies relief and resamples to fewer segments", () => {
    const h = meshHeights(g, 1, 2);
    expect(h).toHaveLength(4);
    expect(h[3]).toBeCloseTo(0.6, 6);
  });
  it("matched relief equalises the two ranges", () => {
    const target = { lo: 0, hi: 900 };
    const s = matchScale(g, target);
    expect((target.hi - target.lo) * s).toBeCloseTo(g.hi - g.lo, 9);
    expect(matchScale(g, { lo: 5, hi: 5 })).toBe(1);
  });
});
