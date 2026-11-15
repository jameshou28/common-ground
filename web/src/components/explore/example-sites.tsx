"use client";

import { useRouter } from "next/navigation";
import { BANDS, bandOf, EXAMPLES, exampleTile } from "@/lib/examples";
import { siteHref } from "@/lib/sites";
import { useExplore } from "./explore-context";
import { SiteList } from "./site-list";

// the front page panel: example sites on earth, the moon and mars landmarks on the other globes
export function ExampleSites() {
  const { world, activePin, setActivePin } = useExplore();
  const router = useRouter();
  if (world !== "earth") return <SiteList />;
  return (
    <section aria-labelledby="examples" className="p-4">
      <h1 id="examples" className="text-xl leading-tight font-semibold">
        Example sites
      </h1>
      <p className="mt-1 text-text-2">Click any land on the globe, or start from one of these.</p>
      <ul className="-mx-2 mt-3">
        {EXAMPLES.map((e) => {
          const b = bandOf(e.band);
          return (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => router.push(siteHref(exampleTile(e), { tab: e.tab }))}
                onPointerEnter={() => setActivePin(e.id)}
                onPointerLeave={() => setActivePin(null)}
                onFocus={() => setActivePin(e.id)}
                onBlur={() => setActivePin(null)}
                title={e.why}
                className={`flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-hover ${activePin === e.id ? "bg-hover" : ""}`}
              >
                <i aria-hidden className={`size-2.5 shrink-0 rounded-full ${b.cls}`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{e.name}</span>
                  <span className="block truncate text-xs text-text-2">{e.region}</span>
                </span>
                <span className="shrink-0 text-xs text-text-2">{e.band}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p aria-label="Legend" className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-line pt-3 text-xs text-text-2">
        {BANDS.map((b) => (
          <span key={b.band} className="flex items-center gap-1.5">
            <i aria-hidden className={`size-2 rounded-full ${b.cls}`} />
            {b.band}
          </span>
        ))}
      </p>
      <p className="mt-1 text-xs text-text-2">How well each place stands in for the Moon or Mars, by the model&apos;s overall score.</p>
    </section>
  );
}
