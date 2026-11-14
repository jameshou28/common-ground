import { describe, expect, it } from "vitest";
import { decodeGrid, encodeGrid, quantStep } from "./grid";
import { cumulativeSlope, percentile, slopeDeg, slopeHistogram, terrainStats } from "./terrain";

const N = 128;
const make = (f: (i: number, j: number) => number) => {
  const z = new Float32Array(N * N);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) z[i * N + j] = f(i, j);
  return z;
};

describe("grid file", () => {
  it("round trips within one quantisation step", () => {
    const z = make((i, j) => 1500 + 80 * Math.sin(i / 9) + 0.4 * j);
    const g = decodeGrid(encodeGrid(z));
    expect(g.n).toBe(N);
    expect(g.cellM).toBeCloseTo(31.25);
    const step = quantStep(g);
    for (let k = 0; k < z.length; k += 97) expect(Math.abs(g.z[k] - z[k])).toBeLessThanOrEqual(step);
  });

  it("rejects a file that is not a square grid", () => {
    expect(() => decodeGrid(new ArrayBuffer(8 + 2 * 10))).toThrow();
    expect(() => decodeGrid(new ArrayBuffer(4))).toThrow();
  });
});

describe("terrain", () => {
  it("matches numpy.percentile", () => {
    expect(percentile([1, 2, 3, 4], 50)).toBe(2.5);
    expect(percentile([1, 2, 3, 4], 90)).toBeCloseTo(3.7);
  });

  it("reads a flat plane as flat", () => {
    const s = terrainStats(decodeGrid(encodeGrid(make(() => 300))));
    expect(s.reliefM).toBeCloseTo(0);
    expect(s.slopeMedDeg).toBeCloseTo(0);
  });

  it("recovers a 20 degree ramp within 2%", () => {
    const rise = Math.tan((20 * Math.PI) / 180) * 31.25;
    const g = decodeGrid(encodeGrid(make((i) => i * rise)));
    const s = terrainStats(g);
    expect(s.slopeMedDeg).toBeGreaterThan(20 * 0.98);
    expect(s.slopeMedDeg).toBeLessThan(20 * 1.02);
    expect(Math.max(...slopeDeg(g))).toBeLessThan(20.5);
  });

  it("measures the relief of a hill from its 2nd and 98th percentiles", () => {
    const g = decodeGrid(encodeGrid(make((i, j) => 200 * Math.exp(-(((i - 64) ** 2 + (j - 64) ** 2) / 800)))));
    const s = terrainStats(g);
    expect(s.reliefM).toBeGreaterThan(100);
    expect(s.reliefM).toBeLessThanOrEqual(200);
  });

  it("histogram sums to one and the cumulative curve ends at one", () => {
    const g = decodeGrid(encodeGrid(make((i, j) => 40 * Math.sin(i / 6) * Math.cos(j / 7))));
    expect(slopeHistogram(g).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    const c = cumulativeSlope(g);
    expect(c.at(-1)).toBeCloseTo(1);
    expect([...c].sort((a, b) => a - b)).toEqual(c);
  });
});
