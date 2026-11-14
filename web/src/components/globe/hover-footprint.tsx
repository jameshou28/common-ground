"use client";

import { useEffect } from "react";
import type { Tile } from "@/lib/tiles";
import { FOOTPRINT_COLOR } from "./config";
import type { GlobeHandle } from "./use-cesium-viewer";

// outline of the 4 km block under the pointer, draped on the surface
export function HoverFootprint({ handle, tile }: { handle: GlobeHandle | null; tile: Tile | null }) {
  useEffect(() => {
    if (!handle || !tile || tile.world !== handle.world) return;
    const { C, v, ellipsoid } = handle;
    const ring = tile.corners.map(([lon, lat]) => C.Cartesian3.fromDegrees(lon, lat, 0, ellipsoid));
    const color = C.Color.fromCssColorString(FOOTPRINT_COLOR);
    const made = [
      v.entities.add({
        polygon: { hierarchy: ring, material: color.withAlpha(0.16), classificationType: C.ClassificationType.BOTH },
      }),
      v.entities.add({
        polyline: { positions: [...ring, ring[0]], width: 2, material: color, clampToGround: true, classificationType: C.ClassificationType.BOTH },
      }),
    ];
    v.scene.requestRender();
    return () => {
      if (v.isDestroyed()) return;
      made.forEach((e) => v.entities.remove(e));
      v.scene.requestRender();
    };
  }, [handle, tile]);
  return null;
}
