// 128 px height grid from api/analog_core/grid.py: float32 min and max, then uint16 n x n, row 0 north
export const BLOCK_M = 4000;

export type Grid = {
  n: number;
  cellM: number;
  lo: number;
  hi: number;
  z: Float32Array;
};

export function decodeGrid(buf: ArrayBuffer): Grid {
  if (buf.byteLength < 10) throw new Error("grid file is too short");
  const view = new DataView(buf);
  const lo = view.getFloat32(0, true);
  const hi = view.getFloat32(4, true);
  const count = (buf.byteLength - 8) / 2;
  const n = Math.round(Math.sqrt(count));
  if (n * n !== count) throw new Error(`grid file is not square: ${count} samples`);
  const z = new Float32Array(count);
  const span = hi - lo;
  for (let k = 0; k < count; k++) z[k] = (view.getUint16(8 + 2 * k, true) / 65535) * span + lo;
  return { n, cellM: BLOCK_M / n, lo, hi, z };
}

// same quantisation as the python encoder
export function encodeGrid(z: ArrayLike<number>): ArrayBuffer {
  let lo = Infinity;
  let hi = -Infinity;
  for (let k = 0; k < z.length; k++) {
    if (Number.isNaN(z[k])) continue;
    lo = Math.min(lo, z[k]);
    hi = Math.max(hi, z[k]);
  }
  const buf = new ArrayBuffer(8 + 2 * z.length);
  const view = new DataView(buf);
  view.setFloat32(0, lo, true);
  view.setFloat32(4, hi, true);
  const span = Math.max(hi - lo, 1e-9);
  for (let k = 0; k < z.length; k++) {
    const v = Number.isNaN(z[k]) ? lo : z[k];
    view.setUint16(8 + 2 * k, Math.round(((v - lo) / span) * 65535), true);
  }
  return buf;
}

export const quantStep = (g: Pick<Grid, "lo" | "hi">) => (g.hi - g.lo) / 65535;
