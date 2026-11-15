import { describe, expect, it } from "vitest";
import { nameNear } from "./names";

const pins = [{ id: "a", name: "Meteor Crater", lat: 35.0281, lon: -111.0233, kind: "moon" as const }];

describe("nameNear", () => {
  it("names a block opened near a pin, and nothing for an ordinary click", () => {
    expect(nameNear("earth", { lat: 35.03, lon: -111.02 }, pins)?.name).toBe("Meteor Crater");
    expect(nameNear("earth", { lat: 35.03, lon: -111.02 }, pins)?.note).toBe("Moon analog site");
    expect(nameNear("earth", { lat: 36.5, lon: -111.02 }, [])).toBeNull();
  });
});
