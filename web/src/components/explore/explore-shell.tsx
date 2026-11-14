"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Point } from "@/lib/api";
import { useScore, useTargets } from "@/lib/queries";
import { CHECK_SITES, siteHref } from "@/lib/sites";
import { fmtAltitude, fmtLatLon } from "@/lib/format";
import {
  pointTile,
  tileFromId,
  WORLDS,
  type Tile,
  type World,
} from "@/lib/tiles";
import { WORLD_LABEL, type GlobeStatus } from "@/components/globe/config";
import type { Pin } from "@/components/globe/pins";
import type { LatLon } from "@/components/globe/use-globe-controls";
import { WorldSwitcher } from "@/components/globe/world-switcher";
import { StatusItems } from "@/components/shell/status-bar";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TargetBlock } from "@/components/site/target-block";
import { WireOverlay } from "@/components/site/wire-overlay";
import { TargetList } from "@/components/site/target-list";
import { ExploreContext } from "./explore-context";

// cesium needs the browser
const GlobeView = dynamic(() => import("@/components/globe/globe-view"), {
  ssr: false,
});

const CHECK_PINS: Pin[] = CHECK_SITES.map((s) => ({
  id: s.id,
  name: s.name,
  lat: s.lat,
  lon: s.lon,
  kind: "check",
}));

const NO_POINTS: Point[] = [];

function parseTile(id: string | undefined): Tile | null {
  try {
    return id ? tileFromId(decodeURIComponent(id)) : null;
  } catch {
    return null;
  }
}

const parseWorld = (v: string | null): World =>
  WORLDS.includes(v as World) ? (v as World) : "earth";

