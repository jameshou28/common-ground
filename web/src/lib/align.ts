import type { Grid } from "./grid";

// lines up a matched moon or mars block with the clicked earth block, for display only. the api sends the matched
// block with pad px of margin on every side; we try the 8 turns and flips and every shift within that margin, and
// keep the 128 px window whose shape correlates best with the earth block. the score isn't touched: it's still the
// one for the block as the model cut it.

// t = quarter turns clockwise (0-3), + 4 if mirrored east-west first
export type Turn = number;

export type Alignment = {
  grid: Grid;
  turn: Turn;
  // the window's offset from the catalogue position, in pixels of the turned grid (+x east, +y south)
  dx: number;
  dy: number;
  // correlation of the shapes before and after lining up
  before: number;
  after: number;
  // where the shown window sits in the padded grid, to move cell pairings along with it
  pad: number;
  size: number;
};

// keep the original cut unless lining up improves the correlation by at least MIN_GAIN and ends up at least MIN_FIT:
// a weak fit moved around is no better than the cut
export const MIN_GAIN = 0.05;
export const MIN_FIT = 0.3;

// (r, c) of the turned grid -> (r, c) of the original grid, both n x n
function source(r: number, c: number, n: number, t: Turn): [number, number] {
  let rr = r;
  let cc = c;
  // undo the turns: one clockwise quarter turn sends (r, c) to (c, n - 1 - r)
  for (let k = 0; k < t % 4; k++) [rr, cc] = [n - 1 - cc, rr];
  if (t >= 4) cc = n - 1 - cc;
  return [rr, cc];
}

// (r, c) of the original grid -> (r, c) of the turned grid, the inverse of source
export function turnPoint(r: number, c: number, n: number, t: Turn): [number, number] {
  let rr = r;
  let cc = t >= 4 ? n - 1 - c : c;
  for (let k = 0; k < t % 4; k++) [rr, cc] = [cc, n - 1 - rr];
  return [rr, cc];
}

export function turnGrid(z: Float32Array, n: number, t: Turn): Float32Array {
  if (t === 0) return z;
  const out = new Float32Array(n * n);
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      const [sr, sc] = source(r, c, n, t);
      out[r * n + c] = z[sr * n + sc];
    }
  return out;
}

// heights minus their best-fit plane, so a tilt doesn't count as shape
export function detrend(z: Float32Array, n: number): Float32Array {
  let sz = 0, sxx = 0, syy = 0, sxz = 0, syz = 0;
  const m = (n - 1) / 2;
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      const x = c - m, y = r - m, v = z[r * n + c];
      sz += v; sxx += x * x; syy += y * y; sxz += x * v; syz += y * v;
    }
  const N = n * n;
  // x and y are centred and independent on a full square, so the plane fit separates
  const a = sxz / (sxx || 1), b = syz / (syy || 1), c0 = sz / N;
  const out = new Float32Array(N);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) out[r * n + c] = z[r * n + c] - (c0 + a * (c - m) + b * (r - m));
  return out;
}

// average f x f pixels into one
export function downsample(z: Float32Array, n: number, f: number): Float32Array {
  const k = Math.floor(n / f);
  const out = new Float32Array(k * k);
  for (let r = 0; r < k * f; r++) for (let c = 0; c < k * f; c++) out[Math.floor(r / f) * k + Math.floor(c / f)] += z[r * n + c] / (f * f);
  return out;
}

// the template as zero mean, unit length
function normalise(t: Float32Array): Float32Array {
  let mean = 0;
  for (const v of t) mean += v / t.length;
  let ss = 0;
  const out = new Float32Array(t.length);
  for (let i = 0; i < t.length; i++) {
    out[i] = t[i] - mean;
    ss += out[i] * out[i];
  }
  const s = Math.sqrt(ss) || 1;
  for (let i = 0; i < t.length; i++) out[i] /= s;
  return out;
}

// normalised cross-correlation of template tn (k x k, from normalise) with the k x k window of z (n x n) at (y0, x0)
function ncc(z: Float32Array, n: number, tn: Float32Array, k: number, y0: number, x0: number): number {
  let s = 0, s1 = 0, s2 = 0;
  for (let r = 0; r < k; r++) {
    const row = (y0 + r) * n + x0;
    for (let c = 0; c < k; c++) {
      const v = z[row + c];
      s += v * tn[r * k + c];
      s1 += v;
      s2 += v * v;
    }
  }
  const N = k * k;
  const varW = s2 - (s1 * s1) / N;
  return varW > 1e-9 ? s / Math.sqrt(varW) : 0;
}

