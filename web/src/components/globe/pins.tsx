"use client";

import { useEffect } from "react";
import { FOOTPRINT_COLOR, PIN_NO_DEPTH_M } from "./config";
import type { GlobeHandle } from "./use-cesium-viewer";

export type Pin = { id: string; name: string; lat: number; lon: number; kind: "check" | "target" };

export const PIN_PREFIX = "pin:";

// check sites and targets as labelled points, the active one is larger
export function Pins({ handle, pins, active }: { handle: GlobeHandle | null; pins: Pin[]; active: string | null }) {
  useEffect(() => {
    if (!handle || !pins.length) return;
    const { C, v, ellipsoid } = handle;
    const dark = C.Color.fromCssColorString("#0b0b0c");
    const made = pins.map((p) => {
      const on = p.id === active;
      const color = C.Color.fromCssColorString(p.kind === "target" || on ? FOOTPRINT_COLOR : "#ececea");
      return v.entities.add({
        id: PIN_PREFIX + p.id,
        position: C.Cartesian3.fromDegrees(p.lon, p.lat, 0, ellipsoid),
        point: {
          pixelSize: on ? 13 : 9,
          color,
          outlineColor: dark,
          outlineWidth: 2,
          heightReference: C.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: PIN_NO_DEPTH_M,
        },
        label: {
          text: p.name,
          font: "500 12px system-ui, sans-serif",
          fillColor: color,
          showBackground: true,
          backgroundColor: dark.withAlpha(0.78),
          backgroundPadding: new C.Cartesian2(6, 4),
          horizontalOrigin: C.HorizontalOrigin.LEFT,
          verticalOrigin: C.VerticalOrigin.CENTER,
          pixelOffset: new C.Cartesian2(12, 0),
          heightReference: C.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: PIN_NO_DEPTH_M,
        },
      });
    });
    v.scene.requestRender();
    return () => {
      if (v.isDestroyed()) return;
      made.forEach((e) => v.entities.remove(e));
      v.scene.requestRender();
    };
  }, [handle, pins, active]);
  return null;
}
