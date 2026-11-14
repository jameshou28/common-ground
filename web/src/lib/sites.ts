import raw from "../../public/data/check_sites.json";
import { pointTile } from "./tiles";

// places whose answer was written down before scoring, worst to best
export type CheckSite = {
  id: string;
  name: string;
  region: string;
  lat: number;
  lon: number;
  note: string;
  // expected analog quality, 1 worst to 5 best
  rank: number;
  tileId: string;
};

export const CHECK_SITES: CheckSite[] = raw.map((s) => ({ ...s, tileId: pointTile("earth", s.lat, s.lon).id }));

export const RANK_LABEL = ["", "Very bad", "Bad", "Medium", "Good", "Very good"] as const;

// tile ids go in the path as they are, colons are legal there
export function siteHref(tileId: string, m: { tab?: string; region?: string; site?: number } = {}) {
  const q = new URLSearchParams();
  if (m.tab) q.set("tab", m.tab);
  if (m.region) q.set("region", m.region);
  if (m.site != null) q.set("site", String(m.site));
  const s = q.toString();
  return `/site/${tileId}${s ? `?${s}` : ""}`;
}
