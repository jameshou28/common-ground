import { describe, expect, it } from "vitest";
import { isLandCell } from "./land-mask";

describe("land mask", () => {
  it("knows land from open sea", () => {
    expect(isLandCell(35.027, -111.022)).toBe(true); // Meteor Crater
    expect(isLandCell(52.53, 5.6)).toBe(true); // Flevoland, below sea level but land
    expect(isLandCell(-77.47, 161.8)).toBe(true); // Dry Valleys
    expect(isLandCell(0, -140)).toBe(false); // mid Pacific
    expect(isLandCell(-40, -20)).toBe(false); // south Atlantic
  });
});
