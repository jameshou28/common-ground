import raw from "../../public/data/check_sites.json";
import { tileFor } from "./tiles";

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

export const CHECK_SITES: CheckSite[] = raw.map((s) => ({ ...s, tileId: tileFor("earth", s.lat, s.lon).id }));

export const RANK_LABEL = ["", "Very bad", "Bad", "Medium", "Good", "Very good"] as const;

// tile ids go in the path as they are, colons are legal there
export const siteHref = (tileId: string, targetId?: string | null) => `/site/${tileId}${targetId ? `?target=${encodeURIComponent(targetId)}` : ""}`;
