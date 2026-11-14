"use client";

import { useRef, useState } from "react";
import { tileFor, type Tile, type World } from "@/lib/tiles";
import type { GlobeStatus } from "./config";
import { HoverFootprint } from "./hover-footprint";
import { useCesiumViewer } from "./use-cesium-viewer";
import { useGlobeControls, type LatLon } from "./use-globe-controls";

export type GlobeViewProps = {
  world: World;
  onStatus: (s: GlobeStatus) => void;
  onAltitude: (m: number) => void;
  // pointer position on the surface and the block under it
  onHover: (p: LatLon | null, tile: Tile | null) => void;
};

export default function GlobeView({ world, onStatus, onAltitude, onHover }: GlobeViewProps) {
  const el = useRef<HTMLDivElement>(null);
  const credits = useRef<HTMLDivElement>(null);
  const handle = useCesiumViewer({ world, el, credits, onStatus, onAltitude });
  const [tile, setTile] = useState<Tile | null>(null);

  useGlobeControls(handle, (p) => {
    const next = p && tileFor(world, p.lat, p.lon);
    // keep the same object while the pointer stays in one block
    const same = next?.id === tile?.id;
    if (!same) setTile(next);
    onHover(p, same ? tile : next);
  });

  return (
    <>
      <div ref={el} className="globe" />
      <div ref={credits} className="globe-credits" />
      <HoverFootprint handle={handle} tile={tile} />
    </>
  );
}
