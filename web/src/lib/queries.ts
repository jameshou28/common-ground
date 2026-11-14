import { queryOptions, useQueries, useQuery } from "@tanstack/react-query";
import { ApiError, cachedScore, fetchGrid, getTargets, score } from "./api";
import { env } from "./env";

// only transient failures are worth a second try
const retryOnce = (count: number, e: Error) => count < 1 && e instanceof ApiError && (e.code === "network" || e.code === "busy");

export function useTargets() {
  return useQuery({ queryKey: ["targets"], queryFn: () => getTargets(), retry: retryOnce });
}

// a score is fixed by tile, target and model version, so cache it for the session
const scoreQuery = (tileId: string | null, targetId: string | null) =>
  queryOptions({
    queryKey: ["score", env.modelVersion, tileId, targetId],
    // a block scored before comes from supabase without waking the api
    queryFn: async ({ signal }) => (await cachedScore(tileId!, targetId!, signal)) ?? score(tileId!, targetId!, signal),
    enabled: !!tileId && !!targetId,
    retry: retryOnce,
  });

export function useScore(tileId: string | null, targetId: string | null) {
  return useQuery(scoreQuery(tileId, targetId));
}

// one block against several targets at once, sharing the cache with useScore
export function useScores(tileId: string | null, targetIds: string[]) {
  return useQueries({ queries: targetIds.map((id) => scoreQuery(tileId, id)) });
}

// several blocks against one target, for the compare page and the rank strip
export function useTileScores(tileIds: string[], targetId: string | null) {
  return useQueries({ queries: tileIds.map((id) => scoreQuery(id, targetId)) });
}

export function useGrid(url: string | null | undefined) {
  return useQuery({
    queryKey: ["grid", url],
    queryFn: ({ signal }) => fetchGrid(url!, signal),
    enabled: !!url,
  });
}

// several grids at once, a missing url stays idle
export function useGrids(urls: (string | null | undefined)[]) {
  return useQueries({
    queries: urls.map((url) => ({ queryKey: ["grid", url], queryFn: ({ signal }: { signal: AbortSignal }) => fetchGrid(url!, signal), enabled: !!url })),
  });
}
