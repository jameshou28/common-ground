"use client";

import { useEffect, useRef, useState } from "react";
import type { Point } from "@/lib/api";
import type { Tile } from "@/lib/tiles";
import type { GlobeHandle } from "@/components/globe/use-cesium-viewer";
import { PointCard } from "./point-card";

type Heights = { key: string; values: number[] };

// the cells that help or hurt most, pinned to the block's surface and placed on screen every frame
export function FeaturePoints({ handle, tile, points, relief }: { handle: GlobeHandle; tile: Tile; points: Point[]; relief: number }) {
  const [heights, setHeights] = useState<Heights | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const els = useRef<(HTMLDivElement | null)[]>([]);
  const key = `${tile.id}|${points.map((p) => p.id).join()}`;

  // ground height under each point, x is metres east and y metres north of the block centre
  useEffect(() => {
    const { C, v, ellipsoid } = handle;
    let dead = false;
    const r = ellipsoid.maximumRadius;
    const cartos = points.map((p) => {
      const lat = tile.center.lat + C.Math.toDegrees(p.y_m / r);
      return C.Cartographic.fromDegrees(tile.center.lon + C.Math.toDegrees(p.x_m / (r * Math.cos(C.Math.toRadians(lat)))), lat);
    });
    (async () => {
      let values = cartos.map(() => 0);
      try {
        await handle.terrainReady;
        // sampling a globe writes into fresh copies, the originals keep their lon and lat
        const s = v.scene.globe ? await C.sampleTerrainMostDetailed(v.terrainProvider, cartos.map((c) => c.clone())) : await v.scene.sampleHeightMostDetailed(cartos.map((c) => c.clone()));
        values = s.map((c) => c?.height ?? 0);
      } catch {
        // the points sit at height 0 if sampling fails
      }
      if (!dead) setHeights({ key, values });
    })();
    return () => {
      dead = true;
    };
  }, [handle, tile, points, key]);

  const ready = heights?.key === key ? heights.values : null;
  useEffect(() => {
    if (!ready) return;
    const { C, v, ellipsoid } = handle;
    const scene = v.scene;
    const r = ellipsoid.maximumRadius;
    // exaggeration is earth only, the same rule as the block
    const ex = scene.globe ? relief : 1;
    const world = points.map((p, i) => {
      const lat = tile.center.lat + C.Math.toDegrees(p.y_m / r);
      const lon = tile.center.lon + C.Math.toDegrees(p.x_m / (r * Math.cos(C.Math.toRadians(lat))));
      return C.Cartesian3.fromDegrees(lon, lat, ready[i] * ex + 8, ellipsoid);
    });
    const nodes = els.current;
    const place = () => {
      const { clientWidth: w } = scene.canvas;
      world.forEach((p, i) => {
        const el = nodes[i];
        if (!el) return;
        const s = C.SceneTransforms.worldToWindowCoordinates(scene, p);
        el.style.visibility = s ? "visible" : "hidden";
        if (!s) return;
        el.style.transform = `translate(${s.x}px, ${s.y}px)`;
        el.toggleAttribute("data-flip", s.x > w - 270);
        el.toggleAttribute("data-below", s.y < 230);
      });
    };
    scene.postRender.addEventListener(place);
    scene.requestRender();
    return () => {
      for (const el of nodes) if (el) el.style.visibility = "hidden";
      if (!v.isDestroyed()) scene.postRender.removeEventListener(place);
    };
  }, [handle, tile, points, relief, ready]);

  return (
    <>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {points.map((p, i) => {
          const on = open === p.id;
          const help = p.effect === "help";
          return (
            <div
              key={p.id}
              ref={(el) => {
                els.current[i] = el;
              }}
              style={{ visibility: "hidden" }}
              className={`group absolute top-0 left-0 ${on ? "z-10" : ""}`}
            >
              <button
                type="button"
                aria-expanded={on}
                aria-controls={on ? `point-${p.id}` : undefined}
                aria-label={`Point ${i + 1}: ${p.landform}, ${help ? "helps" : "hurts"} the match`}
                onClick={() => setOpen(on ? null : p.id)}
                className={`pointer-events-auto absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-app text-xs font-semibold text-app ${help ? "bg-help" : "bg-hurt"} ${on ? "ring-2 ring-text" : ""}`}
              >
                {i + 1}
              </button>
              {on && <PointCard point={p} id={`point-${p.id}`} />}
            </div>
          );
        })}
      </div>
      {ready && points.length > 0 && (
        <p className="absolute bottom-3 left-3 flex gap-3 rounded-md border border-line bg-panel px-2.5 py-1.5 text-xs text-text-2">
          <span className="flex items-center gap-1.5">
            <i className="size-2.5 rounded-full bg-help" />
            Helps the match
          </span>
          <span className="flex items-center gap-1.5">
            <i className="size-2.5 rounded-full bg-hurt" />
            Hurts it
          </span>
        </p>
      )}
    </>
  );
}
