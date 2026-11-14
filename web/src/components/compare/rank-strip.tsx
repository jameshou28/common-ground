"use client";

import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { useTileScores } from "@/lib/queries";
import { CHECK_SITES, RANK_LABEL, siteHref } from "@/lib/sites";

const IDS = CHECK_SITES.map((s) => s.tileId);

// the nine check sites in the order the model gives them, next to the order written down beforehand
export function RankStrip({ targetId }: { targetId: string | null }) {
  const scores = useTileScores(IDS, targetId);
  const rows = CHECK_SITES.map((site, i) => ({ site, q: scores[i] }));
  const waiting = rows.some((r) => r.q.isPending);
  // unscored sites go last, the rest worst to best
  const sorted = [...rows].sort((a, b) => (a.q.data?.score ?? Infinity) - (b.q.data?.score ?? Infinity));

  return (
    <section aria-labelledby="rank-h">
      <h2 id="rank-h" className="font-semibold">
        All check sites, worst to best
      </h2>
      <p className="mt-1 text-xs text-text-2">The order the model gives the nine check sites for this target, with the answer we wrote down before scoring.</p>
      {waiting ? (
        <Skeleton className="mt-3 h-16" />
      ) : (
        <ol className="mt-3 grid grid-cols-9 gap-1 max-lg:grid-cols-3">
          {sorted.map(({ site, q }) => (
            <li key={site.id}>
              <Link href={siteHref(site.tileId, targetId)} className="block h-full rounded-md border border-line bg-panel p-2 hover:bg-hover hover:no-underline">
                <b className="block text-lg leading-none font-semibold">{q.data ? Math.round(q.data.score) : "–"}</b>
                <span className="mt-1 block truncate text-xs">{site.name}</span>
                <span className="block truncate text-xs text-text-2">Expected: {RANK_LABEL[site.rank].toLowerCase()}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
