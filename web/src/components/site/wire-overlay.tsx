"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { Grid } from "@/lib/grid";
import { matchScale } from "@/lib/grid-mesh";
import { useGrid } from "@/lib/queries";

const GridBlock = dynamic(() => import("@/components/grid/grid-block"), { ssr: false });

// the block's own height grid with the matched block's surface drawn over it as lines
export function WireOverlay({
  gridUrl,
  over,
  overName,
  relief,
  matched,
  moonSun,
}: {
  gridUrl: string | undefined;
  over: Grid;
  overName: string;
  relief: number;
  matched: boolean;
  moonSun: number | null;
}) {
  const block = useGrid(gridUrl);
  return (
    <div className="absolute inset-0 z-20 bg-space">
      {block.data && (
        <GridBlock
          grid={block.data}
          relief={relief}
          tone="earth"
          moonSun={moonSun}
          // matched relief stretches the match onto the block's height range
          wire={{ grid: over, scale: relief * (matched ? matchScale(block.data, over) : 1) }}
          label={`This block with ${overName} drawn over it as a wireframe`}
        />
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
          Solid: this block, {Math.round(block.data.hi - block.data.lo)} m from low to high · Lines: {overName}, {Math.round(over.hi - over.lo)} m
          {matched ? ", stretched to match" : ""}
        </p>
      )}
    </div>
  );
}
