import type { World } from "@/lib/tiles";

// ion asset ids, both load on the default token
export const ION_ASSET: Partial<Record<World, number>> = { moon: 2684829, mars: 3644333 };

export const START: Record<World, { lat: number; lon: number; height: number }> = {
  earth: { lat: 20, lon: -40, height: 2.1e7 },
  moon: { lat: -48, lon: 20, height: 5.2e6 },
  mars: { lat: 12, lon: 70, height: 1.05e7 },
};

export const WORLD_LABEL: Record<World, string> = { earth: "Earth", moon: "Moon", mars: "Mars" };

// blue marble from gibs fades into ion aerial between these heights
export const BLUE_MARBLE_URL =
  "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg";
export const MARBLE_FULL_ABOVE_M = 2_500_000;
export const MARBLE_GONE_BELOW_M = 600_000;

// below this height a fixed low sun makes relief read as 3d
export const RELIEF_BELOW_M = 300_000;
export const RELIEF_SUN = { azimuthDeg: 315, elevationDeg: 28 }; // nw, the hillshade convention

// fly-in range, moon and mars data is coarser so frame more
export const BLOCK_RANGE_M: Record<World, number> = { earth: 8_500, moon: 22_000, mars: 26_000 };

export type GlobeStatus = { state: "loading" | "ready" | "error"; message?: string };

// camera floor over moon and mars tiles, checked only below the tallest relief
export const MIN_CLEARANCE_M = 300;

// closest scroll-in, under the block fly-in range so you can still lean in a bit
export const MIN_ZOOM_M = 2_000;
export const CLAMP_BELOW_M = 40_000;

// the brand token as hex, cesium cannot read css variables
export const FOOTPRINT_COLOR = "#8f9cf0";

// pins skip the depth test only up close, so terrain cannot hide them but the far side still does
export const PIN_NO_DEPTH_M = 60_000;
