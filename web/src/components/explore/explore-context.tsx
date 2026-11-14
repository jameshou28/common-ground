"use client";

import { createContext, useContext } from "react";
import type { Tile, World } from "@/lib/tiles";
import type { GlobeStatus } from "@/components/globe/config";

export type ExploreState = {
  world: World;
  status: GlobeStatus;
  // camera height in metres
  altitude: number;
  // block under the pointer
  hoverTile: Tile | null;
};

export const ExploreContext = createContext<ExploreState | null>(null);

export function useExplore(): ExploreState {
  const v = useContext(ExploreContext);
  if (!v) throw new Error("useExplore must be used inside ExploreShell");
  return v;
}
