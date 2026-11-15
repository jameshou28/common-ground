"use client";

import { useEffect, useRef, useState } from "react";
import type { CellPoint } from "@/lib/regions";
import { pointTile, type Tile, type World } from "@/lib/tiles";
import type { Grid } from "@/lib/grid";
import { BlockPullOut } from "./block-pull-out";
import type { GlobeStatus } from "./config";
import { HoverFootprint } from "./hover-footprint";
import { Pins, type Pin } from "./pins";
import { useCesiumViewer } from "./use-cesium-viewer";
import { flyToBlock, useGlobeControls, type LatLon } from "./use-globe-controls";

export type GlobeViewProps = {
  world: World;
  onStatus: (s: GlobeStatus) => void;
  onAltitude: (m: number) => void;
  // pointer position on the surface and the block under it
  onHover: (p: LatLon | null, tile: Tile | null) => void;
  onPick: (p: LatLon | null, pinId: string | null) => void;
  pins: Pin[];
  activePin: string | null;
  // a new key flies the camera to the place
  focus: (LatLon & { key: number }) | null;
  // the scored block, pulled out of the planet
  selected: Tile | null;
  // vertical exaggeration of the pulled-out block, earth only
  relief: number;
  // feature points of the scored block
  points: CellPoint[];
  matchName: string;
  // sun elevation for moon light on the block, null when off
  moonSun: number | null;
  // the match drawn as lines over the pulled-out block, earth only
  wire: { block: Grid; over: Grid } | null;
  // filled with a function that returns the current view as a jpeg data url
  capture: { current: (() => string | null) | null };
};

function shareCapture(slot: GlobeViewProps["capture"], fn: () => string | null) {
  slot.current = fn;
  return () => {
    slot.current = null;
  };
}

// pins would float in empty space around a pulled-out block
const NO_PINS: Pin[] = [];

export default function GlobeView({ world, onStatus, onAltitude, onHover, onPick, pins, activePin, focus, selected, relief, points, matchName, moonSun, wire, capture }: GlobeViewProps) {
  const el = useRef<HTMLDivElement>(null);
  const credits = useRef<HTMLDivElement>(null);
  const handle = useCesiumViewer({ world, el, credits, onStatus, onAltitude });
  const [tile, setTile] = useState<Tile | null>(null);

  useGlobeControls(
    handle,
    (p) => {
      const next = p && pointTile(world, p.lat, p.lon);
      // keep the same object while the pointer has not moved
      const same = next?.id === tile?.id;
      if (!same) setTile(next);
      onHover(p, same ? tile : next);
    },
    onPick,
  );

  useEffect(() => {
    if (handle && focus) void flyToBlock(handle, focus);
  }, [handle, focus]);

  // without our own ion token cesium adds a "default access token" warning to the credits. hide only that one; the
  // data attribution stays. setting NEXT_PUBLIC_CESIUM_ION_TOKEN removes the warning at the source
  useEffect(() => {
    const box = credits.current;
    if (!box) return;
    const hide = () => {
      for (const n of box.querySelectorAll<HTMLElement>(".cesium-credit-textContainer > *"))
        if (/default ion access token/i.test(n.textContent ?? "")) n.style.display = "none";
    };
    hide();
    const obs = new MutationObserver(hide);
    obs.observe(box, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, [handle]);

  // the sky turns with the view, like a real star field behind the globe. the offsets come from where the camera
  // looks, in earth's frame; each layer moves a whole number of its tiles per turn, so it wraps without a seam. set
  // straight on background-position, every rendered frame
  useEffect(() => {
    const sky = el.current?.parentElement;
    if (!handle || !sky) return;
    const { v } = handle;
    const TAU = 2 * Math.PI;
    const place = () => {
      const d = v.camera.directionWC;
      const yaw = Math.atan2(d.y, d.x) / TAU;                                    // -0.5 .. 0.5 of a turn
      const pitch = Math.asin(Math.max(-1, Math.min(1, d.z))) / TAU;             // -0.25 .. 0.25
      // four layers, nearest first (the css order): bright haloed stars, big stars, small stars, a dense faint field.
      // each moves a whole number of its own tiles per turn, nearer layers more
      const at = (tile: number, turns: number) => `${(-yaw * turns * tile).toFixed(1)}px ${(pitch * turns * tile).toFixed(1)}px`;
      sky.style.backgroundPosition = `${at(1500, 6)}, ${at(730, 6)}, ${at(420, 3)}, ${at(1100, 2)}`;
    };
    place();
    v.scene.postRender.addEventListener(place);
    return () => {
      if (!v.isDestroyed()) v.scene.postRender.removeEventListener(place);
      sky.style.backgroundPosition = "";
    };
  }, [handle]);

  useEffect(() => {
    if (!handle) return;
    return shareCapture(capture, () => {
      // the drawing buffer is only readable straight after a render
      handle.v.scene.render();
      // png keeps the transparent sky, jpeg would paint it black
      return handle.v.scene.canvas.toDataURL("image/png");
    });
  }, [handle, capture]);

  return (
    <>
      <div ref={el} className="globe" />
      <div ref={credits} className="globe-credits" />
      <HoverFootprint handle={handle} tile={selected ? null : tile} />
      <Pins handle={handle} pins={selected ? NO_PINS : pins} active={activePin} />
      <BlockPullOut handle={handle} tile={selected} relief={relief} points={points} matchName={matchName} moonSun={moonSun} wire={wire} />
    </>
  );
}
