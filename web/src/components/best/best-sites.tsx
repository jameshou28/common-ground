"use client";

import Link from "next/link";
import { HoverCard } from "radix-ui";
import { ExampleImage, RegionTitle } from "@/components/site/example-image";
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
  // terrain and surface together, the score shown on a result page
  overall?: number;
  // set on the best analog list, which mixes regions
  region?: string;
  region_title?: string;
};
type List = { key: string; title: string; region: string; sites: Site[]; feature?: boolean; overall?: boolean; tag?: string };
type RegionList = { region: string; title: string; sites: Site[] };
type LandformList = { region: string; region_title: string; tag: string; label: string; sites: Site[] };

const file = data as unknown as { worlds?: Record<string, RegionList[]>; landforms?: LandformList[]; note?: string };
const WORLDS = file.worlds ?? {};
const LANDFORMS = file.landforms ?? [];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// what each region is, shown above its ranking
const REGION_INFO: Record<string, string> = {
  "moon:maria":
    "The dark, flat plains visible on the Moon from Earth. Formed over 3 billion years ago when basalt lava flooded ancient impact basins, leaving behind smooth terrain dotted with small craters and low ridges.",
  "moon:highlands":
    "The bright, older crust that covers most of the Moon. Lava never reached it, so it's rough and hilly, craters on top of craters.",
  "moon:basins":
    "Concentric mountain rings and debris blankets surrounding the Moon's largest impact sites, like Mare Orientale. The terrain features steep, circular ridges separated by rough, rubbly ground.",
  "moon:south_pole":
    "Where Artemis plans to land. The Sun never gets far above the horizon here, so some crater floors are always in shadow and may hold water ice.",
  "mars:highlands":
    "Most of Mars's southern half: old, worn-down craters and valley networks cut back when water still ran on the surface.",
  "mars:lowlands":
    "Smooth plains in the north, a few kilometres lower than the southern highlands. Some scientists think an ocean once filled them.",
  "mars:volcanic":
    "Massive volcanic regions like Tharsis and Elysium, home to Olympus Mons and other giant shield volcanoes. Surrounded by expansive lava plains and long, solidified flows.",
  "mars:outflow":
    "Giant flood-carved channels and collapsed \"chaos\" terrain left behind where underground water erupted. Marked by wide, scoured floors and teardrop-shaped islands.",
};

// what each feature is, the region it's in is named in the list title
const FEATURE_INFO: Record<string, string> = {
  crater_floor: "The bottom of a crater. Often flat, because impact melt or rock that slid off the walls filled it in.",
  graben: "A long, straight trough. The crust stretched, and a strip of it dropped down between two faults.",
  sinuous_rille: "A winding channel cut by flowing lava, or a lava tube whose roof fell in. From above it looks a lot like a dried-up river.",
  wrinkle_ridge: "A low, wavy ridge that formed when the lava plains cooled, sank and buckled.",
  crater_rim: "The raised edge of a crater, rock pushed up by the impact and piled with what it threw out.",
  volcanic_edifice: "The volcano itself, whether a broad shield, a cone or a dome, built up one eruption at a time.",
  yardang: "A ridge carved out of soft rock by wind. They come in rows, all pointing the way the wind blows.",
};

const OVERALL_INFO =
  "The places on Earth closest to this world overall, using the same analog score a result page shows (terrain and surface together). Each one is tagged with the region it fits best.";

// every region's sites in one list, best analog score first, each place once
function overallFor(regions: RegionList[]): Site[] {
  const seen = new Set<string>();
  return regions
    .flatMap((r) => r.sites.map((s) => ({ ...s, region: r.region, region_title: r.title })))
    .filter((s) => s.overall != null)
    .sort((a, b) => b.overall! - a.overall!)
    .filter((s) => !seen.has(s.tile_id) && !!seen.add(s.tile_id))
    .slice(0, 25);
}

// the region lists, then the validated feature lists, for one world
function listsFor(tab: string): List[] {
  const regions = (WORLDS[tab] ?? []).map((r) => ({ key: r.region, title: r.title, region: r.region, sites: r.sites }));
  const features = LANDFORMS.filter((l) => l.region.startsWith(`${tab}:`)).map((l) => ({
    key: `${l.region}|${l.tag}`,
    title: `${cap(l.label)}s, ${l.region_title.toLowerCase()}`,
    region: l.region,
    sites: l.sites,
    feature: true,
    tag: l.tag,
  }));
  const best = overallFor(WORLDS[tab] ?? []);
  const overall = best.length ? [{ key: "overall", title: "Best analog score", region: "", sites: best, overall: true }] : [];
  return [...overall, ...regions, ...features];
}

function SiteRow({ s, i, href, feature, overall }: { s: Site; i: number; href: string; feature?: boolean; overall?: boolean }) {
  const facts = [
    overall && s.region_title,
    s.surface != null && `surface ${Math.round(s.surface)}`,
    !feature && !overall && s.lead != null && s.lead > 0.5 && `${Math.round(s.lead)} ahead of the next region`,
  ].filter(Boolean);
  return (
    <li>
      <Link href={href} className="flex items-baseline gap-3 rounded-md border border-line bg-panel px-3 py-2 hover:bg-hover hover:no-underline">
        <span className="w-5 text-text-2">{i + 1}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate">
            {s.name}
            {s.known && <KnownStar site={s.known_site} />}
          </span>
          <span className="block text-xs text-text-2">
            {fmtLatLon(s.lat, s.lon)}
            {facts.length > 0 && ` · ${facts.join(" · ")}`}
          </span>
        </span>
        <b className="font-semibold" title={overall ? "Analog score" : feature ? "Feature score" : "Overall score"}>
          {Math.round(overall ? s.overall! : s.score)}
        </b>
      </Link>
    </li>
  );
}

