import type { Grid } from "./grid";
import { BLOCK_M } from "./grid";

// scene units are kilometres: x east, y up, z south, so row 0 of a grid (north) sits at -z
export const BLOCK_KM = BLOCK_M / 1000;

// heights of a segs x segs mesh over the block in km above the block's lowest point, row 0 north
export function meshHeights(g: Grid, segs: number, scale: number): Float32Array {
  const out = new Float32Array((segs + 1) * (segs + 1));
  for (let r = 0; r <= segs; r++) {
    const i = Math.round((r * (g.n - 1)) / segs);
    for (let c = 0; c <= segs; c++) {
      const j = Math.round((c * (g.n - 1)) / segs);
      out[r * (segs + 1) + c] = ((g.z[i * g.n + j] - g.lo) * scale) / 1000;
    }
  }
  return out;
}

// the factor that stretches the target's height range onto the block's, so shapes compare and sizes do not
export function matchScale(block: Pick<Grid, "lo" | "hi">, target: Pick<Grid, "lo" | "hi">): number {
  const span = target.hi - target.lo;
  return span > 0 ? (block.hi - block.lo) / span : 1;
}
