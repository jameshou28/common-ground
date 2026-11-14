"use client";

import { useEffect, useRef, useState } from "react";
import type { CellPoint } from "@/lib/regions";
import type { Tile, World } from "@/lib/tiles";
import { FeaturePoints } from "@/components/site/feature-points";
import type { CesiumLib, CesiumNS } from "./cesium";
import { FOOTPRINT_COLOR } from "./config";
import type { GlobeHandle } from "./use-cesium-viewer";
import { globeControls } from "./use-globe-controls";

const WALL: Record<World, string> = {
  earth: "#6b5240",
  moon: "#5c5b5f",
  mars: "#8a4b31",
};
// wall points per block edge
const EDGE_SAMPLES = 48;

type Lifted = { ring: CesiumNS.Cartesian3[]; heights: number[] };

// the camera is locked to the block here, any drag orbits it
function blockControls(
  C: CesiumLib,
  ctl: CesiumNS.ScreenSpaceCameraController,
) {
  const T = C.CameraEventType;
  ctl.zoomEventTypes = [T.WHEEL, T.PINCH];
  ctl.rotateEventTypes = [T.LEFT_DRAG, T.RIGHT_DRAG, T.MIDDLE_DRAG];
  ctl.tiltEventTypes = undefined;
  ctl.lookEventTypes = undefined;
}

// missing height samples take the nearest valid neighbour along the ring
function fillGaps(raw: (number | undefined)[]): number[] {
  const n = raw.length;
  return raw.map((h, i) => {
    if (h !== undefined) return h;
    for (let d = 1; d < n; d++) {
      const a = raw[(i + d) % n];
      if (a !== undefined) return a;
      const b = raw[(i - d + n) % n];
      if (b !== undefined) return b;
    }
    return 0;
  });
}

// side wall texture: darker with depth, uneven strata, a pale lip at the top
function strataTexture(hex: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 16;
  c.height = 256;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, hex);
  grad.addColorStop(1, "#0b0c0f");
  g.fillStyle = grad;
  g.fillRect(0, 0, 16, 256);
  let y = 10;
  for (let i = 0; y < 256; i++) {
    const h = 2 + ((i * 37) % 9);
    g.fillStyle = `rgba(0,0,0,${0.1 + (i % 3) * 0.06})`;
    g.fillRect(0, y, 16, h);
    y += h + 7 + ((i * 53) % 15);
  }
  g.fillStyle = "rgba(255,255,255,0.22)";
  g.fillRect(0, 0, 16, 3);
  return c;
}

function exaggerate(scene: CesiumNS.Scene, ex: number) {
  scene.verticalExaggeration = ex;
  scene.requestRender();
}

// relief lifts the block by kilometres, so re-aim the locked camera and keep its angle and distance
function aim({ C, v, ellipsoid }: GlobeHandle, tile: Tile, height: number) {
  const cam = v.camera;
  const range = C.Cartesian3.magnitude(cam.position);
  cam.lookAt(
    C.Cartesian3.fromDegrees(
      tile.center.lon,
      tile.center.lat,
      height,
      ellipsoid,
    ),
    new C.HeadingPitchRange(cam.heading, cam.pitch, range),
  );
}

// wall top and bottom heights at this relief, 3d tiles samples come back already exaggerated
function wallHeights(heights: number[], ex: number) {
  const tops = heights.map((h) => h * ex);
  const lo = Math.min(...tops);
  const hi = Math.max(...tops);
  return { tops, lo, hi, base: lo - Math.max(350, (hi - lo) * 0.35) };
}

