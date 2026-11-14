// runs only when API_URL is set
import { describe, expect, it } from "vitest";
import { terrainStats } from "./terrain";
import { decodeGrid } from "./grid";

const API = process.env.API_URL;

describe.skipIf(!API)("live api", () => {
  it("scores a block against moon and mars regions and serves its grid", async () => {
    const res = await fetch(`${API}/score`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tile_id: "earth:p:35.0270:-111.0220" }),
    });
    expect(res.status).toBe(200);
    const r = await res.json();
    const url = r.grid_url.startsWith("http") ? r.grid_url : `${API}${r.grid_url}`;
    const g = decodeGrid(await (await fetch(url)).arrayBuffer());
    const s = terrainStats(g);
    expect(g.n).toBe(128);
    // the block measurements come from the same grid
    expect(Math.abs(s.reliefM - r.block.relief) / r.block.relief).toBeLessThan(0.1);
    for (const tab of ["moon", "mars"]) {
      const w = r.worlds[tab];
      expect(w.regions.length).toBeGreaterThan(0);
      expect(w.regions.map((x: { region: string }) => x.region)).toContain(w.best_region);
      expect(w.best_match.cell_cost.flat()).toHaveLength(64);
    }
    // the matched block's grid comes from the library endpoint
    const lib = await (await fetch(`${API}/library/${r.worlds.moon.best_match.index}`)).json();
    const libUrl = lib.grid_url.startsWith("http") ? lib.grid_url : `${API}${lib.grid_url}`;
    expect(decodeGrid(await (await fetch(libUrl)).arrayBuffer()).n).toBe(128);
  });

  it("answers an ocean tile with no_terrain", async () => {
    const res = await fetch(`${API}/score`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tile_id: "earth:g:0:-8000" }),
    });
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("no_terrain");
  });
});
