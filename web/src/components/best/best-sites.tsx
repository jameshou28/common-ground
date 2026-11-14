"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { WORLD_LABEL } from "@/components/globe/config";
import { fmtLatLon } from "@/lib/format";
import { parseTab, TABS } from "@/lib/regions";
import { siteHref } from "@/lib/sites";
import data from "../../../public/data/best_sites.json";

type Site = { name: string; lat: number; lon: number; tile_id: string; score: number };
type Region = { region: string; title: string; sites: Site[] };

// the best earth sites the model found for every moon and mars region, precomputed
const WORLDS = data.worlds as Record<string, Region[]>;

export function BestSites() {
  const search = useSearchParams();
  const tab = parseTab(search.get("tab"));
  const regions = WORLDS[tab] ?? [];
  const open = regions.find((r) => r.region === search.get("region")) ?? regions[0];

  return (
    <main className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="text-xl leading-tight font-semibold">Best sites</h1>
          <nav aria-label="World" className="flex gap-1">
            {TABS.map((t) => (
              <Link
                key={t}
                href={`/best?tab=${t}`}
                aria-current={t === tab ? "true" : undefined}
                className={`rounded-md border px-3 py-1 hover:bg-hover hover:no-underline ${t === tab ? "border-brand bg-raised" : "border-line"}`}
              >
                {WORLD_LABEL[t]}
              </Link>
            ))}
          </nav>
        </div>
        <p className="mt-2 max-w-prose text-text-2">The places on Earth that come closest to each kind of {WORLD_LABEL[tab]} terrain, ranked by the model ahead of time. Open one to see why it scored the way it did.</p>

        {!regions.length ? (
          <p role="note" className="mt-6 max-w-prose rounded-md border border-line bg-raised px-3 py-2 text-xs">
            <b className="block font-semibold">Not computed yet</b>
            <span className="text-text-2">
              The ranking runs once the final model is ready. Until then you can click anywhere on the globe, or start from the check sites on the Explore page.
            </span>
          </p>
        ) : (
          <div className="mt-6 grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
            <ul aria-label={`${WORLD_LABEL[tab]} regions`} className="space-y-0.5">
              {regions.map((r) => (
                <li key={r.region}>
                  <Link
                    href={`/best?tab=${tab}&region=${encodeURIComponent(r.region)}`}
                    aria-current={r === open ? "true" : undefined}
                    className={`block rounded-md border-l-2 px-2 py-1.5 hover:bg-hover hover:no-underline ${r === open ? "border-brand bg-raised" : "border-transparent"}`}
                  >
                    {r.title}
                  </Link>
                </li>
              ))}
            </ul>
            {open && (
              <ol aria-label={`Best Earth sites for ${open.title}`} className="space-y-1">
                {open.sites.map((s, i) => (
                  <li key={s.tile_id}>
                    <Link href={siteHref(s.tile_id, { tab, region: open.region })} className="flex items-baseline gap-3 rounded-md border border-line bg-panel px-3 py-2 hover:bg-hover hover:no-underline">
                      <span className="w-5 text-text-2">{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{s.name}</span>
                        <span className="block text-xs text-text-2">{fmtLatLon(s.lat, s.lon)}</span>
                      </span>
                      <b className="font-semibold">{Math.round(s.score)}</b>
                    </Link>
                  </li>
                ))}
                {!open.sites.length && <li className="text-xs text-text-2">No sites for this region yet.</li>}
              </ol>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
