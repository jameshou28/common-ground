export const fmtNum = (v: number, digits = 0) => v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

// 35.027° N, 111.022° W
export function fmtLatLon(lat: number, lon: number): string {
  return `${fmtNum(Math.abs(lat), 3)}° ${lat < 0 ? "S" : "N"}, ${fmtNum(Math.abs(lon), 3)}° ${lon < 0 ? "W" : "E"}`;
}

// metres below 10 km, then km
export function fmtAltitude(m: number): string {
  return m < 10_000 ? `${fmtNum(m)} m` : `${fmtNum(m / 1000)} km`;
}
