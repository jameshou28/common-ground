"use client";

import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { useExplore } from "@/components/explore/explore-context";
import { WORLD_LABEL } from "@/components/globe/config";
import { fmtLatLon } from "@/lib/format";
import { TABS } from "@/lib/regions";
import { siteHref } from "@/lib/sites";
import { ExampleImage } from "./example-image";
import { useMatch } from "./use-match";

const link = "hover:no-underline";

// a thin 0 to 100 score bar
function Bar({ value, on }: { value: number; on: boolean }) {
  return (
    <span aria-hidden className="mt-2 block h-1 overflow-hidden rounded-full bg-raised">
      <span className={`block h-full rounded-full ${on ? "bg-brand" : "bg-text-2/50"}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </span>
  );
}

// moon and mars tabs, the regions of the open tab, and the sites inside the chosen region
export function RegionList() {
  const { selected } = useExplore();
  const { q, match } = useMatch(selected);
  const r = q.data;
  const tileId = selected?.id ?? "";

  return (
    <aside aria-labelledby="regions-h" className="flex min-h-0 flex-col overflow-y-auto border-r border-line bg-panel p-3 max-lg:col-span-full max-lg:border-r-0 max-lg:border-b max-md:order-last max-md:border-t">
      <h2 id="regions-h" className="sr-only">
        Moon and Mars regions
      </h2>
      <nav aria-label="World" className="grid grid-cols-2 gap-1 rounded-lg bg-app p-1">
        {TABS.map((t) => {
          const on = match?.tab === t;
          return (
            <Link
              key={t}
              href={siteHref(tileId, { tab: t })}
              replace
              scroll={false}
              aria-current={on ? "true" : undefined}
              className={`${link} flex items-baseline justify-between rounded-md border px-2.5 py-1.5 ${on ? "border-brand bg-raised text-text" : "border-transparent text-text-2 hover:bg-hover"}`}
            >
              <span className={on ? "font-semibold" : undefined}>{WORLD_LABEL[t]}</span>
              {r && <b className={`font-semibold ${on ? "text-brand" : ""}`}>{Math.round(r.worlds[t].overall)}</b>}
            </Link>
          );
        })}
      </nav>

      {q.isPending && selected?.world === "earth" && <Skeleton className="mt-3 h-32" />}
      {match && (
        <>
          <h3 className="mt-5 text-xs font-semibold tracking-wider text-text-2 uppercase">Terrain match by region</h3>
          <p className="mt-1 text-xs text-text-2">Pick a region to see its closest real places.</p>
          <ul className="mt-3 space-y-1">
            {match.world.regions.map((g) => {
              const on = g.region === match.region.region;
              const best = g.region === match.world.best_region;
              const sites = [...(g.region === match.world.best_match.region ? [match.world.best_match] : []), ...g.best].filter(
                (s, i, all) => all.findIndex((x) => x.index === s.index) === i,
              );
              return (
                <li key={g.region} className={on ? "rounded-lg border border-line bg-app/40 pb-2" : undefined}>
                  <Link
                    href={siteHref(tileId, { tab: match.tab, region: g.region })}
                    replace
                    scroll={false}
                    aria-current={on ? "true" : undefined}
                    className={`${link} block rounded-lg px-3 py-2.5 ${on ? "" : "hover:bg-hover"}`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`min-w-0 break-words ${on ? "font-semibold" : ""}`}>
                        <ExampleImage k={g.region}>{g.title}</ExampleImage>
                      </span>
                      {best && <span className="rounded bg-warn/15 px-1.5 py-0.5 text-[11px] font-semibold text-warn">Best</span>}
                      <b className="ml-auto shrink-0 font-semibold">{Math.round(g.score)}</b>
                    </span>
                    <Bar value={g.score} on={on} />
                  </Link>
                  {on && (
                    <>
                      <p className="px-3 pt-1 pb-1.5 text-xs text-text-2">Closest places</p>
                      <ol aria-label={`Closest places in ${g.title}`} className="space-y-0.5 px-1">
                        {sites.map((s, i) => {
                          const pick = s.index === match.site.index;
                          return (
                            <li key={s.index}>
                              <Link
                                href={siteHref(tileId, { tab: match.tab, region: g.region, site: s.index })}
                                replace
                                scroll={false}
                                aria-current={pick ? "true" : undefined}
                                className={`${link} flex items-center gap-2.5 rounded-md px-2 py-1.5 ${pick ? "bg-raised" : "hover:bg-hover"}`}
                              >
                                <span
                                  aria-hidden
                                  className={`grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${pick ? "bg-brand text-on-brand" : "bg-raised text-text-2"}`}
                                >
                                  {i + 1}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className={`block break-words text-sm first-letter:uppercase ${pick ? "font-semibold text-text" : "text-text"}`}>{s.name}</span>
                                  {/* ponytail: coordinates, swap for "x km from <named feature>" once the api sends a gazetteer name */}
                                  <span className="block truncate text-xs text-text-2">{fmtLatLon(s.lat, s.lon)}</span>
                                </span>
                                <span className={`shrink-0 text-sm ${pick ? "font-semibold text-text" : "text-text-2"}`}>{Math.round(s.pair_score)}</span>
                              </Link>
                            </li>
                          );
                        })}
                      </ol>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-auto pt-6 text-xs text-text-2">Bars show terrain match, 0 to 100. The world score above also counts surface.</p>
        </>
      )}
    </aside>
  );
}
