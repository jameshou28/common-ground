"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { useExplore } from "@/components/explore/explore-context";
import { describeError } from "@/lib/api";
import { fmtLatLon } from "@/lib/format";
import { useScore, useTargets } from "@/lib/queries";
import { CHECK_SITES } from "@/lib/sites";

// the right-hand panel for one scored block
export function SiteResult() {
  const { tileId } = useParams<{ tileId: string }>();
  const { selected, targetId } = useExplore();
  const earth = selected?.world === "earth";
  const q = useScore(earth ? selected.id : null, targetId);
  const target = useTargets().data?.find((t) => t.id === targetId);
  const site = CHECK_SITES.find((s) => s.tileId === selected?.id);

  return (
    <aside aria-label="Result" className="min-h-0 overflow-y-auto border-l border-line bg-panel max-md:border-t max-md:border-l-0">
      <div className="border-b border-line p-4">
        <Link href="/" className="text-xs text-text-2 hover:text-text">
          ← Back to the globe
        </Link>
        <h1 className="mt-2 text-xl leading-tight font-semibold">{site?.name ?? "Clicked block"}</h1>
        {selected && (
          <p className="mt-1 text-xs text-text-2 tabular-nums">
            {fmtLatLon(selected.center.lat, selected.center.lon)} · {selected.id}
          </p>
        )}
      </div>

      <div className="p-4">
        {!selected && (
          <p role="alert">
            <b className="block font-semibold">This is not a block</b>
            <span className="text-text-2">{decodeURIComponent(tileId)} is not a valid block id. Go back and click the globe.</span>
          </p>
        )}
        {selected && !earth && (
          <p role="alert">
            <b className="block font-semibold">Only Earth is scored live</b>
            <span className="text-text-2">Moon and Mars blocks are fixed targets. Click Earth to score a place.</span>
          </p>
        )}
        {earth && q.isPending && (
          <div role="status" aria-live="polite">
            <b className="block font-semibold">Scoring this block{target ? ` against ${target.name}` : ""}</b>
            <span className="text-text-2">Reading 30 m elevation. A new place takes 2 to 5 seconds; a place scored before opens at once.</span>
            <Skeleton className="mt-4 h-9 w-2/3" />
            <Skeleton className="mt-2 h-4" />
            <Skeleton className="mt-2 h-4 w-1/2" />
          </div>
        )}
        {earth && q.isError && (
          <p role="alert">
            <b className="block font-semibold">{describeError(q.error).title}</b>
            <span className="text-text-2">{describeError(q.error).body}</span>
          </p>
        )}
        {q.data && (
          <p>
            <span className="text-3xl font-semibold tabular-nums">{Math.round(q.data.score)}</span>
            <span className="text-text-2"> out of 100{target ? ` against ${target.name}` : ""}</span>
            <span className="mt-1 block text-xs text-text-2">
              {q.data.dem_source}, {q.data.resolution_m} m · model {q.data.model_version}
            </span>
          </p>
        )}
      </div>
    </aside>
  );
}
