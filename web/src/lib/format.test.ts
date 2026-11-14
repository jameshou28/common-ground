import { describe, expect, it } from "vitest";
import { fmtAltitude, fmtLatLon } from "./format";
import { pointTile, RADIUS_M, tileFor, tileFromId, WORLDS } from "./tiles";

describe("format", () => {
  it("writes coordinates with hemispheres", () => {
    expect(fmtLatLon(35.0274, -111.0221)).toBe("35.027° N, 111.022° W");
    expect(fmtLatLon(-89.5, 20)).toBe("89.500° S, 20.000° E");
  });
  it("switches altitude to km at 10 km", () => {
    expect(fmtAltitude(9_900)).toBe("9,900 m");
    expect(fmtAltitude(21_000_000)).toBe("21,000 km");
  });
});

describe("hover footprint", () => {
  // the outline drawn for a hovered point must contain that point
  it.each(WORLDS)("%s grid tile contains the hovered point", (world) => {
    for (const [lat, lon] of [[35.0274, -111.0221], [-12.3, 44.9], [79.9, 10], [0.01, -0.01]]) {
      const [sw, se, , nw] = tileFor(world, lat, lon).corners;
      expect(lat).toBeGreaterThanOrEqual(sw[1]);
      expect(lat).toBeLessThanOrEqual(nw[1]);
      expect(lon).toBeGreaterThanOrEqual(sw[0]);
      expect(lon).toBeLessThanOrEqual(se[0]);
    }
  });

  // a click scores the 4 km block centred on the clicked point
  it.each(WORLDS)("%s point block is centred on the point and 4 km across", (world) => {
    const t = pointTile(world, 35.02704, -111.02196);
    expect(t.id).toBe(`${world}:p:35.0270:-111.0220`);
    expect(tileFromId(t.id).center).toEqual({ lat: 35.027, lon: -111.022 });
    const [sw, se, , nw] = t.corners;
    const rad = Math.PI / 180;
    expect((nw[1] - sw[1]) * rad * RADIUS_M[world]).toBeCloseTo(4000, 3);
    expect((se[0] - sw[0]) * rad * RADIUS_M[world] * Math.cos(35.027 * rad)).toBeCloseTo(4000, 3);
  });
  it("keeps -0 and the antimeridian out of point ids", () => {
    expect(pointTile("earth", -0.00001, 180.00001).id).toBe("earth:p:0.0000:-180.0000");
    expect(() => tileFromId("earth:p:95.0000:0.0000")).toThrow();
  });
});
