"use client";

import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { WORLD_LABEL } from "@/components/globe/config";
import { describeError } from "@/lib/api";
import { fmtLatLon } from "@/lib/format";
import { useTargets } from "@/lib/queries";
import { CHECK_SITES, RANK_LABEL, siteHref } from "@/lib/sites";
import { useExplore } from "./explore-context";

type Row = { id: string; name: string; sub: string; end: string; lat: number; lon: number };

// check sites on earth, featured places on the moon and mars
export function SiteList() {
  const { world, activePin, setActivePin, flyTo } = useExplore();
  const router = useRouter();
  const targets = useTargets();
  const earth = world === "earth";

  const rows: Row[] = earth
    ? []
    : (targets.data ?? [])
        .filter((t) => t.world === world)
        .map((t) => ({ id: t.id, name: t.name, sub: fmtLatLon(t.lat, t.lon), end: t.dem_source, lat: t.lat, lon: t.lon }));

  return (
    <section aria-labelledby="site-list" className="p-4">
      <h2 id="site-list" className="flex items-baseline justify-between font-semibold">
        {earth ? "Check sites" : `Places to look at on ${world === "moon" ? "the Moon" : WORLD_LABEL[world]}`}
      </h2>
      <p className="mt-1 text-xs text-text-2">
        {earth
          ? "Where we expect each one to land. The model should put them in the same order."
          : "Landing sites and other spots worth a close look. Earth blocks are scored against all of the Moon and Mars, not only these."}
      </p>
      {!earth && targets.isPending && <Skeleton className="mt-3 h-10" />}
      {!earth && targets.isError && (
        <p role="alert" className="mt-3 text-xs">
          <b className="block font-semibold">{describeError(targets.error).title}</b>
          <span className="text-text-2">The list of places didn&apos;t load.</span>
        </p>
      )}
      {!earth && targets.isSuccess && !rows.length && <p className="mt-3 text-xs text-text-2">No {WORLD_LABEL[world]} target yet.</p>}
      {earth && (
        // expected rank, best first: label on the left, the sites in that band on the right
        <dl className="mt-4 grid grid-cols-[5.5rem_1fr] gap-x-4">
          {[5, 4, 3, 2, 1].map((rank) => {
            const sites = CHECK_SITES.filter((s) => s.rank === rank);
            if (!sites.length) return null;
            return (
              <div key={rank} className="contents">
                <dt className={`pt-1.5 text-right text-xs ${rank >= 4 ? "text-help" : rank === 3 ? "text-text-2" : "text-hurt"}`}>{RANK_LABEL[rank]}</dt>
                <dd className="border-l border-line pb-3 pl-2">
                  {sites.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      title={s.region}
                      onClick={() => router.push(siteHref(s.tileId))}
                      onPointerEnter={() => setActivePin(s.id)}
                      onPointerLeave={() => setActivePin(null)}
                      onFocus={() => setActivePin(s.id)}
                      onBlur={() => setActivePin(null)}
                      className={`block w-full rounded-md px-2 py-1 text-left hover:bg-hover ${activePin === s.id ? "bg-hover" : ""}`}
                    >
                      {s.name}
                    </button>
                  ))}
                </dd>
              </div>
            );
          })}
        </dl>
      )}
      <ul className="-mx-2 mt-2">
        {rows.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => flyTo(r)}
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