// fly in, then crop the planet to the block and lock the camera to it, returns the undo
function liftBlock(
  handle: GlobeHandle,
  tile: Tile,
  onLifted: (l: Lifted | null) => void,
): () => void {
  const { C, v, ellipsoid, tileset, motion, inBlock } = handle;
  const scene = v.scene;
  let dead = false;
  inBlock.current = true;
  motion.current = null;

  // densify the edges in cartesian space so polar blocks do not wrap around the pole
  const corners = tile.corners.map(([lon, lat]) =>
    C.Cartesian3.fromDegrees(lon, lat, 0, ellipsoid),
  );
  const ring: CesiumNS.Cartesian3[] = [];
  for (let k = 0; k < corners.length; k++) {
    const a = corners[k];
    const b = corners[(k + 1) % corners.length];
    for (let i = 0; i < EDGE_SAMPLES; i++) {
      const p = C.Cartesian3.lerp(a, b, i / EDGE_SAMPLES, new C.Cartesian3());
      ring.push(ellipsoid.scaleToGeodeticSurface(p, p));
    }
  }
  const saved = {
    sky: scene.skyAtmosphere?.show,
    ground: scene.globe?.showGroundAtmosphere,
    depth: scene.globe?.depthTestAgainstTerrain,
    fog: scene.fog.enabled,
  };

  (async () => {
    // sample wall heights before cropping, just inside the edge so they land on terrain
    const centroid = C.BoundingSphere.fromPoints(ring).center;
    const cartos = ring.map((p) =>
      ellipsoid.cartesianToCartographic(
        C.Cartesian3.lerp(p, centroid, 0.005, new C.Cartesian3()),
      ),
    );
    let raw: (number | undefined)[] = cartos.map(() => undefined);
    try {
      await handle.terrainReady;
      const s = scene.globe
        ? await C.sampleTerrainMostDetailed(v.terrainProvider, cartos)
        : await scene.sampleHeightMostDetailed(cartos);
      raw = s.map((c) => c?.height);
    } catch {
      // flat-topped walls if sampling fails
    }
    if (dead || v.isDestroyed()) return;
    const heights = fillGaps(raw);
    const lo = Math.min(...heights);
    const hi = Math.max(...heights);
    const mid = C.BoundingSphere.fromPoints(
      ring.map((p) => {
        const c = ellipsoid.cartesianToCartographic(p);
        return C.Cartesian3.fromRadians(
          c.longitude,
          c.latitude,
          (lo + hi) / 2,
          ellipsoid,
        );
      }),
    );
    const view = new C.HeadingPitchRange(
      C.Math.toRadians(25),
      C.Math.toRadians(-28),
      9_000 + (hi - lo) * 1.5,
    );

    v.camera.flyToBoundingSphere(mid, {
      offset: view,
      duration: 2.2,
      complete: () => {
        if (dead || v.isDestroyed()) return;
        // studio look: no sky or haze, and the walls must draw behind the terrain
        if (scene.globe) scene.globe.depthTestAgainstTerrain = true;
        if (scene.skyAtmosphere) scene.skyAtmosphere.show = false;
        if (scene.globe) scene.globe.showGroundAtmosphere = false;
        scene.fog.enabled = false;

        if (scene.globe) {
          // polygon clipping on the globe crashes cesium 1.147, the limit rectangle does not
          const lons = tile.corners.map(([lon]) => C.Math.toRadians(lon));
          const lats = tile.corners.map(([, lat]) => C.Math.toRadians(lat));
          scene.globe.cartographicLimitRectangle = new C.Rectangle(
            Math.min(...lons),
            Math.min(...lats),
            Math.max(...lons),
            Math.max(...lats),
          );
        } else if (tileset) {
          // four planes through each edge and the radial direction, exact at the poles where polygons smear
          const up = C.Cartesian3.normalize(centroid, new C.Cartesian3());
          tileset.clippingPlanes ??= new C.ClippingPlaneCollection({
            unionClippingRegions: true,
          });
          tileset.clippingPlanes.removeAll();
          corners.forEach((a, k) => {
            const b = corners[(k + 1) % corners.length];
            const n = C.Cartesian3.cross(
              up,
              C.Cartesian3.subtract(b, a, new C.Cartesian3()),
              new C.Cartesian3(),
            );
            C.Cartesian3.normalize(n, n);
            if (
              C.Cartesian3.dot(
                n,
                C.Cartesian3.subtract(centroid, a, new C.Cartesian3()),
              ) < 0
            )
              C.Cartesian3.negate(n, n);
            tileset.clippingPlanes.add(
              new C.ClippingPlane(n, -C.Cartesian3.dot(n, a)),
            );
          });
          // the planes are in world coordinates, undo the tileset's clipping origin (private in the typings)
          tileset.clippingPlanes.modelMatrix = C.Matrix4.inverse(
            (
              tileset as unknown as {
                clippingPlanesOriginMatrix: CesiumNS.Matrix4;
              }
            ).clippingPlanesOriginMatrix,
            new C.Matrix4(),
          );
          tileset.clippingPlanes.enabled = true;
        }
        v.camera.lookAt(mid.center, view);
        blockControls(C, scene.screenSpaceCameraController);
        motion.current = "orbit";
        scene.requestRender();
        onLifted({ ring, heights });
      },
    });
  })();

  return () => {
    dead = true;
    inBlock.current = false;
    onLifted(null);
    if (v.isDestroyed()) return;
    v.camera.cancelFlight();
    if (scene.globe)
      scene.globe.cartographicLimitRectangle = C.Rectangle.MAX_VALUE;
    else if (tileset?.clippingPlanes) {
      tileset.clippingPlanes.enabled = false;
      tileset.clippingPlanes.removeAll();
    }
    if (scene.skyAtmosphere) scene.skyAtmosphere.show = saved.sky ?? true;
    if (scene.globe) scene.globe.showGroundAtmosphere = saved.ground ?? true;
    if (scene.globe) scene.globe.depthTestAgainstTerrain = saved.depth ?? false;
    scene.fog.enabled = saved.fog;
    v.camera.lookAtTransform(C.Matrix4.IDENTITY);
    globeControls(C, scene.screenSpaceCameraController);
    motion.current = null;
    scene.requestRender();
  };
}

