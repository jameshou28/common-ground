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
    "The dark, smooth plains you can see from Earth. Old impact basins flooded by basalt lava over 3 billion years ago, so the ground is flat to gently rolling with scattered small craters and low ridges.",
  "moon:highlands":
    "The bright, heavily cratered crust that covers most of the Moon. Older than the maria and never flooded by lava, it's rough, hilly ground built from overlapping craters.",
  "moon:basins":
    "The rings of mountains and blankets of thrown-out rock around the Moon's largest impacts, like Orientale. Steep, concentric ridges with rubbly ground between them.",
  "moon:south_pole":
    "The Artemis landing zone. Heavily cratered ground where the Sun sits on the horizon, so crater floors stay in permanent shadow and may hold water ice.",
  "mars:highlands":
    "The old, cratered southern half of Mars. Rough ground with eroded craters and ancient valley networks carved when water flowed.",
  "mars:lowlands":
    "The smooth northern plains, a few kilometres lower than the south. Flat, young-looking ground, possibly the floor of an ancient ocean.",
  "mars:volcanic":
    "Tharsis and Elysium, home to the largest volcanoes in the solar system. Broad lava plains, shield volcanoes and long lava flows.",
  "mars:outflow":
    "Huge channels cut by catastrophic floods, and the collapsed, jumbled 'chaos' ground they burst from. Streamlined islands and wide scoured floors.",
};

// what each feature is, the region it's in is named in the list title
const FEATURE_INFO: Record<string, string> = {
  crater_floor: "The flat or bowl-shaped bottom inside a crater, often filled with melted rock or debris that slumped from the walls.",
  graben: "A long, straight trough where the crust pulled apart and a block dropped down between two parallel faults.",
  sinuous_rille: "A winding channel carved by flowing lava, or a lava tube whose roof collapsed. Looks like a dry river valley.",
  wrinkle_ridge: "A low, winding ridge where the surface was squeezed and buckled as lava plains cooled and sank.",
  crater_rim: "The raised ring of rock around a crater, pushed up and piled with debris thrown out by the impact.",
  volcanic_edifice: "A volcano's body: shield volcanoes, cones and domes built up by repeated eruptions.",
  yardang: "A streamlined ridge carved by wind, lined up with the wind direction, in soft rock between scoured troughs.",
};

const OVERALL_INFO =
  "The places that best match this world overall: terrain score and surface score together, the same analog score a result page shows. Each place is listed under the region it fits best.";

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
        <b className="font-semibold" title={overall ? "Analog score" : feature ? "Feature score" : "Terrain score"}>
          {Math.round(overall ? s.overall! : s.score)}
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
  const groups = [
    { name: "Overall", lists: lists.filter((l) => l.overall) },
    { name: "Regions", lists: lists.filter((l) => !l.overall && !l.feature) },
    { name: "Features", lists: lists.filter((l) => l.feature) },
  ];
  const info = open?.overall ? OVERALL_INFO : open?.tag ? FEATURE_INFO[open.tag] : open ? REGION_INFO[open.region] : undefined;

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
              {groups.map((g) =>
                g.lists.length ? (
                  <div key={g.name}>
                    <h2 className="mb-1 px-2 text-xs font-semibold text-text-2">{g.name}</h2>
                    <ul aria-label={`${WORLD_LABEL[tab]} ${g.name.toLowerCase()}`} className="space-y-0.5">
                      {g.lists.map((l) => (
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
                <h2 className="text-lg leading-tight font-semibold">{open.title}</h2>
                {info && <p className="mt-1.5 max-w-prose text-sm text-text-2">{info}</p>}
                <p className="mt-4 mb-2 text-xs text-text-2">
                  {open.overall
                    ? `Ranked by analog score across every ${WORLD_LABEL[tab]} region.`
                    : open.feature
                    ? `Ranked by feature score: how well the ground matches the ${open.title.toLowerCase()}. Only features the model can reliably tell apart get a list.`
                    : `Ranked by terrain score for ${open.title.toLowerCase()}, among places where it's the best or nearly the best ${WORLD_LABEL[tab]} region.`}
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
