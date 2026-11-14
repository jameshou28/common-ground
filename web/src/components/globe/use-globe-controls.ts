"use client";

import { useEffect } from "react";
import { useLatest } from "@/lib/use-latest";
import type { CesiumLib, CesiumNS } from "./cesium";
import { CLAMP_BELOW_M, MIN_CLEARANCE_M, START } from "./config";
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

const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

// cesium's tilt orbits the point under the pointer, rotate spins the planet under it
function globeControls(C: CesiumLib, ctl: CesiumNS.ScreenSpaceCameraController) {
  const T = C.CameraEventType;
  ctl.zoomEventTypes = [T.WHEEL, T.PINCH];
  ctl.tiltEventTypes = [T.RIGHT_DRAG, T.PINCH];
  ctl.rotateEventTypes = [T.LEFT_DRAG, T.MIDDLE_DRAG];
  ctl.lookEventTypes = undefined;
}

// scroll zooms, right-drag orbits, drag pans, esc and h go back to the full globe
export function useGlobeControls(handle: GlobeHandle | null, onHover: (p: LatLon | null) => void) {
  const cb = useLatest(onHover);

  useEffect(() => {
    if (!handle) return;
    const { C, v, ellipsoid } = handle;
    const scene = v.scene;
    globeControls(C, scene.screenSpaceCameraController);

    const mouse = new C.ScreenSpaceEventHandler(scene.canvas);
    mouse.setInputAction((m: { endPosition: CesiumNS.Cartesian2 }) => {
      const p = v.camera.pickEllipsoid(m.endPosition, ellipsoid);
      const c = p && ellipsoid.cartesianToCartographic(p);
      cb.current(c ? { lat: C.Math.toDegrees(c.latitude), lon: C.Math.toDegrees(c.longitude) } : null);
    }, C.ScreenSpaceEventType.MOUSE_MOVE);
    const leave = () => cb.current(null);
    scene.canvas.addEventListener("pointerleave", leave);

    const key = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
      if (e.key === "Escape" || e.key.toLowerCase() === "h") flyHome(handle);
    };
    window.addEventListener("keydown", key);

    // moon and mars have no globe, so nothing stops the camera going through the surface
    const scratch = new C.Cartographic();
    const clamp = () => {
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
  }, [handle, cb]);
}