// the block as the target would light it: grey ground, a sun just above the horizon, real cast shadows
function moonLight(handle: GlobeHandle, elevationDeg: number): () => void {
  const { C, v, sun, relight } = handle;
  const scene = v.scene;
  const before = { sun: sun.current, shadows: v.shadows, terrain: v.terrainShadows, soft: scene.shadowMap.softShadows, far: scene.shadowMap.maximumDistance };
  const layers = Array.from({ length: v.imageryLayers.length }, (_, i) => v.imageryLayers.get(i));
  const saturation = layers.map((l) => l.saturation);
  layers.forEach((l) => (l.saturation = 0));
  sun.current = elevationDeg;
  v.shadows = true;
  v.terrainShadows = C.ShadowMode.ENABLED;
  scene.shadowMap.softShadows = true;
  scene.shadowMap.maximumDistance = 20_000;
  relight();
  scene.requestRender();
  return () => {
    if (v.isDestroyed()) return;
    layers.forEach((l, i) => (l.saturation = saturation[i]));
    sun.current = before.sun;
    v.shadows = before.shadows;
    v.terrainShadows = before.terrain;
    scene.shadowMap.softShadows = before.soft;
    scene.shadowMap.maximumDistance = before.far;
    relight();
    scene.requestRender();
  };
}

