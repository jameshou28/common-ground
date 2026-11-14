import { expect, it } from "vitest";
import { CHECK_SITES } from "./sites";

it("has nine check sites, worst to best, on distinct blocks", () => {
  expect(CHECK_SITES).toHaveLength(9);
  expect(CHECK_SITES.map((s) => s.rank)).toEqual([...CHECK_SITES.map((s) => s.rank)].sort((a, b) => a - b));
  expect(new Set(CHECK_SITES.map((s) => s.tileId)).size).toBe(9);
  expect(CHECK_SITES.find((s) => s.id === "meteor-crater")?.tileId).toBe("earth:g:974:-2527");
});
