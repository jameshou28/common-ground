"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useSyncExternalStore } from "react";
import { useScore } from "@/lib/queries";
import { pickMatch } from "@/lib/regions";
import type { Tile } from "@/lib/tiles";

// the score of the open block and the tab, region and site the url picks
const subscribe = () => () => {};

export function useMatch(tile: Tile | null) {
  const search = useSearchParams();
  // the server has no score cache, so read it only after hydration or the panel mismatches
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  const q = useScore(hydrated && tile?.world === "earth" ? tile.id : null);
  const [tab, region, site] = [search.get("tab"), search.get("region"), search.get("site")];
  const match = useMemo(() => (q.data ? pickMatch(q.data, tab, region, site) : null), [q.data, tab, region, site]);
  return { q, match };
}
