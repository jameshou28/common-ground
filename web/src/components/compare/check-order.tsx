"use client";

import { RankStrip } from "./rank-strip";

// the live rank strip for pages with no tab of their own
export function CheckOrder() {
  return <RankStrip tab="moon" />;
}
