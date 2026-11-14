"use client";

import { useEffect, useRef, useState } from "react";
import type { Point } from "@/lib/api";
import { pointTile, type Tile, type World } from "@/lib/tiles";
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
  points: Point[];
  // sun elevation for moon light on the block, null when off
  moonSun: number | null;
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

export default function GlobeView({ world, onStatus, onAltitude, onHover, onPick, pins, activePin, focus, selected, relief, points, moonSun, capture }: GlobeViewProps) {
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

  useEffect(() => {
    if (!handle) return;
    return shareCapture(capture, () => {
      // the drawing buffer is only readable straight after a render
      handle.v.scene.render();
      return handle.v.scene.canvas.toDataURL("image/jpeg", 0.9);
    });
  }, [handle, capture]);

  return (
    <>
      <div ref={el} className="globe" />
      <div ref={credits} className="globe-credits" />
      <HoverFootprint handle={handle} tile={selected ? null : tile} />
      <Pins handle={handle} pins={selected ? NO_PINS : pins} active={activePin} />
      <BlockPullOut handle={handle} tile={selected} relief={relief} points={points} moonSun={moonSun} />
    </>
  );
}
