"use client";

import { useEffect, useState } from "react";
import { FOOTPRINT_COLOR, PIN_NO_DEPTH_M } from "./config";
import type { GlobeHandle } from "./use-cesium-viewer";

export type Pin = { id: string; name: string; lat: number; lon: number; kind: "check" | "target" | "mars" | "moon" };

export const PIN_PREFIX = "pin:";

const ANALOG_COLOR: Partial<Record<Pin["kind"], string>> = { mars: "#e08a55", moon: "#c4c4ce" };
const ANALOG_LABEL_BELOW_M = 4e6;
// labels are drawn at twice the size and shown at half, so the text stays sharp on high-density screens
const LABEL_SCALE = 2;

// a crisp marker drawn at the screen's pixel density: soft glow, dark ring, coloured disc, a light core.
// cached per colour and size, cesium reuses the canvas as a billboard image
const markers = new Map<string, HTMLCanvasElement>();
function marker(color: string, cssPx: number): HTMLCanvasElement {
  const key = `${color}|${cssPx}`;
  const hit = markers.get(key);
  if (hit) return hit;
  const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
  const size = Math.ceil((cssPx + 10) * dpr);
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const m = size / 2;
  const r = (cssPx / 2) * dpr;
  // glow
  const glow = g.createRadialGradient(m, m, r * 0.6, m, m, r + 5 * dpr);
  glow.addColorStop(0, `${color}55`);
  glow.addColorStop(1, `${color}00`);
  g.fillStyle = glow;
  g.beginPath();
  g.arc(m, m, r + 5 * dpr, 0, 2 * Math.PI);
  g.fill();
  // dark ring
  g.fillStyle = "#0b0b0c";
  g.beginPath();
  g.arc(m, m, r + 1.5 * dpr, 0, 2 * Math.PI);
  g.fill();
  // disc with a gentle top light
  const body = g.createRadialGradient(m - r * 0.35, m - r * 0.35, r * 0.1, m, m, r);
  body.addColorStop(0, "#ffffff");
  body.addColorStop(0.35, color);
  body.addColorStop(1, color);
  g.fillStyle = body;
  g.beginPath();
  g.arc(m, m, r, 0, 2 * Math.PI);
  g.fill();
  markers.set(key, c);
  return c;
}

// check sites and targets as labelled markers, the active one larger
// earth analogs of mars and moon are small markers in their own colour, named once you zoom in
export function Pins({ handle, pins, active }: { handle: GlobeHandle | null; pins: Pin[]; active: string | null }) {
  // the label font comes from --pin-font (globals.css); a font change anywhere on the page redraws the labels
  const [fontTick, setFontTick] = useState(0);
  useEffect(() => {
    const bump = () => setFontTick((n) => n + 1);
    // cesium draws labels on a canvas: redraw once the web font has loaded, or they keep the fallback
    document.fonts?.ready.then(bump);
    window.addEventListener("cg-font", bump);
    return () => window.removeEventListener("cg-font", bump);
  }, []);
  useEffect(() => {
    if (!handle || !pins.length) return;
    const { C, v, ellipsoid } = handle;
    const dark = C.Color.fromCssColorString("#0b0b0c");
    const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    const family = getComputedStyle(document.documentElement).getPropertyValue("--pin-font").trim() || "system-ui, sans-serif";
    // a phone-sized globe cannot fit every name, so check sites wait for a zoom there too
    const narrow = window.matchMedia("(max-width: 767px)").matches;
    const made = pins.map((p) => {
      const on = p.id === active;
      const analog = p.kind === "mars" || p.kind === "moon";
      const css = on || p.kind === "target" ? FOOTPRINT_COLOR : (ANALOG_COLOR[p.kind] ?? "#ececea");
      const color = C.Color.fromCssColorString(css);
      const px = on ? 14 : analog ? 8 : 10;
      return v.entities.add({
        id: PIN_PREFIX + p.id,
        position: C.Cartesian3.fromDegrees(p.lon, p.lat, 0, ellipsoid),
        billboard: {
          image: marker(css, px),
          scale: 1 / dpr,
          heightReference: C.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: PIN_NO_DEPTH_M,
        },
        label: {
          text: p.name,
          font: `500 ${12 * LABEL_SCALE}px ${family}`,
          scale: 1 / LABEL_SCALE,
          fillColor: color,
          showBackground: true,
          backgroundColor: dark.withAlpha(0.8),
          backgroundPadding: new C.Cartesian2(7 * LABEL_SCALE, 4 * LABEL_SCALE),
          horizontalOrigin: C.HorizontalOrigin.LEFT,
          verticalOrigin: C.VerticalOrigin.CENTER,
          pixelOffset: new C.Cartesian2(px / 2 + 8, 0),
          // 114 analog names at once would bury the globe
          distanceDisplayCondition: (analog || narrow) && !on ? new C.DistanceDisplayCondition(0, ANALOG_LABEL_BELOW_M) : undefined,
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
  }, [handle, pins, active, fontTick]);
  return null;
}
