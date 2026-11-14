"use client";

import { useEffect, useRef } from "react";
import type { Tile } from "@/lib/tiles";
import type { CesiumNS } from "./cesium";
import { FOOTPRINT_COLOR } from "./config";
import type { GlobeHandle } from "./use-cesium-viewer";

const setShown = (shapes: CesiumNS.Entity[], on: boolean) => shapes.forEach((e) => (e.show = on));

// outline of a 4 km block draped on the surface, it follows the pointer so the shapes are made once and only moved
export function HoverFootprint({ handle, tile }: { handle: GlobeHandle | null; tile: Tile | null }) {
  const ring = useRef<CesiumNS.Cartesian3[]>([]);
  const made = useRef<CesiumNS.Entity[]>([]);

  useEffect(() => {
    if (!handle) return;
    const { C, v } = handle;
    const color = C.Color.fromCssColorString(FOOTPRINT_COLOR);
    const shapes = [
      v.entities.add({
        show: false,
        polygon: {
          hierarchy: new C.CallbackProperty(() => new C.PolygonHierarchy(ring.current), false),
          material: color.withAlpha(0.16),
          classificationType: C.ClassificationType.BOTH,
        },
      }),
      v.entities.add({
        show: false,
        polyline: {
          positions: new C.CallbackProperty(() => [...ring.current, ring.current[0]], false),
          width: 2,
          material: color,
          clampToGround: true,
          classificationType: C.ClassificationType.BOTH,
        },
      }),
    ];
    made.current = shapes;
    return () => {
      made.current = [];
      if (v.isDestroyed()) return;
      shapes.forEach((e) => v.entities.remove(e));
      v.scene.requestRender();
    };
  }, [handle]);

  useEffect(() => {
    if (!handle) return;
    const { C, v, ellipsoid } = handle;
    const on = !!tile && tile.world === handle.world;
    if (on) ring.current = tile.corners.map(([lon, lat]) => C.Cartesian3.fromDegrees(lon, lat, 0, ellipsoid));
    setShown(made.current, on);
    v.scene.requestRender();
  }, [handle, tile]);

  return null;
}
