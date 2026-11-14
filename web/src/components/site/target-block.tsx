"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { Target } from "@/lib/api";
import { fmtNum } from "@/lib/format";
import { useGrid } from "@/lib/queries";
import { terrainStats } from "@/lib/terrain";

// three needs the browser
const GridBlock = dynamic(() => import("@/components/grid/grid-block"), { ssr: false });

export const targetGridUrl = (t: Target | undefined) => (t ? `/grids/${t.tile_id}.bin` : null);

// the target's own 4 km block, under the earth block it is compared with
export function TargetBlock({ target, relief }: { target: Target | undefined; relief: number }) {
  const grid = useGrid(targetGridUrl(target));
  return (
    <section aria-label="Target block" className="relative min-h-[180px] overflow-hidden border-t border-line bg-space">
      {grid.data && target && <GridBlock grid={grid.data} relief={relief} tone={target.world} label={`${target.name} as a 4 km block of terrain`} />}
      {target && grid.isPending && <Skeleton className="absolute inset-6" />}
      {grid.isError && (
        <p role="alert" className="absolute inset-x-3 top-12 max-w-sm rounded-md border border-line bg-panel px-2.5 py-1.5 text-xs">
          <b className="block font-semibold">The target&apos;s terrain did not load</b>
          <span className="text-text-2">Its height grid is missing from the grid store. The scores do not depend on it.</span>
        </p>
      )}
      <p className="pointer-events-none absolute top-3 left-3 rounded-md border border-line bg-panel px-2.5 py-1.5 text-xs">
        <b className="mr-2 font-semibold">Target</b>
        <span className="text-text-2">
          {target?.name ?? "No target"}
          {grid.data && ` · relief ${fmtNum(terrainStats(grid.data).reliefM)} m · ${target?.dem_source}`}
        </span>
      </p>
    </section>
  );
}
