import { describe, expect, it } from "vitest";
import { fmtAltitude, fmtLatLon } from "./format";
import { tileFor, WORLDS } from "./tiles";

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
});
