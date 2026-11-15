"use client";

import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { WORLD_LABEL } from "@/components/globe/config";
import { fmtLatLon } from "@/lib/format";
import { placesOn } from "@/lib/places";
import { useTargets } from "@/lib/queries";
import { siteHref } from "@/lib/sites";
import { pointTile } from "@/lib/tiles";
import { useExplore } from "./explore-context";

const subscribe = () => () => {};

type Row = { id: string; name: string; sub: string; end: string; lat: number; lon: number };

// landmarks on the moon and mars
export function SiteList() {
  const { world, activePin, setActivePin } = useExplore();
  const router = useRouter();
  const targets = useTargets();
  const earth = world === "earth";
  // the api's targets can already be cached in the browser while the server render has none, so they're added only
  // after hydration (or the two renders differ). the static places render the same on both
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);

  const rows: Row[] = earth
    ? []
    : [
        ...placesOn(world).map((p) => ({ id: p.id, name: p.name, sub: fmtLatLon(p.lat, p.lon), end: p.kind === "landing" ? "Landing site" : "Feature", lat: p.lat, lon: p.lon })),
        ...(hydrated ? (targets.data ?? []) : [])
          .filter((t) => t.world === world)
          .map((t) => ({ id: t.id, name: t.name, sub: fmtLatLon(t.lat, t.lon), end: t.dem_source, lat: t.lat, lon: t.lon })),
      ];

  // earth has no list: click any land. the check sites live on How we know
  if (earth) return null;

  return (
    <section aria-labelledby="site-list" className="p-4">
      <h2 id="site-list" className="flex items-baseline justify-between font-semibold">
        Places to look at on {world === "moon" ? "the Moon" : WORLD_LABEL[world]}
      </h2>
      <p className="mt-1 text-xs text-text-2">
        Landing sites and other spots worth a close look, for reference. Only Earth blocks are scored, against all of the Moon and Mars, not only these.
      </p>
      <ul className="-mx-2 mt-2">
        {rows.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => router.push(siteHref(pointTile(world, r.lat, r.lon).id))}
              onPointerEnter={() => setActivePin(r.id)}
              onPointerLeave={() => setActivePin(null)}
              onFocus={() => setActivePin(r.id)}
              onBlur={() => setActivePin(null)}
              className={`flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-hover ${activePin === r.id ? "bg-hover" : ""}`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate">{r.name}</span>
                <span className="block truncate text-xs text-text-2">{r.sub}</span>
              </span>
              <span className="shrink-0 text-xs text-text-2">{r.end}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
