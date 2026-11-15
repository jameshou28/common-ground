"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { WORLD_LABEL } from "@/components/globe/config";
import { fmtLatLon } from "@/lib/format";
import { parseTab, TABS } from "@/lib/regions";
import { siteHref } from "@/lib/sites";
import data from "../../../public/data/best_sites.json";

// written by ml/discover.ipynb. older files only have name, lat, lon, tile_id and score
type Site = {
  name: string;
  lat: number;
  lon: number;
  tile_id: string;
  score: number;
  terrain?: number;
  surface?: number;
  // points ahead of the next best region of the same world
  lead?: number;
  known?: boolean;
  known_site?: string | null;
  found_by?: string;
};
type List = { key: string; title: string; region: string; sites: Site[]; feature?: boolean };
type RegionList = { region: string; title: string; sites: Site[] };
type LandformList = { region: string; region_title: string; tag: string; label: string; sites: Site[] };

const file = data as unknown as { worlds?: Record<string, RegionList[]>; landforms?: LandformList[]; note?: string };
const WORLDS = file.worlds ?? {};
const LANDFORMS = file.landforms ?? [];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// the region lists, then the validated feature lists, for one world
function listsFor(tab: string): List[] {
  const regions = (WORLDS[tab] ?? []).map((r) => ({ key: r.region, title: r.title, region: r.region, sites: r.sites }));
  const features = LANDFORMS.filter((l) => l.region.startsWith(`${tab}:`)).map((l) => ({
    key: `${l.region}|${l.tag}`,
    title: `${cap(l.label)}s, ${l.region_title.toLowerCase()}`,
    region: l.region,
    sites: l.sites,
    feature: true,
  }));
  return [...regions, ...features];
}

function SiteRow({ s, i, href, feature }: { s: Site; i: number; href: string; feature?: boolean }) {
  const facts = [
    s.surface != null && `surface ${Math.round(s.surface)}`,
    !feature && s.lead != null && s.lead > 0.5 && `${Math.round(s.lead)} ahead of the next region`,
    s.known && s.known_site && `known analog: ${s.known_site}`,
  ].filter(Boolean);
  return (
    <li>
      <Link href={href} className="flex items-baseline gap-3 rounded-md border border-line bg-panel px-3 py-2 hover:bg-hover hover:no-underline">
        <span className="w-5 text-text-2">{i + 1}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate">
            {s.name}
            {s.known && <span className="ml-2 rounded-sm border border-line-2 px-1 text-[11px] text-text-2">known</span>}
          </span>
          <span className="block text-xs text-text-2">
            {fmtLatLon(s.lat, s.lon)}
            {facts.length > 0 && ` · ${facts.join(" · ")}`}
          </span>
        </span>
        <b className="font-semibold" title={feature ? "Feature score" : "Terrain score"}>
          {Math.round(s.score)}
        </b>
      </Link>
    </li>
  );
}

export function BestSites() {
  const search = useSearchParams();
  const tab = parseTab(search.get("tab"));
  const lists = listsFor(tab);
  const open = lists.find((l) => l.key === search.get("list") || l.key === search.get("region")) ?? lists[0];
  const nav = (feature: boolean) => lists.filter((l) => !!l.feature === feature);

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
        <p className="mt-2 max-w-prose text-text-2">
          The places on Earth whose ground comes closest to each kind of {WORLD_LABEL[tab]} terrain, found by scoring all of Earth&apos;s dry land ahead of time. Each list is
          ranked by terrain score, among places bare and dry enough to work as a test site, with at most four per country. Open one to see why it scored the way it did.
        </p>

        {!lists.length ? (
          <p role="note" className="mt-6 max-w-prose rounded-md border border-line bg-raised px-3 py-2 text-xs">
            <b className="block font-semibold">Not computed yet</b>
            <span className="text-text-2">
              The ranking runs once the final model is ready. Until then you can click anywhere on the globe, or start from the check sites on the Explore page.
            </span>
          </p>
        ) : (
          <div className="mt-6 grid gap-6 md:grid-cols-[240px_minmax(0,1fr)]">
            <div className="space-y-4">
              {[false, true].map((feature) =>
                nav(feature).length ? (
                  <div key={String(feature)}>
                    <h2 className="mb-1 px-2 text-xs font-semibold text-text-2">{feature ? "Features" : "Regions"}</h2>
                    <ul aria-label={`${WORLD_LABEL[tab]} ${feature ? "features" : "regions"}`} className="space-y-0.5">
                      {nav(feature).map((l) => (
                        <li key={l.key}>
                          <Link
                            href={`/best?tab=${tab}&list=${encodeURIComponent(l.key)}`}
                            aria-current={l === open ? "true" : undefined}
                            className={`block rounded-md border-l-2 px-2 py-1.5 hover:bg-hover hover:no-underline ${l === open ? "border-brand bg-raised" : "border-transparent"}`}
                          >
                            {l.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null,
              )}
            </div>
            {open && (
              <div>
                <p className="mb-2 text-xs text-text-2">
                  {open.feature
                    ? `Ranked by feature score: how well the ground matches the ${open.title.toLowerCase()}. Only features the model can reliably tell apart get a list.`
                    : `Ranked by terrain score for ${open.title.toLowerCase()}, among places where it's the best or nearly the best ${WORLD_LABEL[tab]} region.`}
                </p>
                <ol aria-label={`Best Earth sites for ${open.title}`} className="space-y-1">
                  {open.sites.map((s, i) => (
                    <SiteRow key={s.tile_id} s={s} i={i} feature={open.feature} href={siteHref(s.tile_id, { tab, region: open.region })} />
                  ))}
                  {!open.sites.length && <li className="text-xs text-text-2">No sites for this list yet.</li>}
                </ol>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
