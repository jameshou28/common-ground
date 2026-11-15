"use client";

import { useEffect } from "react";
import { useLatest } from "@/lib/use-latest";
import type { CesiumLib, CesiumNS } from "./cesium";
import { BLOCK_RANGE_M, CLAMP_BELOW_M, MIN_CLEARANCE_M, MIN_ZOOM_M, START } from "./config";
import { PIN_PREFIX } from "./pins";
import type { GlobeHandle } from "./use-cesium-viewer";

export type LatLon = { lat: number; lon: number };

// back out to the opening camera for this world
export function flyHome({ C, v, world, ellipsoid, motion }: GlobeHandle) {
  motion.current = null;
  const s = START[world];
  v.camera.flyTo({
    destination: C.Cartesian3.fromDegrees(s.lon, s.lat, s.height, ellipsoid),
    orientation: { heading: 0, pitch: -Math.PI / 2, roll: 0 },
    duration: 2.2,
  });
}

// fly in at an angle, aimed at the real ground height
export async function flyToBlock({ C, v, world, ellipsoid, motion, terrainReady }: GlobeHandle, { lat, lon }: LatLon) {
  motion.current = null;
  const carto = C.Cartographic.fromDegrees(lon, lat);
  let ground = 0;
  try {
    await terrainReady;
    const [s] = v.scene.globe ? await C.sampleTerrainMostDetailed(v.terrainProvider, [carto]) : await v.scene.sampleHeightMostDetailed([carto]);
    ground = s?.height ?? 0;
  } catch {
    // the camera still flies with the height at 0
  }
  if (v.isDestroyed()) return;
  v.camera.flyToBoundingSphere(new C.BoundingSphere(C.Cartesian3.fromDegrees(lon, lat, ground, ellipsoid), 2000), {
    offset: new C.HeadingPitchRange(C.Math.toRadians(25), C.Math.toRadians(-30), BLOCK_RANGE_M[world]),
    duration: 2.8,
  });
}

const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

// cesium's tilt orbits the point under the pointer, rotate spins the planet under it
export function globeControls(C: CesiumLib, ctl: CesiumNS.ScreenSpaceCameraController, maxZoom?: number, camera?: CesiumNS.Camera) {
  const T = C.CameraEventType;
  // no fixed axis: dragging carries on over the poles instead of stopping at the top
  if (camera) camera.constrainedAxis = undefined;
  if (maxZoom) {
    ctl.maximumZoomDistance = maxZoom;
    ctl.minimumZoomDistance = MIN_ZOOM_M;
  }
  ctl.zoomEventTypes = [T.WHEEL, T.PINCH];
  ctl.tiltEventTypes = [T.RIGHT_DRAG, T.PINCH];
  ctl.rotateEventTypes = [T.LEFT_DRAG, T.MIDDLE_DRAG];
  ctl.lookEventTypes = undefined;
}

// scroll zooms, right-drag orbits, drag pans, esc and h go back to the full globe
export function useGlobeControls(
  handle: GlobeHandle | null,
  onHover: (p: LatLon | null) => void,
  // a click on a pin gives its id, a click on the surface gives the place
  onPick: (p: LatLon | null, pinId: string | null) => void,
) {
  const cb = useLatest(onHover);
  const pick = useLatest(onPick);

  useEffect(() => {
    if (!handle) return;
    const { C, v, ellipsoid, inBlock } = handle;
    const scene = v.scene;
    // stop scroll-out at twice the opening view so the world never shrinks to a dot
    globeControls(C, scene.screenSpaceCameraController, START[handle.world].height * 2, v.camera);

    // the terrain under a screen point, the same for hover and click so the outline shows what a click scores
    const surfaceAt = (px: CesiumNS.Cartesian2): LatLon | null => {
      const p = (scene.pickPositionSupported && scene.pickPosition(px)) || v.camera.pickEllipsoid(px, ellipsoid);
      const c = p && ellipsoid.cartesianToCartographic(p);
      return c ? { lat: C.Math.toDegrees(c.latitude), lon: C.Math.toDegrees(c.longitude) } : null;
    };
    const mouse = new C.ScreenSpaceEventHandler(scene.canvas);
    mouse.setInputAction((m: { endPosition: CesiumNS.Cartesian2 }) => {
      cb.current(inBlock.current ? null : surfaceAt(m.endPosition));
    }, C.ScreenSpaceEventType.MOUSE_MOVE);
    mouse.setInputAction((m: { position: CesiumNS.Cartesian2 }) => {
      // the block view is for looking, not picking
      if (inBlock.current) return;
      const id: unknown = scene.pick(m.position)?.id?.id;
      if (typeof id === "string" && id.startsWith(PIN_PREFIX)) return pick.current(null, id.slice(PIN_PREFIX.length));
      const at = surfaceAt(m.position);
      if (at) pick.current(at, null);
    }, C.ScreenSpaceEventType.LEFT_CLICK);
    const leave = () => cb.current(null);
    scene.canvas.addEventListener("pointerleave", leave);

    const key = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
      if (!inBlock.current && (e.key === "Escape" || e.key.toLowerCase() === "h")) flyHome(handle);
    };
    window.addEventListener("keydown", key);

    // moon and mars have no globe, so nothing stops the camera going through the surface
    const scratch = new C.Cartographic();
    const clamp = () => {
      if (inBlock.current) return;
      const cam = scene.camera;
      const c = ellipsoid.cartesianToCartographic(cam.positionWC, scratch);
      if (!c || c.height > CLAMP_BELOW_M) return;
      const ground = scene.sampleHeightSupported ? scene.sampleHeight(c) : undefined;
      const floor = (ground ?? -12_000) + MIN_CLEARANCE_M;
      if (c.height >= floor) return;
      cam.setView({
        destination: C.Cartesian3.fromRadians(c.longitude, c.latitude, floor, ellipsoid),
        orientation: { heading: cam.heading, pitch: cam.pitch, roll: cam.roll },
      });
    };
    if (!scene.globe) scene.preRender.addEventListener(clamp);

    return () => {
      window.removeEventListener("keydown", key);
      if (v.isDestroyed()) return;
      scene.canvas.removeEventListener("pointerleave", leave);
      scene.preRender.removeEventListener(clamp);
      if (!mouse.isDestroyed()) mouse.destroy();
    };
  }, [handle, cb, pick]);
}
