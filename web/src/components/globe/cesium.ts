import type * as CesiumNS from "cesium";

export type { CesiumNS };
export type CesiumLib = typeof CesiumNS;

// release bundle by script tag, import "cesium" pulls the slow unminified source
let load: Promise<CesiumLib> | null = null;

export function loadCesium(): Promise<CesiumLib> {
  const w = window as unknown as { Cesium?: CesiumLib; CESIUM_BASE_URL: string };
  w.CESIUM_BASE_URL = "/cesium/";
  load ??= new Promise<CesiumLib>((resolve, reject) => {
    if (w.Cesium) return resolve(w.Cesium);
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "/cesium/Widgets/widgets.css";
    document.head.appendChild(css);
    const s = document.createElement("script");
    s.src = "/cesium/Cesium.js";
    s.onload = () => (w.Cesium ? resolve(w.Cesium) : reject(new Error("Cesium.js loaded without a global")));
    s.onerror = () => {
      load = null;
      reject(new Error("Could not load /cesium/Cesium.js"));
    };
    document.head.appendChild(s);
  });
  return load;
}
