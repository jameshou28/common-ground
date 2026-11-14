// 4 km tile ids, mirror of api/analog_core/tiles.py: lat/lon grid below 80 deg, polar stereographic above
export type World = "earth" | "moon" | "mars";
export const WORLDS = ["earth", "moon", "mars"] as const satisfies readonly World[];

export const RADIUS_M: Record<World, number> = { earth: 6_371_000, moon: 1_737_400, mars: 3_389_500 };
export const TILE_SIZE_M = 4000;
const POLAR_LAT = 80;
const DEG = Math.PI / 180;

export const TILE_RE = /^(earth|moon|mars):(g:-?\d{1,5}:-?\d{1,5}|ps:[ns]:-?\d{1,4}:-?\d{1,4})$/;

export type LonLat = [lon: number, lat: number];
export type Tile = {
  id: string;
  world: World;
  center: { lat: number; lon: number };
  // [lon, lat], counter-clockwise from south-west
  corners: [LonLat, LonLat, LonLat, LonLat];
};

const wrapLon = (lon: number) => ((((lon + 180) % 360) + 360) % 360) - 180;

export function isTileId(id: string): boolean {
  return TILE_RE.test(id);
}

export function worldOf(id: string): World | null {
  return isTileId(id) ? (id.split(":")[0] as World) : null;
}

type Polar = { fwd: (lat: number, lon: number) => [number, number]; inv: (x: number, y: number) => LonLat };
function polar(world: World, south: boolean): Polar {
  const R = RADIUS_M[world];
  return {
    fwd(lat, lon) {
      const rho = 2 * R * Math.tan(Math.PI / 4 - (Math.abs(lat) * DEG) / 2);
      return [rho * Math.sin(lon * DEG), (south ? 1 : -1) * rho * Math.cos(lon * DEG)];
    },
    inv(x, y) {
      const rho = Math.hypot(x, y);
      const lat = 90 - (2 * Math.atan(rho / (2 * R))) / DEG;
      return [Math.atan2(x, south ? y : -y) / DEG, south ? -lat : lat];
    },
  };
}

function gridCorners(world: World, i: number, j: number): Tile["corners"] {
  const dphi = TILE_SIZE_M / RADIUS_M[world] / DEG;
  const clat = i * dphi;
  const dlam = dphi / Math.cos(clat * DEG);
  const clon = j * dlam;
  return [
    [clon - dlam / 2, clat - dphi / 2],
    [clon + dlam / 2, clat - dphi / 2],
    [clon + dlam / 2, clat + dphi / 2],
    [clon - dlam / 2, clat + dphi / 2],
  ];
}

export function tileFor(world: World, lat: number, lon: number): Tile {
  const R = RADIUS_M[world];
  if (Math.abs(lat) < POLAR_LAT) {
    const dphi = TILE_SIZE_M / R / DEG;
    const i = Math.round(lat / dphi);
    const dlam = dphi / Math.cos(i * dphi * DEG);
    const j = Math.round(wrapLon(lon) / dlam);
    return tileFromId(`${world}:g:${i}:${j}`);
  }
  const south = lat < 0;
  const [x, y] = polar(world, south).fwd(lat, lon);
  return tileFromId(`${world}:ps:${south ? "s" : "n"}:${Math.round(x / TILE_SIZE_M)}:${Math.round(y / TILE_SIZE_M)}`);
}

// throws on a malformed id or a tile off the planet
export function tileFromId(id: string): Tile {
  if (!isTileId(id)) throw new Error(`bad tile id: ${id}`);
  const [w, kind, ...rest] = id.split(":");
  const world = w as World;
  if (kind === "g") {
    const [i, j] = [Number(rest[0]), Number(rest[1])];
    const dphi = TILE_SIZE_M / RADIUS_M[world] / DEG;
    const lat = i * dphi;
    if (Math.abs(lat) >= 90) throw new Error(`tile off the planet: ${id}`);
    const corners = gridCorners(world, i, j);
    const clon = (corners[0][0] + corners[1][0]) / 2;
    return { id, world, center: { lat, lon: wrapLon(clon) }, corners };
  }
  const south = rest[0] === "s";
  const [ix, iy] = [Number(rest[1]), Number(rest[2])];
  const { inv } = polar(world, south);
  const s = TILE_SIZE_M;
  const [lon, lat] = inv(ix * s, iy * s);
  return {
    id,
    world,
    center: { lat, lon },
    corners: [inv((ix - 0.5) * s, (iy - 0.5) * s), inv((ix + 0.5) * s, (iy - 0.5) * s), inv((ix + 0.5) * s, (iy + 0.5) * s), inv((ix - 0.5) * s, (iy + 0.5) * s)],
  };
}

export const tileCenter = (id: string) => tileFromId(id).center;