// a yellow star on picks next to a verified analog site, with a small info box on hover
function KnownStar({ site }: { site?: string | null }) {
  return (
    <HoverCard.Root openDelay={200} closeDelay={80}>
      <HoverCard.Trigger asChild>
        <span tabIndex={0} aria-label="Known analog location" className="ml-2 inline-block cursor-help align-[-1px] text-[13px] leading-none text-yellow-400" onClick={(e) => e.preventDefault()}>
          ★
        </span>
      </HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          side="top"
          align="start"
          sideOffset={6}
          className="z-[60] flex max-w-64 items-start gap-2 rounded-md border border-line bg-panel px-3 py-2 text-xs shadow-xl duration-150 data-[side=top]:slide-in-from-bottom-1 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
        >
          <span aria-hidden className="mt-px grid size-4 shrink-0 place-items-center rounded-full border border-text-2 text-[10px] font-semibold text-text-2 italic">
            i
          </span>
          <span>
            <b className="font-semibold">Known location.</b> A verified analog site is within 25 km
            {site ? (
              <>
                : <span className="text-text-2">{site}</span>
              </>
            ) : null}
            .
          </span>
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}

export function BestSites() {
  const search = useSearchParams();
  const tab = parseTab(search.get("tab"));
  const lists = listsFor(tab);
  const open = lists.find((l) => l.key === search.get("list") || l.key === search.get("region")) ?? lists[0];
  const groups = [
    { name: "Overall", lists: lists.filter((l) => l.overall) },
    { name: "Regions", lists: lists.filter((l) => !l.overall && !l.feature) },
    { name: "Features", lists: lists.filter((l) => l.feature) },
  ];
  const info = open?.overall ? OVERALL_INFO : open?.tag ? FEATURE_INFO[open.tag] : open ? REGION_INFO[open.region] : undefined;

  return (
    <main className="flex-1 overflow-y-auto p-6 max-md:p-4">
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
          Top Earth analogs by {tab === "moon" ? "lunar" : "Martian"} region. Ranked by combined terrain and surface scores across all dry land on Earth. Each place is
          listed once under its closest {tab === "moon" ? "lunar" : "Martian"} match (up to four per country). Click a site to see its score and why it ranked.
        </p>

        {!lists.length ? (
          <p role="note" className="mt-6 max-w-prose rounded-md border border-line bg-raised px-3 py-2 text-xs">
            <b className="block font-semibold">Not computed yet</b>
            <span className="text-text-2">
              The ranking runs once the final model is ready. Until then you can click anywhere on the globe, or start from the check sites on the Explore page.
            </span>
          </p>
        ) : (
          <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[240px_minmax(0,1fr)]">
            <div className="space-y-4">
              {groups.map((g) =>
                g.lists.length ? (
                  <div key={g.name}>
                    <h2 className="mb-1 px-2 text-xs font-semibold text-text-2">{g.name}</h2>
                    <ul aria-label={`${WORLD_LABEL[tab]} ${g.name.toLowerCase()}`} className="space-y-0.5 max-md:-mx-4 max-md:flex max-md:gap-1.5 max-md:space-y-0 max-md:overflow-x-auto max-md:px-4">
                      {g.lists.map((l) => (
                        <li key={l.key}>
                          <Link
                            href={`/best?tab=${tab}&list=${encodeURIComponent(l.key)}`}
                            aria-current={l === open ? "true" : undefined}
                            className={`block rounded-md border-l-2 px-2 py-1.5 hover:bg-hover hover:no-underline max-md:border max-md:whitespace-nowrap ${l === open ? "border-brand bg-raised" : "border-transparent max-md:border-line"}`}
                          >
                            {l.feature && l.tag ? <ExampleImage k={l.tag}>{l.title}</ExampleImage> : l.overall ? l.title : <RegionTitle region={l.region} title={l.title} />}
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
                <h2 className="text-lg leading-tight font-semibold">
                  {open.feature && open.tag ? <ExampleImage k={open.tag}>{open.title}</ExampleImage> : open.overall ? open.title : <RegionTitle region={open.region} title={open.title} />}
                </h2>
                {info && <p className="mt-1.5 max-w-prose text-sm text-text-2">{info}</p>}
                <p className="mt-4 mb-2 text-xs text-text-2">
                  {open.overall
                    ? `Ranked by analog score across every ${WORLD_LABEL[tab]} region.`
                    : open.feature
                    ? `Ranked by feature score: how well the ground matches the ${open.title.toLowerCase()}. Only features the model can reliably tell apart get a list.`
                    : `Ranked by overall score, among places whose closest ${WORLD_LABEL[tab]} region is ${open.title.toLowerCase()}.`}
                </p>
                <ol aria-label={`Best Earth sites for ${open.title}`} className="space-y-1">
                  {open.sites.map((s, i) => (
                    <SiteRow
                      key={s.tile_id}
                      s={s}
                      i={i}
                      feature={open.feature}
                      overall={open.overall}
                      href={siteHref(s.tile_id, { tab, region: s.region ?? open.region })}
                    />
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
