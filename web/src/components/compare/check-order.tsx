"use client";

import { useTargets } from "@/lib/queries";
import { RankStrip } from "./rank-strip";

// the live rank strip for the first target, for pages with no target of their own
export function CheckOrder() {
  return <RankStrip targetId={useTargets().data?.[0]?.id ?? null} />;
}
