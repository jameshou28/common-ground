import type { Grid } from "./grid";

// numpy.percentile, linear interpolation
export function percentile(values: ArrayLike<number>, p: number): number {
  const s = Float64Array.from(values).sort();
  if (s.length === 0) return NaN;
  const pos = (p / 100) * (s.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

// numpy.gradient differences, central inside and one-sided at the edges
export function slopeDeg({ z, n, cellM }: Grid): Float32Array {
  const out = new Float32Array(n * n);
  const d = (a: number, b: number, span: number) => (z[b] - z[a]) / (span * cellM);
  for (let i = 0; i < n; i++) {
    const [i0, i1] = [Math.max(i - 1, 0), Math.min(i + 1, n - 1)];
    for (let j = 0; j < n; j++) {
      const [j0, j1] = [Math.max(j - 1, 0), Math.min(j + 1, n - 1)];
      const gx = d(i * n + j0, i * n + j1, j1 - j0);
      const gy = d(i0 * n + j, i1 * n + j, i1 - i0);
      out[i * n + j] = (Math.atan(Math.hypot(gx, gy)) * 180) / Math.PI;
    }
  }
  return out;
}

export type TerrainStats = { reliefM: number; slopeMedDeg: number; slopeP90Deg: number; minM: number; maxM: number };

export function terrainStats(g: Grid): TerrainStats {
  const slope = slopeDeg(g);
  return {
    reliefM: percentile(g.z, 98) - percentile(g.z, 2),
    slopeMedDeg: percentile(slope, 50),
    slopeP90Deg: percentile(slope, 90),
    minM: g.lo,
    maxM: g.hi,
  };
}

export const SLOPE_BIN_DEG = 3;
export const SLOPE_BINS = 16;

// share of the block in each 3 degree slope band, the last takes everything steeper
export function slopeHistogram(g: Grid, binDeg = SLOPE_BIN_DEG, bins = SLOPE_BINS): number[] {
  const slope = slopeDeg(g);
  const out = new Array<number>(bins).fill(0);
  for (const s of slope) out[Math.min(bins - 1, Math.floor(s / binDeg))]++;
  return out.map((c) => c / slope.length);
}

export function cumulativeSlope(g: Grid, binDeg = SLOPE_BIN_DEG, bins = SLOPE_BINS): number[] {
  let run = 0;
  return slopeHistogram(g, binDeg, bins).map((v) => (run += v));
}
