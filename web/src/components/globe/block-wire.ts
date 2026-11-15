import type { Grid } from "@/lib/grid";
import { matchScale } from "@/lib/grid-mesh";
import type { Tile } from "@/lib/tiles";
import type { CesiumNS } from "./cesium";
import type { GlobeHandle } from "./use-cesium-viewer";

const N = 25;

// the matched block drawn as coloured lines over the real, textured block, stretched to its height range; returns the undo
export function drawBlockWire(handle: GlobeHandle, tile: Tile, block: Grid, over: Grid, ex: number) {
  const { C, v, ellipsoid } = handle;
  const scene = v.scene;
  const [sw, , ne] = tile.corners;
  const lon = (c: number) => sw[0] + (c / (N - 1)) * (ne[0] - sw[0]);
  const lat = (r: number) => ne[1] - (r / (N - 1)) * (ne[1] - sw[1]);
  // grids are row 0 north, nearest cell
  const at = (g: Grid, r: number, c: number) => g.z[Math.round((r * (g.n - 1)) / (N - 1)) * g.n + Math.round((c * (g.n - 1)) / (N - 1))];
  const k = matchScale(block, over);
  let dead = false;
  // full resolution while the lines are up, at the reduced default thin lines shimmer as the camera moves
  const scale = v.resolutionScale;
  v.resolutionScale = 1;
  let prim: CesiumNS.Primitive | null = null;

  (async () => {
    // the grid heights and cesium's terrain differ by the geoid, measure the gap on a few points
    const probe: [number, number][] = [];
    for (let r = 4; r < N; r += 8) for (let c = 4; c < N; c += 8) probe.push([r, c]);
    let offset = 0;
    try {
      await handle.terrainReady;
      const s = await C.sampleTerrainMostDetailed(
        v.terrainProvider,
        probe.map(([r, c]) => C.Cartographic.fromDegrees(lon(c), lat(r))),
      );
      const gaps = s.map((p, i) => (p?.height ?? NaN) - at(block, ...probe[i])).filter(Number.isFinite);
      if (gaps.length) offset = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    } catch {
      // without samples the lines sit on the grid heights
    }
    if (dead || v.isDestroyed()) return;

    const [lo, hi] = [over.lo, over.hi];
    const point = (r: number, c: number) => {
      const z = at(over, r, c);
      const h = (block.lo + offset + (z - over.lo) * k) * ex + 6;
      const t = hi > lo ? (z - lo) / (hi - lo) : 0.5;
      return [C.Cartesian3.fromDegrees(lon(c), lat(r), h, ellipsoid), C.Color.fromHsl(0.6 - t * 0.45, 1, 0.6 + t * 0.1)] as const;
    };
    const line = (pts: (readonly [unknown, unknown])[]) =>
      new C.GeometryInstance({
        geometry: new C.PolylineGeometry({
          positions: pts.map((p) => p[0]) as never,
          colors: pts.map((p) => p[1]) as never,
          colorsPerVertex: true,
          width: 1,
          arcType: C.ArcType.NONE,
          ellipsoid,
        }),
      });
    const lines = [];
    for (let i = 0; i < N; i++) {
      lines.push(line(Array.from({ length: N }, (_, j) => point(i, j))));
      lines.push(line(Array.from({ length: N }, (_, j) => point(j, i))));
    }
    // no depth test, so ground standing above the match never hides its lines
    prim = scene.primitives.add(
      new C.Primitive({
        geometryInstances: lines,
        appearance: new C.PolylineColorAppearance({ translucent: false, renderState: { depthTest: { enabled: false } } }),
        asynchronous: false,
      }),
    );
    scene.requestRender();
  })();

  return () => {
    dead = true;
    if (!v.isDestroyed()) {
      v.resolutionScale = scale;
      scene.requestRender();
    }
    if (prim && !v.isDestroyed()) {
      scene.primitives.remove(prim);
      scene.requestRender();
    }
  };
}
