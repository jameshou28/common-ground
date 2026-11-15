export const fmtNum = (v: number, digits = 0) => v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

// 35.027° N, 111.022° W
export function fmtLatLon(lat: number, lon: number): string {
  return `${fmtNum(Math.abs(lat), 3)}° ${lat < 0 ? "S" : "N"}, ${fmtNum(Math.abs(lon), 3)}° ${lon < 0 ? "W" : "E"}`;
}

// metres below 10 km, then km
export function fmtAltitude(m: number): string {
  return m < 10_000 ? `${fmtNum(m)} m` : `${fmtNum(m / 1000)} km`;
}

// a measured value with its unit, three significant figures or so
export function fmtValue(v: number, unit: string): string {
  const n = fmtNum(v, Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 2);
  return unit === "deg" ? `${n}°` : unit === "m" ? `${n} m` : n;
}

// +0.38 or −0.47, with a real minus sign
export const fmtSigned = (v: number) => `${v < 0 ? "−" : "+"}${Math.abs(v).toFixed(2)}`;

// score points, one decimal: +14.1 or −3.8
export const fmtPoints = (v: number) => `${v < 0 ? "−" : "+"}${Math.abs(v).toFixed(1)}`;
