"use client";

import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { WORLD_LABEL } from "@/components/globe/config";
import { describeError } from "@/lib/api";
import { fmtLatLon } from "@/lib/format";
import { useTargets } from "@/lib/queries";
import { CHECK_SITES, RANK_LABEL, siteHref } from "@/lib/sites";
import { useExplore } from "./explore-context";

type Row = { id: string; name: string; sub: string; end: string; lat: number; lon: number; tileId?: string };

// check sites on earth, the fixed targets on the moon and mars
export function SiteList() {
  const { world, activePin, setActivePin, flyTo } = useExplore();
  const router = useRouter();
  const targets = useTargets();
  const earth = world === "earth";

  const rows: Row[] = earth
    ? CHECK_SITES.map((s) => ({ id: s.id, name: s.name, sub: s.region, end: RANK_LABEL[s.rank], lat: s.lat, lon: s.lon, tileId: s.tileId }))
    : (targets.data ?? [])
        .filter((t) => t.world === world)
        .map((t) => ({ id: t.id, name: t.name, sub: fmtLatLon(t.lat, t.lon), end: t.dem_source, lat: t.lat, lon: t.lon }));

  return (
    <section aria-labelledby="site-list" className="p-4">
      <h2 id="site-list" className="flex items-baseline justify-between font-semibold">
        {earth ? "Check sites" : `${WORLD_LABEL[world]} targets`}
        {earth && <span className="text-xs font-normal text-text-2">expected, worst to best</span>}
      </h2>
      <p className="mt-1 text-xs text-text-2">
        {earth
          ? "Places whose answer we wrote down before scoring. The model has to get their order right."
          : "The places Earth blocks are scored against."}
      </p>
      {!earth && targets.isPending && <Skeleton className="mt-3 h-10" />}
      {!earth && targets.isError && (
        <p role="alert" className="mt-3 text-xs">
          <b className="block font-semibold">{describeError(targets.error).title}</b>
          <span className="text-text-2">The target list did not load.</span>
        </p>
      )}
      {!earth && targets.isSuccess && !rows.length && <p className="mt-3 text-xs text-text-2">No {WORLD_LABEL[world]} target yet.</p>}
      <ul className="-mx-2 mt-2">
        {rows.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => (r.tileId ? router.push(siteHref(r.tileId)) : flyTo(r))}
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
