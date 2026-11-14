"use client";

import { useEffect, useRef, useState } from "react";
import { tileFor, type Tile, type World } from "@/lib/tiles";
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
};

export default function GlobeView({ world, onStatus, onAltitude, onHover, onPick, pins, activePin, focus }: GlobeViewProps) {
  const el = useRef<HTMLDivElement>(null);
  const credits = useRef<HTMLDivElement>(null);
  const handle = useCesiumViewer({ world, el, credits, onStatus, onAltitude });
  const [tile, setTile] = useState<Tile | null>(null);

  useGlobeControls(
    handle,
    (p) => {
      const next = p && tileFor(world, p.lat, p.lon);
      // keep the same object while the pointer stays in one block
      const same = next?.id === tile?.id;
      if (!same) setTile(next);
      onHover(p, same ? tile : next);
    },
    onPick,
  );

  useEffect(() => {
    if (handle && focus) void flyToBlock(handle, focus);
  }, [handle, focus]);

  return (
    <>
      <div ref={el} className="globe" />
      <div ref={credits} className="globe-credits" />
      <HoverFootprint handle={handle} tile={tile} />
      <Pins handle={handle} pins={pins} active={activePin} />
    </>
  );
}
