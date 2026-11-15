"use client";

import { Html } from "@react-three/drei";
import dynamic from "next/dynamic";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { BLOCK_M, type Grid as G } from "@/lib/grid";
import { matchScale } from "@/lib/grid-mesh";
import type { CellPoint } from "@/lib/regions";
import { PointCard } from "./point-card";
import { useGrid } from "@/lib/queries";

const GridBlock = dynamic(() => import("@/components/grid/grid-block"), { ssr: false });

// the block's own height grid with the matched block's surface drawn over it as lines
export function WireOverlay({
  gridUrl,
  over,
  overName,
  relief,
  moonSun,
  points,
}: {
  gridUrl: string | undefined;
  over: G;
  overName: string;
  relief: number;
  moonSun: number | null;
  points: CellPoint[];
}) {
  const block = useGrid(gridUrl);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="absolute inset-0 z-20 bg-space">
      {block.data && (
        <GridBlock
          grid={block.data}
          relief={relief}
          tone="earth"
          moonSun={moonSun}
          // the match is always stretched onto the block's height range
          wire={{ grid: over, scale: relief * matchScale(block.data, over) }}
          label={`This block with ${overName} drawn over it as a wireframe`}
        >
          {/* the same numbered points as the globe view, pinned to this block's surface */}
          {points.map((p, i) => {
            const on = open === p.id;
            const help = p.effect === "help";
            return (
              <Html key={p.id} position={pointAt(block.data!, p, relief)} zIndexRange={on ? [40, 40] : [30, 0]}>
                <div className="group relative">
                  <button
                    type="button"
                    aria-expanded={on}
                    aria-label={`Point ${i + 1}: ${help ? "a close match, helps" : "a poor match, hurts"}`}
                    onClick={() => setOpen(on ? null : p.id)}
                    className={`absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-app text-xs font-semibold text-app ${help ? "bg-help" : "bg-hurt"} ${on ? "ring-2 ring-text" : ""}`}
                  >
                    {i + 1}
                  </button>
                  {on && <PointCard point={p} id={`wire-point-${p.id}`} matchName={overName} />}
                </div>
              </Html>
            );
          })}
        </GridBlock>
      )}
      {block.isPending && <Skeleton className="absolute inset-10" />}
      {block.isError && (
        <p role="alert" className="absolute top-14 left-3 max-w-sm rounded-md border border-line bg-panel px-2.5 py-1.5 text-xs">
          <b className="block font-semibold">The overlay didn&apos;t load</b>
          <span className="text-text-2">This block&apos;s height grid is missing from the grid store.</span>
        </p>
      )}
      {block.data && (
        <p className="pointer-events-none absolute bottom-3 left-3 rounded-md border border-line bg-panel px-2.5 py-1.5 text-xs text-text-2">
          Solid: this block, {Math.round(block.data.hi - block.data.lo)} m from low to high · Lines: {overName}, {Math.round(over.hi - over.lo)} m, blue low to yellow high
          , stretched to match
        </p>
      )}
    </div>
  );
}

// a point's spot in block units: x east, z south, y the ground height above the block's lowest point
function pointAt(g: G, p: CellPoint, relief: number): [number, number, number] {
  const idx = (v: number) => Math.min(g.n - 1, Math.max(0, Math.round((v / BLOCK_M + 0.5) * (g.n - 1))));
  const z = g.z[idx(-p.y_m) * g.n + idx(p.x_m)];
  return [p.x_m / 1000, ((z - g.lo) * relief) / 1000 + 0.02, -p.y_m / 1000];
}
