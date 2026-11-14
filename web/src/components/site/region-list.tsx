"use client";

import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { useExplore } from "@/components/explore/explore-context";
import { WORLD_LABEL } from "@/components/globe/config";
import { TABS } from "@/lib/regions";
import { siteHref } from "@/lib/sites";
import { useMatch } from "./use-match";

// moon and mars tabs, the regions of the open tab, and the sites inside the chosen region
export function RegionList() {
  const { selected } = useExplore();
  const { q, match } = useMatch(selected);
  const r = q.data;
  const tileId = selected?.id ?? "";

  return (
    <aside aria-labelledby="regions-h" className="min-h-0 overflow-y-auto border-r border-line bg-panel p-3 max-lg:col-span-full max-lg:border-r-0 max-lg:border-b">
      <h2 id="regions-h" className="sr-only">
        Moon and Mars regions
      </h2>
      <nav aria-label="World" className="grid grid-cols-2 gap-1">
        {TABS.map((t) => {
          const on = match?.tab === t;
          return (
            <Link
              key={t}
              href={siteHref(tileId, { tab: t })}
              replace
              scroll={false}
              aria-current={on ? "true" : undefined}
              className={`flex items-baseline justify-between rounded-md border px-2 py-1.5 hover:bg-hover hover:no-underline ${on ? "border-brand bg-raised" : "border-line"}`}
            >
              <span>{WORLD_LABEL[t]}</span>
              {r && <b className="font-semibold">{Math.round(r.worlds[t].overall)}</b>}
            </Link>
          );
        })}
      </nav>

      {q.isPending && selected?.world === "earth" && <Skeleton className="mt-3 h-32" />}
      {match && (
        <>
          <p className="mt-3 text-xs text-text-2">How well this block matches each kind of {WORLD_LABEL[match.tab]} terrain. Pick one to see its closest places.</p>
          <ul className="-mx-1 mt-2 space-y-0.5">
            {match.world.regions.map((g) => {
              const on = g.region === match.region.region;
              const best = g.region === match.world.best_region;
              return (
                <li key={g.region}>
                  <Link
                    href={siteHref(tileId, { tab: match.tab, region: g.region })}
                    replace
                    scroll={false}
                    aria-current={on ? "true" : undefined}
                    className={`flex items-center gap-2 rounded-md border-l-2 px-2 py-1.5 hover:bg-hover hover:no-underline ${on ? "border-brand bg-raised" : "border-transparent"}`}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {g.title}
                      {best && (
                        <span title="Best match for this block" className="ml-1 text-warn">
                          ★<span className="sr-only"> best match</span>
                        </span>
                      )}
                    </span>
                    <b className="shrink-0 font-semibold">{Math.round(g.score)}</b>
                  </Link>
                  {on && (
                    <ul aria-label={`Closest places in ${g.title}`} className="mt-0.5 mb-1 ml-3 border-l border-line pl-2">
                      {[...(g.region === match.world.best_match.region ? [match.world.best_match] : []), ...g.best]
                        .filter((s, i, all) => all.findIndex((x) => x.index === s.index) === i)
                        .map((s) => {
                          const pick = s.index === match.site.index;
                          return (
                            <li key={s.index}>
                              <Link
                                href={siteHref(tileId, { tab: match.tab, region: g.region, site: s.index })}
                                replace
                                scroll={false}
                                aria-current={pick ? "true" : undefined}
                                className={`flex items-baseline gap-2 rounded-md px-2 py-1 text-xs hover:bg-hover hover:no-underline ${pick ? "bg-raised text-text" : "text-text-2"}`}
                              >
                                <span className="min-w-0 flex-1 truncate first-letter:uppercase">{s.name}</span>
                                <span className="shrink-0">{Math.round(s.pair_score)}</span>
                              </Link>
                            </li>
                          );
                        })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </aside>
  );
}
