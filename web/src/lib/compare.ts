import { isTileId, worldOf } from "./tiles";

export const MAX_COMPARE = 4;
const KEY = "compare-tiles";
const EVENT = "compare-change";

// earth block ids from a comma list, deduplicated, at most four
export function parseTiles(raw: string | null | undefined): string[] {
  const ids = (raw ?? "").split(",").filter((id) => isTileId(id) && worldOf(id) === "earth");
  return [...new Set(ids)].slice(0, MAX_COMPARE);
}

export function compareHref(tiles: string[], tab?: string | null): string {
  const q = [tiles.length ? `tiles=${tiles.join(",")}` : "", tab ? `tab=${tab}` : ""].filter(Boolean).join("&");
  return q ? `/compare?${q}` : "/compare";
}

// the list also lives in session storage, so "add to compare" on a result page can append to it
export const compareStore = {
  read: () => {
    try {
      return sessionStorage.getItem(KEY) ?? "";
    } catch {
      return "";
    }
  },
  write(tiles: string[]) {
    try {
      sessionStorage.setItem(KEY, tiles.join(","));
    } catch {
      // private mode, the url still carries the list
    }
    window.dispatchEvent(new Event(EVENT));
  },
  subscribe(fn: () => void) {
    window.addEventListener(EVENT, fn);
    return () => window.removeEventListener(EVENT, fn);
  },
};
