"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { Target } from "@/lib/api";
import { matchScale } from "@/lib/grid-mesh";
import { useGrid } from "@/lib/queries";
import { targetGridUrl } from "./target-block";

const GridBlock = dynamic(() => import("@/components/grid/grid-block"), { ssr: false });

// the block's own height grid with the target's surface drawn over it as lines
export function WireOverlay({ gridUrl, target, relief, matched }: { gridUrl: string | undefined; target: Target | undefined; relief: number; matched: boolean }) {
  const block = useGrid(gridUrl);
  const over = useGrid(targetGridUrl(target));
  const ready = block.data && over.data && target;
  return (
    <div className="absolute inset-0 z-20 bg-space">
      {ready && (
        <GridBlock
          grid={block.data}
          relief={relief}
          tone="earth"
          // matched relief stretches the target onto the block's height range
          wire={{ grid: over.data, scale: relief * (matched ? matchScale(block.data, over.data) : 1) }}
          label={`This block with ${target.name} drawn over it as a wireframe`}
        />
      )}
      {!ready && !block.isError && !over.isError && <Skeleton className="absolute inset-10" />}
      {(block.isError || over.isError) && (
        <p role="alert" className="absolute top-14 left-3 max-w-sm rounded-md border border-line bg-panel px-2.5 py-1.5 text-xs">
          <b className="block font-semibold">The overlay did not load</b>
          <span className="text-text-2">{block.isError ? "This block's" : "The target's"} height grid is missing from the grid store.</span>
        </p>
      )}
      {ready && (
        <p className="pointer-events-none absolute bottom-3 left-3 rounded-md border border-line bg-panel px-2.5 py-1.5 text-xs text-text-2">
          Solid: this block, {Math.round(block.data.hi - block.data.lo)} m low to high · Lines: {target.name}, {Math.round(over.data.hi - over.data.lo)} m
          {matched ? ", stretched to match" : ""}
        </p>
      )}
    </div>
  );
}
