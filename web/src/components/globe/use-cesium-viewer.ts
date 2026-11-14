"use client";

import { useEffect, useState, type RefObject } from "react";
import type { World } from "@/lib/tiles";
import { env } from "@/lib/env";
import { useLatest } from "@/lib/use-latest";
import { loadCesium, type CesiumLib, type CesiumNS } from "./cesium";
import {
  BLUE_MARBLE_URL,
  ION_ASSET,
  MARBLE_FULL_ABOVE_M,
  MARBLE_GONE_BELOW_M,
  RELIEF_BELOW_M,
  RELIEF_SUN,
  START,
  type GlobeStatus,
} from "./config";

export type Motion = "spin" | "orbit" | null;

export type GlobeHandle = {
  C: CesiumLib;
  v: CesiumNS.Viewer;
  world: World;
  ellipsoid: CesiumNS.Ellipsoid;
  tileset: CesiumNS.Cesium3DTileset | null;
  motion: { current: Motion };
};

type Options = {
  world: World;
  el: RefObject<HTMLDivElement | null>;
  credits: RefObject<HTMLDivElement | null>;
  onStatus: (s: GlobeStatus) => void;
  // metres, in 100 m steps
  onAltitude: (m: number) => void;
};

// one viewer per world, ellipsoid.default must be set before it exists
export function useCesiumViewer({ world, el, credits, onStatus, onAltitude }: Options): GlobeHandle | null {
  const [handle, setHandle] = useState<GlobeHandle | null>(null);
  const cb = useLatest({ onStatus, onAltitude });

  useEffect(() => {
    let dead = false;
    let v: CesiumNS.Viewer | null = null;
    const motion: { current: Motion } = { current: "spin" };

    (async () => {
      let C: CesiumLib;
      try {
        C = await loadCesium();
      } catch (e) {
        cb.current.onStatus({ state: "error", message: e instanceof Error ? e.message : String(e) });
        return;
      }
      if (dead || !el.current) return;
      if (env.cesiumToken) C.Ion.defaultAccessToken = env.cesiumToken;

      const ellipsoid = world === "moon" ? C.Ellipsoid.MOON : world === "mars" ? C.Ellipsoid.MARS : C.Ellipsoid.WGS84;
      C.Ellipsoid.default = ellipsoid;
      cb.current.onStatus({ state: "loading" });

      const common = {
        animation: false,
        timeline: false,
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        navigationHelpButton: false,
        fullscreenButton: false,
        infoBox: false,
        selectionIndicator: false,
        creditContainer: credits.current ?? undefined,
        // only redraw on change, spin and orbit move the camera from clock ticks
        requestRenderMode: true,
        maximumRenderTimeChange: Infinity,
        // full screen resolution, capped at 2x below
        useBrowserRecommendedResolution: false,
        // transparent canvas, the page draws the stars
        skyBox: false as const,
        contextOptions: { webgl: { alpha: true } },
      };

      let tileset: CesiumNS.Cesium3DTileset | null = null;
      try {
        if (world === "earth") {
          const terrain = C.Terrain.fromWorldTerrain();
          terrain.errorEvent.addEventListener((e: Error) => cb.current.onStatus({ state: "error", message: e.message }));
          terrain.readyEvent.addEventListener(() => cb.current.onStatus({ state: "ready" }));
          v = new C.Viewer(el.current, { ...common, terrain });
          const g = v.scene.globe;
          g.showGroundAtmosphere = true;
          g.dynamicAtmosphereLighting = false; // keep the atmosphere even when relief light is on
          g.maximumScreenSpaceError = 1.5;
          // gaps while tiles stream show this, not cesium's bright blue
          g.baseColor = C.Color.fromCssColorString("#3a3a36");
          // the default keeps 100 tiles, fast moves evicted the ones just left
          g.tileCacheSize = 1000;
          // failed imagery tiles are not retried, log them
          const logFails = (l: CesiumNS.ImageryLayer) => {
            const hook = (p: CesiumNS.ImageryProvider) => p.errorEvent.addEventListener((e: unknown) => console.warn("[imagery fail]", e));
            if (l.ready) hook(l.imageryProvider);
            else l.readyEvent.addEventListener(hook);
          };
          for (let i = 0; i < v.imageryLayers.length; i++) logFails(v.imageryLayers.get(i));
          v.imageryLayers.layerAdded.addEventListener(logFails);
          terrain.errorEvent.addEventListener((e: unknown) => console.warn("[terrain fail]", e));
        } else {
          v = new C.Viewer(el.current, { ...common, globe: false, skyAtmosphere: false });
          v.scene.fog.enabled = false; // earth's fog model turns moon and mars tiles into haze
          tileset = await C.Cesium3DTileset.fromIonAssetId(ION_ASSET[world]!);
          if (dead) return;
          v.scene.primitives.add(tileset);
          cb.current.onStatus({ state: "ready" });
        }
      } catch (e) {
        cb.current.onStatus({ state: "error", message: e instanceof Error ? e.message : String(e) });
        if (!v) return;
      }
      if (dead || !v) return;
      const viewer = v;
      viewer.resolutionScale = Math.min(1, 2 / window.devicePixelRatio);
      viewer.scene.postProcessStages.fxaa.enabled = true;
      viewer.scene.backgroundColor = C.Color.TRANSPARENT;
      if (viewer.scene.sun) viewer.scene.sun.show = false;
      if (viewer.scene.moon) viewer.scene.moon.show = false;

      // blue marble over the aerial base, the aerial stays on so its tiles are loaded when the fade ends
      const marble = viewer.scene.globe
        ? viewer.imageryLayers.addImageryProvider(
            new C.UrlTemplateImageryProvider({
              url: BLUE_MARBLE_URL,
              maximumLevel: 8,
              credit: new C.Credit("NASA Blue Marble via GIBS"),
            }),
          )
        : null;
      const fadeMarble = (heightM: number) => {
        if (!marble) return;
        const t = (heightM - MARBLE_GONE_BELOW_M) / (MARBLE_FULL_ABOVE_M - MARBLE_GONE_BELOW_M);
        marble.alpha = Math.min(1, Math.max(0, t));
        marble.show = marble.alpha > 0;
      };

      const s = START[world];
      viewer.camera.setView({ destination: C.Cartesian3.fromDegrees(s.lon, s.lat, s.height, ellipsoid) });

      // relief light: a fixed low sun in the camera's local frame
      const sunLight = viewer.scene.light;
      const sunAz = C.Math.toRadians(RELIEF_SUN.azimuthDeg);
      const sunEl = C.Math.toRadians(RELIEF_SUN.elevationDeg);
      // light travels sun to ground, so negate the sun vector
      const lightEnu = new C.Cartesian3(-Math.cos(sunEl) * Math.sin(sunAz), -Math.cos(sunEl) * Math.cos(sunAz), -Math.sin(sunEl));
      const relief = (heightM: number) => {
        const near = heightM < RELIEF_BELOW_M;
        if (viewer.scene.globe) viewer.scene.globe.enableLighting = near;
        if (!near) {
          viewer.scene.light = sunLight;
          return;
        }
        const c = viewer.camera.positionCartographic;
        const enu = C.Transforms.eastNorthUpToFixedFrame(C.Cartesian3.fromRadians(c.longitude, c.latitude, 0, ellipsoid), ellipsoid);
        const dir = C.Matrix4.multiplyByPointAsVector(enu, lightEnu, new C.Cartesian3());
        viewer.scene.light = new C.DirectionalLight({ direction: C.Cartesian3.normalize(dir, dir), intensity: 2.2 });
        viewer.scene.requestRender();
      };

      // spin at start, any input stops it
      viewer.clock.onTick.addEventListener(() => {
        if (motion.current === "spin") viewer.camera.rotate(C.Cartesian3.UNIT_Z, -0.0009);
        else if (motion.current === "orbit") viewer.camera.rotateRight(0.0012);
      });
      const stop = () => (motion.current = null);
      const root = el.current;
      root.addEventListener("pointerdown", stop);
      root.addEventListener("wheel", stop, { passive: true });

      viewer.camera.percentageChanged = 0.01;
      const emitAlt = () => {
        const h = ellipsoid.cartesianToCartographic(viewer.camera.positionWC)?.height ?? 0;
        relief(h);
        fadeMarble(h);
        cb.current.onAltitude(Math.round(h / 100) * 100); // 100 m steps so react skips most renders
      };
      viewer.camera.changed.addEventListener(emitAlt);
      emitAlt();

      if (process.env.NODE_ENV !== "production") (window as unknown as { __viewer: unknown }).__viewer = viewer;
      setHandle({ C, v: viewer, world, ellipsoid, tileset, motion });
    })();

    return () => {
      dead = true;
      setHandle(null);
      if (v && !v.isDestroyed()) v.destroy();
    };
  }, [world, el, credits, cb]);

  // on a world switch the old viewer is destroyed before the new one exists
  return handle?.world === world ? handle : null;
}
