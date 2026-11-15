import type { Pin } from "@/components/globe/pins";
import bestSites from "../../public/data/best_sites.json";
import type { World } from "./tiles";

const RADIUS_KM: Record<World, number> = { earth: 6371, moon: 1737.4, mars: 3396.19 };

function km(world: World, a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const rad = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lon - a.lon) * rad) / 2) ** 2;
  return 2 * RADIUS_KM[world] * Math.asin(Math.min(1, Math.sqrt(h)));
}

type Best = { name: string; lat: number; lon: number; title?: string };

// every best-site pick, with the list it's on
const BEST: Best[] = (() => {
  const f = bestSites as unknown as { worlds?: Record<string, { title: string; sites: Best[] }[]> };
  return Object.values(f.worlds ?? {}).flatMap((regs) => regs.flatMap((r) => r.sites.map((s) => ({ ...s, title: r.title }))));
})();

const KIND_NOTE: Partial<Record<Pin["kind"], string>> = { moon: "Moon analog site", mars: "Mars analog site" };

// the name of what a block was opened from: the nearest pin on its globe within a few km (the click lands a little off
// the pin), else on earth a best-site pick. null for an ordinary click
export function nameNear(world: World, at: { lat: number; lon: number }, pins: Pin[], maxKm = world === "earth" ? 3 : 6): { name: string; note?: string } | null {
  let best: { name: string; note?: string } | null = null;
  let bestKm = maxKm;
  for (const p of pins) {
    const d = km(world, at, p);
    if (d <= bestKm) {
      best = { name: p.name, note: KIND_NOTE[p.kind] };
      bestKm = d;
    }
  }
  if (best || world !== "earth") return best;
  for (const s of BEST) {
    const d = km(world, at, s);
    if (d <= 2 && d <= bestKm) {
      best = { name: s.name, note: s.title ? `Best site for ${s.title.toLowerCase()}` : undefined };
      bestKm = d;
    }
  }
  return best;
}
