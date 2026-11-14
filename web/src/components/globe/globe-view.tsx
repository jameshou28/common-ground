"use client";

import { useRef } from "react";
import type { World } from "@/lib/tiles";
import type { GlobeStatus } from "./config";
import { useCesiumViewer } from "./use-cesium-viewer";

export type GlobeViewProps = {
  world: World;
  onStatus: (s: GlobeStatus) => void;
  onAltitude: (m: number) => void;
};

export default function GlobeView({ world, onStatus, onAltitude }: GlobeViewProps) {
  const el = useRef<HTMLDivElement>(null);
  const credits = useRef<HTMLDivElement>(null);
  useCesiumViewer({ world, el, credits, onStatus, onAltitude });
  return (
    <>
      <div ref={el} className="globe" />
      <div ref={credits} className="globe-credits" />
    </>
  );
}
