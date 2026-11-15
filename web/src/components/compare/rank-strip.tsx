"use client";

import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { WORLD_LABEL } from "@/components/globe/config";
import { describeError } from "@/lib/api";
import { useTileScores } from "@/lib/queries";
import type { Tab } from "@/lib/regions";
import { CHECK_SITES, RANK_LABEL, siteHref } from "@/lib/sites";

const IDS = CHECK_SITES.map((s) => s.tileId);

// the nine check sites in the order the model puts them, next to the order written down beforehand
export function RankStrip({ tab }: { tab: Tab }) {
  const scores = useTileScores(IDS);
  const rows = CHECK_SITES.map((site, i) => ({ site, q: scores[i], score: scores[i].data?.worlds[tab]?.overall }));
  const waiting = rows.some((r) => r.q.isPending);
  const failed = rows.find((r) => r.q.isError)?.q.error;
  // unscored sites go last, the rest worst to best
  const sorted = [...rows].sort((a, b) => (a.score ?? Infinity) - (b.score ?? Infinity));

  return (
    <section aria-labelledby="rank-h">
      <h2 id="rank-h" className="font-semibold">
        All check sites, worst to best
      </h2>
      <p className="mt-1 text-xs text-text-2">
        How the model ranks the nine check sites as {WORLD_LABEL[tab]} stand-ins, next to the answer we wrote down before scoring.
      </p>
      {waiting ? (
        <Skeleton className="mt-3 h-16" />
      ) : failed && rows.every((r) => r.q.isError) ? (
        <p role="alert" className="mt-3 text-xs text-text-2">
          {describeError(failed).title}. {describeError(failed).body}
        </p>
      ) : (
        <ol className="mt-3 grid grid-cols-9 gap-1 max-lg:grid-cols-3">
          {sorted.map(({ site, score }) => (
            <li key={site.id}>
              <Link href={siteHref(site.tileId, { tab })} className="block h-full rounded-md border border-line bg-panel p-2 hover:bg-hover hover:no-underline">
                <b className="block text-lg leading-none font-semibold">{score == null ? "–" : Math.round(score)}</b>
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