export function alignBlock(block: Grid, padded: Grid, pad: number): Alignment {
  const k = block.n;
  const n = padded.n;
  const plain: Alignment = { grid: crop(padded.z, n, pad, pad, k, block.cellM), turn: 0, dx: 0, dy: 0, before: 0, after: 0, pad, size: k };
  if (pad <= 0 || n !== k + 2 * pad) return { ...plain, grid: pad > 0 ? plain.grid : padded };
  const tFull = normalise(detrend(block.z, k));
  const pFull = detrend(padded.z, n);
  const before = ncc(pFull, n, tFull, k, pad, pad);

  // coarse: 4 px steps, every turn and shift
  const f = 4;
  const kc = Math.floor(k / f), nc = Math.floor(n / f), pc = Math.floor(pad / f);
  const tC = normalise(downsample(tFull, k, f));
  const pC = downsample(pFull, n, f);
  let best = { t: 0, y: pc, x: pc, v: -Infinity };
  for (let t = 0; t < 8; t++) {
    const z = turnGrid(pC, nc, t);
    for (let y = 0; y <= 2 * pc; y++)
      for (let x = 0; x <= 2 * pc; x++) {
        const v = ncc(z, nc, tC, kc, y, x);
        if (v > best.v) best = { t, y, x, v };
      }
  }
  // fine: full resolution around the coarse winner, for its turn
  const zt = turnGrid(pFull, n, best.t);
  let fine = { y: best.y * f, x: best.x * f, v: -Infinity };
  for (let y = Math.max(0, best.y * f - f); y <= Math.min(2 * pad, best.y * f + f); y++)
    for (let x = Math.max(0, best.x * f - f); x <= Math.min(2 * pad, best.x * f + f); x++) {
      const v = ncc(zt, n, tFull, k, y, x);
      if (v > fine.v) fine = { y, x, v };
    }
  if (fine.v - before < MIN_GAIN || fine.v < MIN_FIT) return { ...plain, before, after: before };
  return {
    grid: crop(turnGrid(padded.z, n, best.t), n, fine.y, fine.x, k, block.cellM),
    turn: best.t,
    dx: fine.x - pad,
    dy: fine.y - pad,
    before,
    after: fine.v,
    pad,
    size: k,
  };
}

function crop(z: Float32Array, n: number, y0: number, x0: number, k: number, cellM: number): Grid {
  const out = new Float32Array(k * k);
  let lo = Infinity, hi = -Infinity;
  for (let r = 0; r < k; r++)
    for (let c = 0; c < k; c++) {
      const v = z[(y0 + r) * n + x0 + c];
      out[r * k + c] = v;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  return { n: k, cellM, lo, hi, z: out };
}

// a cell of the matched block as the model cut it (8 x 8, row 0 north) -> the same ground in the lined-up view,
// or null if it's outside the shown window
export function alignedCell(a: Alignment, row: number, col: number, cells = 8): { row: number; col: number } | null {
  const n = a.size + 2 * a.pad;
  const px = a.size / cells;
  // centre of the cell in the padded grid
  const [r, c] = turnPoint(a.pad + (row + 0.5) * px - 0.5, a.pad + (col + 0.5) * px - 0.5, n, a.turn);
  const y = r + 0.5 - (a.pad + a.dy);
  const x = c + 0.5 - (a.pad + a.dx);
  if (y < 0 || x < 0 || y >= a.size || x >= a.size) return null;
  return { row: Math.floor(y / px), col: Math.floor(x / px) };
}

const TURN_TEXT = ["", "turned a quarter clockwise", "turned half way", "turned a quarter anticlockwise"];

// "moved 0.6 km and turned a quarter clockwise to line up", or null when nothing moved
export function describeAlignment(a: Alignment, cellM: number): string | null {
  if (a.turn === 0 && a.dx === 0 && a.dy === 0) return null;
  const km = (Math.hypot(a.dx, a.dy) * cellM) / 1000;
  const parts = [km >= 0.05 ? `moved ${km.toFixed(1)} km` : "", a.turn >= 4 ? "mirrored" : "", TURN_TEXT[a.turn % 4]].filter(Boolean);
  return parts.length ? `${parts.join(", ")} to line up` : null;
}
