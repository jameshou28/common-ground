import { afterEach, expect, it, vi } from "vitest";

vi.mock("./env", () => ({
  env: { apiUrl: "http://api", gridBase: "http://api", supabaseUrl: "https://x.supabase.co", supabaseAnonKey: "anon", modelVersion: "m1", liveScoring: true },
}));

import { cachedScore } from "./api";

afterEach(() => vi.unstubAllGlobals());

it("reads a stored result from supabase by tile and model version", async () => {
  const fetchMock = vi.fn<(url: string) => Promise<Response>>(async () => new Response(JSON.stringify([{ result: { tile_id: "earth:g:1:1", model_version: "m1", cached: false } }])));
  vi.stubGlobal("fetch", fetchMock);
  const r = await cachedScore("earth:g:1:1");
  expect(r).toMatchObject({ model_version: "m1", cached: true });
  const url = new URL(String(fetchMock.mock.calls[0][0]));
  expect(url.pathname).toBe("/rest/v1/scores");
  expect(Object.fromEntries(url.searchParams)).toMatchObject({ tile_id: "eq.earth:g:1:1", model_version: "eq.m1" });
  expect(url.searchParams.has("target_id")).toBe(false);
});

it("gives null on a miss or a failed read, so the api is asked", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("[]")));
  expect(await cachedScore("earth:g:1:1")).toBeNull();
  vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
  expect(await cachedScore("earth:g:1:1")).toBeNull();
});
