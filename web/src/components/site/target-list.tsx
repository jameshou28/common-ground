"use client";

import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { useExplore } from "@/components/explore/explore-context";
import { WORLD_LABEL } from "@/components/globe/config";
import { describeError } from "@/lib/api";
import { useScores, useTargets } from "@/lib/queries";
import { siteHref } from "@/lib/sites";

// this block against every target, the star marks the best match
export function TargetList() {
  const { selected, targetId } = useExplore();
  const targets = useTargets();
  const list = targets.data ?? [];
  const tileId = selected?.world === "earth" ? selected.id : null;
  const scores = useScores(
    tileId,
    list.map((t) => t.id),
  );
  // only crown a winner once every target has answered
  const settled = scores.length > 1 && scores.every((q) => q.data);
  const best = settled ? Math.max(...scores.map((q) => q.data!.score)) : null;

  return (
    <aside aria-labelledby="targets-h" className="min-h-0 overflow-y-auto border-r border-line bg-panel p-3 max-lg:col-span-full max-lg:border-r-0 max-lg:border-b">
      <h2 id="targets-h" className="font-semibold">
        Targets
      </h2>
      <p className="mt-1 text-xs text-text-2">How well this block matches each one. Pick one to see why.</p>
      {targets.isPending && <Skeleton className="mt-3 h-10" />}
      {targets.isError && (
        <p role="alert" className="mt-3 text-xs">
          <b className="block font-semibold">{describeError(targets.error).title}</b>
          <span className="text-text-2">The target list did not load.</span>
        </p>
      )}
      <ul className="-mx-1 mt-2 max-lg:flex max-lg:gap-1 max-lg:overflow-x-auto">
        {list.map((t, i) => {
          const q = scores[i];
          const on = t.id === targetId;
          const star = best !== null && q.data?.score === best;
          return (
            <li key={t.id} className="max-lg:min-w-52">
              <Link
                href={selected ? siteHref(selected.id, t.id) : "/"}
                replace
                scroll={false}
                aria-current={on ? "true" : undefined}
                className={`flex items-center gap-2 rounded-md border-l-2 px-2 py-1.5 hover:bg-hover hover:no-underline ${on ? "border-brand bg-raised" : "border-transparent"}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate">
                    {t.name}
                    {star && (
                      <span title="Best match for this block" className="ml-1 text-warn">
                        ★<span className="sr-only"> best match</span>
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-text-2">{WORLD_LABEL[t.world]}</span>
                </span>
                {q?.data ? (
                  <b className="shrink-0 font-semibold">{Math.round(q.data.score)}</b>
                ) : q?.isError ? (
                  <span title={describeError(q.error).title} className="shrink-0 text-text-2">
                    –
                  </span>
                ) : tileId ? (
                  <Skeleton className="h-4 w-6 shrink-0" />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
