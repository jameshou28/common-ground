"use client";

import { createContext, useContext } from "react";
import type { Tile, World } from "@/lib/tiles";
import type { GlobeStatus } from "@/components/globe/config";
import type { Pin } from "@/components/globe/pins";

export type ExploreState = {
  world: World;
  status: GlobeStatus;
  // camera height in metres
  altitude: number;
  // block under the pointer
  hoverTile: Tile | null;
  // check sites on earth, targets on the moon and mars
  pins: Pin[];
  activePin: string | null;
  setActivePin: (id: string | null) => void;
  flyTo: (p: { lat: number; lon: number }) => void;
  // from ?target=, else the first target the api lists
  targetId: string | null;
  // the scored block when a site page is open
  selected: Tile | null;
  // the current globe view as a jpeg data url, for the field sheet
  capture: () => string | null;
};

export const ExploreContext = createContext<ExploreState | null>(null);

export function useExplore(): ExploreState {
  const v = useContext(ExploreContext);
  if (!v) throw new Error("useExplore must be used inside ExploreShell");
  return v;
}
