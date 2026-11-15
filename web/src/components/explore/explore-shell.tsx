"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { alignedCell } from "@/lib/align";
import { useAlignedLibraryGrid, useGrid, useTargets } from "@/lib/queries";
import { cellPoints, type CellPoint } from "@/lib/regions";
import { ApiError } from "@/lib/api";
import { isLandCell } from "@/lib/land-mask";
import { placeNear, placesOn } from "@/lib/places";
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
import analogSites from "../../../public/data/analog_sites.json";
import type { LatLon } from "@/components/globe/use-globe-controls";
import { WorldSwitcher } from "@/components/globe/world-switcher";
import { StatusItems } from "@/components/shell/status-bar";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MatchedBlock } from "@/components/site/matched-block";
import { useMatch } from "@/components/site/use-match";
import { RegionList } from "@/components/site/region-list";
import { ExploreContext } from "./explore-context";

// cesium needs the browser
const GlobeView = dynamic(() => import("@/components/globe/globe-view"), {
  ssr: false,
});

// earth places the ml notebook lists as mars or moon analogs
const ANALOG_PINS: Pin[] = analogSites.map((s) => ({ id: `analog-${s.id}`, name: s.name, lat: s.lat, lon: s.lon, kind: s.world as "mars" | "moon" }));
// the check sites float on the earth globe as named points, so the model can be checked by eye; no sidebar list
const CHECK_PINS: Pin[] = CHECK_SITES.map((s) => ({ id: s.id, name: s.name, lat: s.lat, lon: s.lon, kind: "check" }));
const EARTH_PINS = [...ANALOG_PINS, ...CHECK_PINS];

const NO_POINTS: CellPoint[] = [];
// a low sun for moon light, the library blocks carry no sun angle of their own
const MOON_SUN_DEG = 8;

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
  const router = useRouter();
  const { tileId } = useParams<{ tileId?: string }>();
  const selected = useMemo(() => parseTile(tileId), [tileId]);
  // an open block shows its own world's globe; otherwise the ?world= param picks it
  const world = selected?.world ?? parseWorld(search.get("world"));
  // only earth blocks are scored and get the region list and the matched block under the globe
  const scored = selected?.world === "earth";
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
  // the same cached result the panel shows
  const { q: score, match } = useMatch(selected);
  const result = score.data;
  // water isn't scored: open sea never asks the api, a mostly-water coastal block comes back no_terrain
  const water =
    selected?.world === "earth" &&
    (!isLandCell(selected.center.lat, selected.center.lon) || (score.error instanceof ApiError && score.error.code === "no_terrain"));
  const blockGrid = useGrid(result?.grid_url).data;
  // the matched block lined up with this one for display, the bottom pane exists only once its grid has loaded
  const { grid: matchedGrid, alignment } = useAlignedLibraryGrid(match?.site.index, blockGrid);
  // the cell pairings move with the lined-up view
  const points = useMemo(
    () => (match ? cellPoints(match.site, alignment ? (row, col) => alignedCell(alignment, row, col) : undefined) : NO_POINTS),
    [match, alignment],
  );
  // the earth pane as a plain height grid with the matched block drawn over it
  const [wire, setWire] = useState(false);
  // light both blocks with a sun just above the horizon, as at the lunar poles
  const [moon, setMoon] = useState(false);
  const moonSun = moon && match?.tab === "moon" ? MOON_SUN_DEG : null;
  const captureSlot = useRef<(() => string | null) | null>(null);
  const capture = useCallback(() => captureSlot.current?.() ?? null, []);
  const pins = useMemo<Pin[]>(
    () =>
      world === "earth"
        ? EARTH_PINS
        : [
            ...placesOn(world).map((p): Pin => ({ id: p.id, name: p.name, lat: p.lat, lon: p.lon, kind: "target" })),
            ...(targets ?? [])
              .filter((t) => t.world === world)
              .map((t): Pin => ({
                id: t.id,
                name: t.name,
                lat: t.lat,
                lon: t.lon,
                kind: "target",
              })),
          ],
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
      selected,
      capture,
    }),
    [
      world,
      status,
      altitude,
      hoverTile,
      pins,
      activePin,
      flyTo,
      selected,
      capture,
    ],
  );
  const onPick = useCallback(
    (p: LatLon | null, pinId: string | null) => {
      const near = !pinId && p && world !== "earth" ? placeNear(world, p.lat, p.lon) : undefined;
      const at = pins.find((x) => x.id === pinId) ?? near ?? p;
      if (!at) return;
      // every world opens the block; only earth blocks get scored
      router.push(siteHref(pointTile(world, at.lat, at.lon).id));
    },
    [pins, world, router],
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
          scored
            ? "grid min-h-0 flex-1 grid-cols-[264px_minmax(0,1fr)_360px] max-lg:grid-cols-[minmax(0,1fr)_340px] max-lg:grid-rows-[auto_minmax(0,1fr)] max-md:grid-cols-1 max-md:grid-rows-[auto_minmax(260px,42vh)_minmax(0,1fr)]"
            : "grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_360px] max-md:grid-cols-1 max-md:grid-rows-[minmax(260px,42vh)_minmax(0,1fr)]"
        }
      >
        {scored && <RegionList />}
        <div
          className={
            scored && matchedGrid
              ? "grid min-h-0 grid-rows-[minmax(0,3fr)_minmax(0,2fr)]"
              : selected
                ? "grid min-h-0"
                : "contents"
          }
        >
          <section
            aria-label={`${WORLD_LABEL[world]} globe`}
            className="sky relative min-h-[260px] overflow-hidden"
            data-loading={status.state === "loading" || undefined}
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
              matchName={match?.site.name ?? "the match"}
              moonSun={moonSun}
              wire={wire && blockGrid && matchedGrid ? { block: blockGrid, over: matchedGrid } : null}
              capture={captureSlot}
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
                      disabled={!blockGrid || !matchedGrid}
                    >
                      Overlay the match as wireframe
                    </Toggle>
                  </>
                )}
                {world === "earth" && match?.tab === "moon" && (
                  <Toggle size="sm" pressed={moon} onPressedChange={setMoon}>
                    Moon light on both
                  </Toggle>
                )}
                <Link
                  href={world === "earth" ? "/" : `/?world=${world}`}
                  className="inline-flex h-7 items-center rounded-md px-2 hover:bg-hover hover:no-underline"
                >
                  ← Globe
                </Link>
              </div>
            )}
            {/* stays mounted so it can fade out */}
            <div role="status" aria-hidden={status.state !== "loading"} className="globe-loader">
              <svg viewBox="-50 -50 100 100" className="size-40 text-brand" fill="none" stroke="currentColor" strokeWidth="0.6">
                <circle r="45" />
                {[-30, -15, 0, 15, 30].map((y) => (
                  <ellipse key={y} cy={y} rx={Math.sqrt(45 * 45 - y * y)} ry="3" opacity="0.5" />
                ))}
                <g className="globe-loader-spin">
                  {[0, 1, 2, 3].map((i) => (
                    <ellipse key={i} rx="45" ry="45" style={{ animationDelay: `${-i * 1.5}s` }} />
                  ))}
                </g>
              </svg>
              <p className="text-xs text-text-2">Loading {WORLD_LABEL[world]}…</p>
            </div>
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
          </section>
          {scored && (
            <MatchedBlock
              grid={matchedGrid}
              alignment={alignment}
              blank={water}
              match={match}
              relief={world === "earth" ? relief : 1}
              moonSun={moonSun}
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