// lifts the 4 km block out of the planet: crop, strata walls, an orbiting camera, a scale bar and a north arrow
export function BlockPullOut({
  handle,
  tile,
  relief,
  points,
  matchName,
  moonSun,
}: {
  handle: GlobeHandle | null;
  tile: Tile | null;
  relief: number;
  // the scored cells, shown once the block is out
  points: CellPoint[];
  // name of the matched block, for the point cards
  matchName: string;
  // sun elevation in degrees for moon light, null for the normal look
  moonSun: number | null;
}) {
  const [lifted, setLifted] = useState<Lifted | null>(null);
  const bar = useRef<SVGPathElement>(null);
  const barText = useRef<SVGTextElement>(null);
  const north = useRef<SVGPathElement>(null);
  const northText = useRef<SVGTextElement>(null);

  useEffect(() => {
    if (!handle || !tile) return;
    return liftBlock(handle, tile, setLifted);
  }, [handle, tile]);

  useEffect(() => {
    if (handle && lifted && moonSun !== null) return moonLight(handle, moonSun);
  }, [handle, lifted, moonSun]);

  // walls, base and cut edge, rebuilt when the relief changes
  useEffect(() => {
    if (!handle || !lifted || !tile) return;
    const { C, v, ellipsoid, world } = handle;
    const scene = v.scene;
    // exaggeration breaks moon and mars tiles, so relief is earth only
    const ex = scene.globe ? relief : 1;
    exaggerate(scene, ex);
    const { tops, base, lo, hi } = wallHeights(lifted.heights, ex);
    aim(handle, tile, (lo + hi) / 2);
    const closed = [...lifted.ring, lifted.ring[0]];
    const closedTops = [...tops, tops[0]];
    const made = [
      v.entities.add({
        wall: {
          positions: closed,
          maximumHeights: closedTops,
          minimumHeights: closed.map(() => base),
          material: new C.ImageMaterialProperty({
            image: strataTexture(WALL[world]),
            repeat: new C.Cartesian2(24, 1),
          }),
        },
      }),
      v.entities.add({
        polygon: {
          hierarchy: lifted.ring,
          height: base,
          material: C.Color.fromCssColorString("#0b0c0f"),
        },
      }),
      v.entities.add({
        polyline: {
          positions: closed.map((p, i) => {
            const c = ellipsoid.cartesianToCartographic(p);
            return C.Cartesian3.fromRadians(
              c.longitude,
              c.latitude,
              closedTops[i] + 2,
              ellipsoid,
            );
          }),
          width: 2,
          material: C.Color.fromCssColorString(FOOTPRINT_COLOR),
        },
      }),
    ];

    // scale bar along the south edge and a north arrow off the north edge, placed on screen every frame
    const [sw, se, ne, nw] = tile.corners;
    const at = (lon: number, lat: number, h: number) =>
      C.Cartesian3.fromDegrees(lon, lat, h, ellipsoid);
    const top = Math.max(...tops);
    const dLat = C.Math.toDegrees(700 / ellipsoid.maximumRadius);
    const world3 = [
      at(sw[0], sw[1], base),
      at(se[0], se[1], base),
      at((nw[0] + ne[0]) / 2, nw[1], top),
      at((nw[0] + ne[0]) / 2, nw[1] + dLat, top),
    ];
    const marks = [
      bar.current,
      barText.current,
      north.current,
      northText.current,
    ];
    const [barEl, barTextEl, northEl, northTextEl] = marks;
    const place = () => {
      const [a, b, n0, n1] = world3.map((p) =>
        C.SceneTransforms.worldToWindowCoordinates(scene, p),
      );
      const ok = a && b && n0 && n1;
      for (const el of marks)
        el?.setAttribute("visibility", ok ? "visible" : "hidden");
      if (!ok) return;
      barEl?.setAttribute(
        "d",
        `M${a.x} ${a.y + 14}L${b.x} ${b.y + 14}M${a.x} ${a.y + 8}v12M${b.x} ${b.y + 8}v12`,
      );
      barTextEl?.setAttribute("x", String((a.x + b.x) / 2));
      barTextEl?.setAttribute("y", String((a.y + b.y) / 2 + 32));
      const [dx, dy] = [n1.x - n0.x, n1.y - n0.y];
      const len = Math.hypot(dx, dy) || 1;
      const [ux, uy] = [dx / len, dy / len];
      northEl?.setAttribute(
        "d",
        `M${n0.x} ${n0.y}L${n1.x} ${n1.y}M${n1.x - ux * 9 - uy * 5} ${n1.y - uy * 9 + ux * 5}L${n1.x} ${n1.y}L${n1.x - ux * 9 + uy * 5} ${n1.y - uy * 9 - ux * 5}`,
      );
      northTextEl?.setAttribute("x", String(n1.x + ux * 12));
      northTextEl?.setAttribute("y", String(n1.y + uy * 12 + 4));
    };
    scene.postRender.addEventListener(place);
    scene.requestRender();

    return () => {
      for (const el of marks) el?.setAttribute("visibility", "hidden");
      if (v.isDestroyed()) return;
      scene.postRender.removeEventListener(place);
      made.forEach((e) => v.entities.remove(e));
      exaggerate(scene, 1);
    };
  }, [handle, lifted, tile, relief]);

  return (
    <>
      {handle && tile && lifted && (
        <FeaturePoints
          handle={handle}
          tile={tile}
          points={points}
          matchName={matchName}
          relief={relief}
        />
      )}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 size-full fill-none stroke-white/85 stroke-[1.5] text-xs"
      >
        <path ref={bar} visibility="hidden" />
        <path ref={north} visibility="hidden" />
        <text
          ref={barText}
          visibility="hidden"
          textAnchor="middle"
          className="fill-white stroke-none"
        >
          4.0 km
        </text>
        <text
          ref={northText}
          visibility="hidden"
          textAnchor="middle"
          className="fill-white stroke-none"
        >
          N
        </text>
      </svg>
    </>
  );
}
