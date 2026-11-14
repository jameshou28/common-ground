// runs only when API_URL is set
import { describe, expect, it } from "vitest";
import { terrainStats } from "./terrain";
import { decodeGrid } from "./grid";

const API = process.env.API_URL;

describe.skipIf(!API)("live api", () => {
  it("serves a grid whose terrain matches the contributions the API computed", async () => {
    const res = await fetch(`${API}/score`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tile_id: "earth:g:974:-2527", target_id: "connecting_ridge" }),
    });
    expect(res.status).toBe(200);
    const r = await res.json();
    const url = r.grid_url.startsWith("http") ? r.grid_url : `${API}${r.grid_url}`;
    const g = decodeGrid(await (await fetch(url)).arrayBuffer());
    const s = terrainStats(g);
    const value = (key: string) => r.contributions.find((c: { key: string }) => c.key === key).value as number;
    expect(g.n).toBe(128);
    expect(s.reliefM).toBeCloseTo(value("relief_m"), -0.5); // within about 1 m
    expect(Math.abs(s.slopeMedDeg - value("slope_med_deg")) / value("slope_med_deg")).toBeLessThan(0.03);
    expect(Math.abs(s.slopeP90Deg - value("slope_p90_deg")) / value("slope_p90_deg")).toBeLessThan(0.05);
  });

  it("answers an ocean tile with no_terrain", async () => {
    const res = await fetch(`${API}/score`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tile_id: "earth:g:0:-8000", target_id: "connecting_ridge" }),
    });
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("no_terrain");
  });
});
