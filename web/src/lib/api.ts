import { env } from "./env";
import type { components } from "./api-types";
import { decodeGrid, type Grid } from "./grid";

type Schemas = components["schemas"];
export type BlockResult = Schemas["BlockResult"];
export type Contribution = Schemas["Contribution"];
export type Point = Schemas["Point"];
export type World = BlockResult["world"];

// from get /targets, the api returns it untyped
export type Target = {
  id: string;
  world: Exclude<World, "earth">;
  name: string;
  lat: number;
  lon: number;
  tile_id: string;
  sun_elevation_deg: number;
  dem_source: string;
  resolution_m: number;
  measured_share: number;
  features: Record<string, number>;
};

export type ApiErrorCode =
  | "no_terrain" // ocean or mostly water
  | "bad_tile"
  | "unknown_target"
  | "not_scorable" // only earth tiles are scored live
  | "dem_read_failed" // upstream elevation read failed
  | "rate_limited"
  | "busy"
  | "paused" // live scoring switched off
  | "network" // the api could not be reached
  | "unknown";

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const KNOWN = new Set<ApiErrorCode>(["no_terrain", "bad_tile", "unknown_target", "not_scorable", "dem_read_failed"]);

async function toError(res: Response): Promise<ApiError> {
  const body = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
  const message = body?.message || res.statusText || `HTTP ${res.status}`;
  if (res.status === 429) return new ApiError("rate_limited", message, 429);
  if (res.status === 503) return new ApiError("busy", message, 503);
  const code = body?.error as ApiErrorCode | undefined;
  if (code && KNOWN.has(code)) return new ApiError(code, message, res.status);
  // fastapi's own validation error has no error field, so the request was malformed
  if (res.status === 422) return new ApiError("bad_tile", message, 422);
  return new ApiError("unknown", message, res.status);
}

async function http(url: string, init?: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ApiError("network", "Could not reach the scoring service.");
  }
  if (!res.ok) throw await toError(res);
  return res;
}

export async function getTargets(): Promise<Target[]> {
  return (await http(`${env.apiUrl}/targets`)).json();
}

export async function score(tileId: string, targetId: string, signal?: AbortSignal): Promise<BlockResult> {
  if (!env.liveScoring) throw new ApiError("paused", "Live scoring is paused.");
  const res = await http(`${env.apiUrl}/score`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tile_id: tileId, target_id: targetId }),
    signal,
  });
  return res.json();
}

// cache-first read straight from supabase, null when it is off, empty or failing
export async function cachedScore(tileId: string, targetId: string, signal?: AbortSignal): Promise<BlockResult | null> {
  if (!env.supabaseUrl || !env.supabaseAnonKey) return null;
  const q = new URLSearchParams({
    tile_id: `eq.${tileId}`,
    target_id: `eq.${targetId}`,
    model_version: `eq.${env.modelVersion}`,
    select: "result",
    limit: "1",
  });
  try {
    const res = await fetch(`${env.supabaseUrl}/rest/v1/scores?${q}`, {
      headers: { apikey: env.supabaseAnonKey, authorization: `Bearer ${env.supabaseAnonKey}` },
      signal,
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as { result: BlockResult }[];
    return rows[0] ? { ...rows[0].result, cached: true } : null;
  } catch {
    return null;
  }
}

// relative in local dev, absolute r2 url in production
export const gridUrl = (url: string) => (/^https?:/.test(url) ? url : `${env.gridBase}${url}`);

export async function fetchGrid(url: string, signal?: AbortSignal): Promise<Grid> {
  return decodeGrid(await (await http(gridUrl(url), { signal })).arrayBuffer());
}

export function describeError(e: unknown): { title: string; body: string } {
  const code = e instanceof ApiError ? e.code : "unknown";
  switch (code) {
    case "no_terrain":
      return { title: "No land in this block", body: "More than half of it is open water, so there is no terrain to score. Click somewhere on land." };
    case "paused":
      return { title: "Live scoring is paused", body: "New places can't be scored right now. The check sites and every block scored before still open." };
    case "network":
      return { title: "Live scoring is paused", body: "New places can't be scored right now. The check sites and every block scored before still open." };
    case "busy":
    case "rate_limited":
      return { title: "The service is busy", body: "Too many blocks are being scored at once. Wait a few seconds and click again." };
    case "dem_read_failed":
      return { title: "Elevation data did not load", body: "The elevation source did not answer. Try again in a moment." };
    case "not_scorable":
      return { title: "Only Earth is scored live", body: "Moon and Mars blocks are fixed targets. Click Earth to score a place." };
    default:
      return { title: "Something went wrong", body: e instanceof Error ? e.message : "The block could not be scored." };
  }
}
