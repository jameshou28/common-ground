"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { useTargets } from "@/lib/queries";
import { CHECK_SITES } from "@/lib/sites";
import { fmtAltitude, fmtLatLon } from "@/lib/format";
import { WORLDS, type Tile, type World } from "@/lib/tiles";
import { WORLD_LABEL, type GlobeStatus } from "@/components/globe/config";
import type { Pin } from "@/components/globe/pins";
import type { LatLon } from "@/components/globe/use-globe-controls";
import { WorldSwitcher } from "@/components/globe/world-switcher";
import { StatusItems } from "@/components/shell/status-bar";
import { ExploreContext } from "./explore-context";

// cesium needs the browser
const GlobeView = dynamic(() => import("@/components/globe/globe-view"), { ssr: false });

const CHECK_PINS: Pin[] = CHECK_SITES.map((s) => ({ id: s.id, name: s.name, lat: s.lat, lon: s.lon, kind: "check" }));

const parseWorld = (v: string | null): World => (WORLDS.includes(v as World) ? (v as World) : "earth");

// holds the one viewer for every explore route
export function ExploreShell({ children }: { children: React.ReactNode }) {
  const world = parseWorld(useSearchParams().get("world"));
  const [status, setStatus] = useState<GlobeStatus>({ state: "loading" });
  const [altitude, setAltitude] = useState(0);
  const [hovered, setHover] = useState<{ at: LatLon; tile: Tile } | null>(null);
  // a hover left over from the previous world is not shown
  const hover = hovered?.tile.world === world ? hovered : null;
  const hoverTile = hover?.tile ?? null;
  const [activePin, setActivePin] = useState<string | null>(null);
  // tagged with its world so a rebuilt viewer does not replay an old flight
  const [focus, setFocus] = useState<(LatLon & { key: number; world: World }) | null>(null);
  const flyTo = useCallback((p: LatLon) => setFocus((f) => ({ lat: p.lat, lon: p.lon, world, key: (f?.key ?? 0) + 1 })), [world]);
  const targets = useTargets().data;
  const pins = useMemo<Pin[]>(
    () => (world === "earth" ? CHECK_PINS : (targets ?? []).filter((t) => t.world === world).map((t) => ({ id: t.id, name: t.name, lat: t.lat, lon: t.lon, kind: "target" }))),
    [world, targets],
  );
  const value = useMemo(
    () => ({ world, status, altitude, hoverTile, pins, activePin, setActivePin, flyTo }),
    [world, status, altitude, hoverTile, pins, activePin, flyTo],
  );
  const onPick = useCallback(
    (_: LatLon | null, pinId: string | null) => {
      const pin = pins.find((p) => p.id === pinId);
      if (pin) flyTo(pin);
    },
    [pins, flyTo],
  );
  const onHover = useCallback((at: LatLon | null, tile: Tile | null) => setHover(at && tile ? { at, tile } : null), []);

  return (
    <ExploreContext.Provider value={value}>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_420px] max-md:grid-cols-1 max-md:grid-rows-[minmax(260px,42vh)_minmax(0,1fr)]">
        <section aria-label={`${WORLD_LABEL[world]} globe`} className="sky relative min-h-[260px] overflow-hidden">
          <GlobeView world={world} onStatus={setStatus} onAltitude={setAltitude} onHover={onHover} onPick={onPick} pins={pins} activePin={activePin} focus={focus?.world === world ? focus : null} />
          <WorldSwitcher world={world} />
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
      <StatusItems>
        <span>{WORLD_LABEL[world]}</span>
        {hover && <span className="tabular-nums">{fmtLatLon(hover.at.lat, hover.at.lon)}</span>}
        {hover && <span className="max-md:hidden">Block {hover.tile.id}</span>}
        <span className="tabular-nums">Altitude {fmtAltitude(altitude)}</span>
      </StatusItems>
    </ExploreContext.Provider>
  );
}
