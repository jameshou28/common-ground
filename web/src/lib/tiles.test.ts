import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isTileId, tileCenter, tileFor, tileFromId, worldOf, type World } from "./tiles";

type Fixture = { world: World; lat: number; lon: number; id: string; center: { lat: number; lon: number } };
const fixtures: Fixture[] = JSON.parse(readFileSync("public/data/tile_id_fixtures.json", "utf8"));

describe("tile ids match the Python implementation", () => {
  it("has the fixtures", () => expect(fixtures.length).toBeGreaterThanOrEqual(50));

  it.each(fixtures.map((f) => [`${f.world} ${f.lat},${f.lon}`, f] as const))("%s", (_, f) => {
    expect(tileFor(f.world, f.lat, f.lon).id).toBe(f.id);
    const c = tileCenter(f.id);
    expect(c.lat).toBeCloseTo(f.center.lat, 6);
    // longitude is meaningless at the exact pole
    if (Math.abs(f.center.lat) < 89.999) expect(c.lon).toBeCloseTo(f.center.lon, 6);
    // round trip fails at the 80 degree line and antimeridian, where ground has two ids
    const kind = f.id.split(":")[1];
    const seam = kind !== (Math.abs(c.lat) < 80 ? "g" : "ps") || (kind === "g" && Math.abs(c.lon) > 179.9);
    if (!seam) expect(tileFor(f.world, c.lat, c.lon).id).toBe(f.id);
  });
});

describe("tile ids", () => {
  it("accepts and rejects the right shapes", () => {
    expect(isTileId("earth:g:974:-2527")).toBe(true);
    expect(isTileId("moon:ps:s:-3:-3")).toBe(true);
    expect(isTileId("venus:g:1:1")).toBe(false);
    expect(isTileId("earth:g:1")).toBe(false);
    expect(worldOf("mars:g:1:2")).toBe("mars");
    expect(worldOf("nope")).toBeNull();
  });

  it("rejects ids that are not tiles", () => {
    expect(() => tileFromId("earth:g:99999:0")).toThrow();
    expect(() => tileFromId("junk")).toThrow();
  });

  it("corners surround the centre", () => {
    const t = tileFromId("earth:g:974:-2527");
    const lons = t.corners.map((c) => c[0]);
    const lats = t.corners.map((c) => c[1]);
    expect(Math.min(...lons)).toBeLessThan(t.center.lon);
    expect(Math.max(...lons)).toBeGreaterThan(t.center.lon);
    expect(Math.min(...lats)).toBeLessThan(t.center.lat);
    expect(Math.max(...lats)).toBeGreaterThan(t.center.lat);
  });
});
