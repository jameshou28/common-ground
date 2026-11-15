import { expect, it } from "vitest";
import { compareHref, parseTiles } from "./compare";

it("keeps valid earth blocks, drops repeats and stops at four", () => {
  const raw = "earth:g:1:1,nope,moon:ps:s:-3:-3,earth:g:1:1,earth:p:35.0270:-111.0220,earth:g:2:2,earth:g:3:3,earth:g:4:4";
  expect(parseTiles(raw)).toEqual(["earth:g:1:1", "earth:p:35.0270:-111.0220", "earth:g:2:2", "earth:g:3:3"]);
  expect(parseTiles(null)).toEqual([]);
});

it("the url reproduces the view", () => {
  const href = compareHref(["earth:g:1:1", "earth:p:35.0270:-111.0220"], "mars");
  expect(href).toBe("/compare?tiles=earth:g:1:1,earth:p:35.0270:-111.0220&tab=mars");
  expect(parseTiles(new URL(href, "http://x").searchParams.get("tiles"))).toHaveLength(2);
  expect(compareHref([])).toBe("/compare");
});
