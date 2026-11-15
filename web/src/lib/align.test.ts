import { describe, expect, it } from "vitest";
import { alignBlock, alignedCell, describeAlignment, turnGrid, turnPoint } from "./align";
import type { Grid } from "./grid";

const K = 128;
const PAD = 32;
const N = K + 2 * PAD;

// a padded moon block: gentle tilt, a bowl at (cy, cx) and a smaller knob, so turns are tellable apart
function padded(cy: number, cx: number): Grid {
  const z = new Float32Array(N * N);
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      const bowl = -60 * Math.exp(-((r - cy) ** 2 + (c - cx) ** 2) / (2 * 14 ** 2));
      const knob = 25 * Math.exp(-((r - cy + 30) ** 2 + (c - cx - 18) ** 2) / (2 * 6 ** 2));
      z[r * N + c] = 0.3 * r + bowl + knob;
    }
  return grid(z, N);
}

function grid(z: Float32Array, n: number): Grid {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of z) {
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  return { n, cellM: 4000 / K, lo, hi, z };
}

// the earth block: the k x k window of z (n x n) at (y0, x0), with a different tilt
function window(z: Float32Array, n: number, y0: number, x0: number): Grid {
  const out = new Float32Array(K * K);
  for (let r = 0; r < K; r++) for (let c = 0; c < K; c++) out[r * K + c] = z[(y0 + r) * n + x0 + c] - 0.2 * c;
  return grid(out, K);
}

describe("turns", () => {
  it("turnPoint is where turnGrid puts a pixel", () => {
    const n = 5;
    const z = Float32Array.from({ length: n * n }, (_, i) => i);
    for (let t = 0; t < 8; t++) {
      const zt = turnGrid(z, n, t);
      for (let r = 0; r < n; r++)
        for (let c = 0; c < n; c++) {
          const [rr, cc] = turnPoint(r, c, n, t);
          expect(zt[rr * n + cc]).toBe(z[r * n + c]);
        }
    }
  });
});

describe("alignBlock", () => {
  it("brings an off-centre bowl back under the earth block's bowl", () => {
    // moon bowl 20 px east and 12 px north of the block centre; earth block centred on its own bowl
    const p = padded(N / 2 - 12, N / 2 + 20);
    const earth = window(p.z, N, PAD - 12, PAD + 20);
    const a = alignBlock(earth, p, PAD);
    // within a pixel: the earth window is tilted differently on purpose, and the tilt term can nudge the pick by one
    expect(a.turn).toBe(0);
    expect(Math.abs(a.dx - 20)).toBeLessThanOrEqual(1);
    expect(Math.abs(a.dy + 12)).toBeLessThanOrEqual(1);
    expect(a.after).toBeGreaterThan(0.98);
    expect(a.after - a.before).toBeGreaterThan(0.1);
    expect(a.grid.n).toBe(K);
    expect(describeAlignment(a, a.grid.cellM)).toMatch(/^moved 0\.7 km/);
  });
  it("finds a turn", () => {
    const p = padded(N / 2 + 8, N / 2 - 6);
    const turned = turnGrid(p.z, N, 1);
    // the earth block is the turned block, so lining up has to turn the moon one quarter too
    const [ty, tx] = turnPoint(N / 2 + 8, N / 2 - 6, N, 1);
    const earth = window(turned, N, ty - K / 2, tx - K / 2);
    const a = alignBlock(earth, p, PAD);
    expect(a.turn).toBe(1);
    expect(a.after).toBeGreaterThan(0.99);
  });
  it("keeps the cut when lining up gains little", () => {
    const p = padded(N / 2, N / 2);
    const a = alignBlock(window(p.z, N, PAD, PAD), p, PAD);
    expect([a.turn, a.dx, a.dy]).toEqual([0, 0, 0]);
    expect(describeAlignment(a, a.grid.cellM)).toBeNull();
  });
  it("moves cell pairings with the view", () => {
    const p = padded(N / 2 - 12, N / 2 + 20);
    const a = alignBlock(window(p.z, N, PAD - 12, PAD + 20), p, PAD);
    // the view is 20 px east and 12 px north of the cut (16 px cells): the cut's cell (4, 3), centred at
    // (72, 56) px, sits at (84, 36) px in the view, which is cell (5, 2)
    expect(alignedCell(a, 4, 3)).toEqual({ row: 5, col: 2 });
    // the west column of the cut is outside the shifted view
    expect(alignedCell(a, 4, 0)).toBeNull();
  });
});
