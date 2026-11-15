"use client";

import dynamic from "next/dynamic";
import { type Alignment, describeAlignment } from "@/lib/align";
import type { Grid } from "@/lib/grid";
import { fmtNum } from "@/lib/format";
import type { Match } from "@/lib/regions";
import { terrainStats } from "@/lib/terrain";

// three needs the browser
const GridBlock = dynamic(() => import("@/components/grid/grid-block"), { ssr: false });

// the matched moon or mars block under the earth block, a placeholder until the match and its grid are in
export function MatchedBlock({
  grid,
  match,
  relief,
  moonSun,
  alignment = null,
}: {
  grid?: Grid;
  match?: Match | null;
  relief: number;
  moonSun: number | null;
  alignment?: Alignment | null;
}) {
  if (!grid || !match)
    return (
      <section aria-label="Matched block" aria-busy className="relative grid min-h-[180px] place-items-center border-t border-line bg-space">
        <p className="animate-pulse text-xs text-text-2">Finding the closest match…</p>
      </section>
    );
  const { site, region, tab } = match;
  const moved = alignment ? describeAlignment(alignment, grid.cellM) : null;
  return (
    <section aria-label="Matched block" className="relative min-h-[180px] overflow-hidden border-t border-line bg-space">
      <GridBlock grid={grid} relief={relief} tone={tab} moonSun={moonSun} label={`${site.name} as a 4 km block of terrain`} />
      <p className="pointer-events-none absolute top-3 left-3 max-w-[calc(100%-1.5rem)] rounded-md border border-line bg-panel px-2.5 py-1.5 text-xs">
        <b className="mr-2 font-semibold">Closest match</b>
        <span className="text-text-2 first-letter:uppercase">
          {site.name} · {region.title} · relief {fmtNum(terrainStats(grid).reliefM)} m
        </span>
        {moved && <span className="block text-text-2">View {moved}. The score is for the block as the model cut it.</span>}
      </p>
    </section>
  );
}