// holds the one viewer for every explore route
export function ExploreShell({ children }: { children: React.ReactNode }) {
  const search = useSearchParams();
  const world = parseWorld(search.get("world"));
  const router = useRouter();
  const { tileId } = useParams<{ tileId?: string }>();
  const selected = useMemo(() => parseTile(tileId), [tileId]);
  const [status, setStatus] = useState<GlobeStatus>({ state: "loading" });
  const [altitude, setAltitude] = useState(0);
  const [hovered, setHover] = useState<{ at: LatLon; tile: Tile } | null>(null);
  // a hover left over from the previous world is not shown
  const hover = hovered?.tile.world === world ? hovered : null;
  // with no pointer on the globe the readout stays on the open block
  const readout =
    hover ?? (selected ? { at: selected.center, tile: selected } : null);
  const hoverTile = hover?.tile ?? null;
  const [activePin, setActivePin] = useState<string | null>(null);
  const [relief, setRelief] = useState(1);
  // tagged with its world so a rebuilt viewer does not replay an old flight
  const [focus, setFocus] = useState<
    (LatLon & { key: number; world: World }) | null
  >(null);
  const flyTo = useCallback(
    (p: LatLon) =>
      setFocus((f) => ({
        lat: p.lat,
        lon: p.lon,
        world,
        key: (f?.key ?? 0) + 1,
      })),
    [world],
  );
  const targets = useTargets().data;
  const targetId = search.get("target") ?? targets?.[0]?.id ?? null;
  // the same cached result the panel shows
  const result = useScore(
    selected?.world === "earth" ? selected.id : null,
    targetId,
  ).data;
  const points = result?.points ?? NO_POINTS;
  const target = targets?.find((t) => t.id === targetId);
  // the earth pane as a plain height grid with the target drawn over it
  const [wire, setWire] = useState(false);
  const [matched, setMatched] = useState(false);
  const pins = useMemo<Pin[]>(
    () =>
      world === "earth"
        ? CHECK_PINS
        : (targets ?? [])
            .filter((t) => t.world === world)
            .map((t) => ({
              id: t.id,
              name: t.name,
              lat: t.lat,
              lon: t.lon,
              kind: "target",
            })),
    [world, targets],
  );
  const value = useMemo(
    () => ({
      world,
      status,
      altitude,
      hoverTile,
      pins,
      activePin,
      setActivePin,
      flyTo,
      targetId,
      selected,
    }),
    [
      world,
      status,
      altitude,
      hoverTile,
      pins,
      activePin,
      flyTo,
      targetId,
      selected,
    ],
  );
  const onPick = useCallback(
    (p: LatLon | null, pinId: string | null) => {
      const at = pins.find((x) => x.id === pinId) ?? p;
      if (!at) return;
      // only earth is scored, the moon and mars pins are the fixed targets
      if (world === "earth")
        router.push(siteHref(pointTile("earth", at.lat, at.lon).id, targetId));
      else if (pinId) flyTo(at);
    },
    [pins, flyTo, world, router, targetId],
  );

  // esc on a result steps back to the globe, capture so the globe's own esc does not also fire
  useEffect(() => {
    if (!selected) return;
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      e.preventDefault();
      router.push("/");
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [selected, router]);
  const onHover = useCallback(
    (at: LatLon | null, tile: Tile | null) =>
      setHover(at && tile ? { at, tile } : null),
    [],
  );

  return (
    <ExploreContext.Provider value={value}>
      <div
        className={
          selected
            ? "grid min-h-0 flex-1 grid-cols-[220px_minmax(0,1fr)_420px] max-lg:grid-cols-[minmax(0,1fr)_380px] max-lg:grid-rows-[auto_minmax(0,1fr)] max-md:grid-cols-1 max-md:grid-rows-[auto_minmax(260px,42vh)_minmax(0,1fr)]"
            : "grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_420px] max-md:grid-cols-1 max-md:grid-rows-[minmax(260px,42vh)_minmax(0,1fr)]"
        }
      >
        {selected && <TargetList />}
        <div
          className={
            selected
              ? "grid min-h-0 grid-rows-[minmax(0,3fr)_minmax(0,2fr)]"
              : "contents"
          }
        >
          <section
            aria-label={`${WORLD_LABEL[world]} globe`}
            className="sky relative min-h-[260px] overflow-hidden"
          >
            <GlobeView
              world={world}
              onStatus={setStatus}
              onAltitude={setAltitude}
              onHover={onHover}
              onPick={onPick}
              pins={pins}
              activePin={activePin}
              focus={focus?.world === world ? focus : null}
              selected={selected?.world === world ? selected : null}
              relief={relief}
              points={points}
            />
            <WorldSwitcher world={world} />
            {selected && (
              <div
                role="toolbar"
                aria-label="Block view"
                className="absolute top-3 right-3 z-30 flex items-center gap-2 rounded-md border border-line bg-panel py-1 pr-1 pl-2.5 text-xs"
              >
                {world === "earth" && (
                  <>
                    <span id="relief-label" className="text-text-2">
                      Relief
                    </span>
                    <ToggleGroup
                      type="single"
                      size="sm"
                      spacing={0}
                      aria-labelledby="relief-label"
                      value={String(relief)}
                      onValueChange={(r) => r && setRelief(Number(r))}
                    >
                      {[1, 2, 3].map((r) => (
                        <ToggleGroupItem key={r} value={String(r)}>
                          {r}×
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </>
                )}
                {world === "earth" && (
                  <>
                    <Toggle
                      size="sm"
                      pressed={wire}
                      onPressedChange={setWire}
                      disabled={!result}
                    >
                      Overlay target as wireframe
                    </Toggle>
                    {wire && (
                      <Toggle
                        size="sm"
                        pressed={matched}
                        onPressedChange={setMatched}
                      >
                        Matched relief
                      </Toggle>
                    )}
                  </>
                )}
                <Link
                  href={world === "earth" ? "/" : `/?world=${world}`}
                  className="inline-flex h-7 items-center rounded-md px-2 hover:bg-hover hover:no-underline"
                >
                  ← Globe
                </Link>
              </div>
            )}
            {status.state === "loading" && (
              <p
                role="status"
                className="absolute bottom-3 left-3 rounded-md border border-line bg-panel px-2.5 py-1.5 text-xs text-text-2"
              >
                Loading {WORLD_LABEL[world]}…
              </p>
            )}
            {status.state === "error" && (
              <p
                role="alert"
                className="absolute bottom-3 left-3 max-w-sm rounded-md border border-line bg-panel px-2.5 py-1.5 text-xs"
              >
                <b className="block font-semibold">
                  The {WORLD_LABEL[world]} globe did not load
                </b>
                <span className="text-text-2">
                  {status.message ?? "Check your connection and reload."}
                </span>
              </p>
            )}
            {selected && wire && (
              <WireOverlay
                gridUrl={result?.grid_url}
                target={target}
                relief={relief}
                matched={matched}
              />
            )}
          </section>
          {selected && (
            <TargetBlock
              target={target}
              relief={world === "earth" ? relief : 1}
            />
          )}
        </div>
        {children}
      </div>
      <StatusItems>
        <span>{WORLD_LABEL[world]}</span>
        {readout && (
          <span className="tabular-nums">
            {fmtLatLon(readout.at.lat, readout.at.lon)}
          </span>
        )}
        {readout && (
          <span className="max-md:hidden">Block {readout.tile.id}</span>
        )}
        <span className="tabular-nums">Altitude {fmtAltitude(altitude)}</span>
      </StatusItems>
    </ExploreContext.Provider>
  );
}
