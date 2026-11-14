"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { WORLDS, type World } from "@/lib/tiles";
import { WORLD_LABEL, type GlobeStatus } from "@/components/globe/config";
import { ExploreContext } from "./explore-context";

// cesium needs the browser
const GlobeView = dynamic(() => import("@/components/globe/globe-view"), { ssr: false });

const parseWorld = (v: string | null): World => (WORLDS.includes(v as World) ? (v as World) : "earth");

// holds the one viewer for every explore route
export function ExploreShell({ children }: { children: React.ReactNode }) {
  const world = parseWorld(useSearchParams().get("world"));
  const [status, setStatus] = useState<GlobeStatus>({ state: "loading" });
  const [altitude, setAltitude] = useState(0);
  const value = useMemo(() => ({ world, status, altitude }), [world, status, altitude]);

  return (
    <ExploreContext.Provider value={value}>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_420px] max-md:grid-cols-1 max-md:grid-rows-[minmax(260px,42vh)_minmax(0,1fr)]">
        <section aria-label={`${WORLD_LABEL[world]} globe`} className="sky relative min-h-[260px] overflow-hidden">
          <GlobeView world={world} onStatus={setStatus} onAltitude={setAltitude} />
          {status.state === "loading" && (
            <p role="status" className="absolute bottom-3 left-3 rounded-md border border-line bg-panel px-2.5 py-1.5 text-xs text-text-2">
              Loading {WORLD_LABEL[world]}…
            </p>
          )}
          {status.state === "error" && (
            <p role="alert" className="absolute bottom-3 left-3 max-w-sm rounded-md border border-line bg-panel px-2.5 py-1.5 text-xs">
              <b className="block font-semibold">The {WORLD_LABEL[world]} globe did not load</b>
              <span className="text-text-2">{status.message ?? "Check your connection and reload."}</span>
            </p>
          )}
        </section>
        {children}
      </div>
    </ExploreContext.Provider>
  );
}
