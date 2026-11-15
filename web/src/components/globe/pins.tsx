"use client";

import { useEffect } from "react";
import { FOOTPRINT_COLOR, PIN_NO_DEPTH_M } from "./config";
import type { GlobeHandle } from "./use-cesium-viewer";

export type Pin = { id: string; name: string; lat: number; lon: number; kind: "check" | "target" | "mars" | "moon" };

export const PIN_PREFIX = "pin:";

const ANALOG_COLOR: Partial<Record<Pin["kind"], string>> = { mars: "#d9824f", moon: "#b9b9c2" };
const ANALOG_LABEL_BELOW_M = 4e6;

// check sites and targets as labelled points, the active one is larger
// earth analogs of mars and moon are small dots in their own colour, named once you zoom in
export function Pins({ handle, pins, active }: { handle: GlobeHandle | null; pins: Pin[]; active: string | null }) {
  useEffect(() => {
    if (!handle || !pins.length) return;
    const { C, v, ellipsoid } = handle;
    const dark = C.Color.fromCssColorString("#0b0b0c");
    const made = pins.map((p) => {
      const on = p.id === active;
      const analog = p.kind === "mars" || p.kind === "moon";
      const color = C.Color.fromCssColorString(on || p.kind === "target" ? FOOTPRINT_COLOR : (ANALOG_COLOR[p.kind] ?? "#ececea"));
      return v.entities.add({
        id: PIN_PREFIX + p.id,
        position: C.Cartesian3.fromDegrees(p.lon, p.lat, 0, ellipsoid),
        point: {
          pixelSize: on ? 13 : analog ? 7 : 9,
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
          // 61 analog names at once would bury the globe
          distanceDisplayCondition: analog && !on ? new C.DistanceDisplayCondition(0, ANALOG_LABEL_BELOW_M) : undefined,
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
