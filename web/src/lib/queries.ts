import { queryOptions, useQueries, useQuery } from "@tanstack/react-query";
import { ApiError, cachedScore, fetchGrid, getTargets, library, score } from "./api";
import { env } from "./env";

// only transient failures are worth a second try
const retryOnce = (count: number, e: Error) => count < 1 && e instanceof ApiError && (e.code === "network" || e.code === "busy");

export function useTargets() {
  return useQuery({ queryKey: ["targets"], queryFn: () => getTargets(), retry: retryOnce });
}

// a score is fixed by tile and model version, so cache it for the session
const scoreQuery = (tileId: string | null) =>
  queryOptions({
    queryKey: ["score", env.modelVersion, tileId],
    // a block scored before comes from supabase without waking the api
    queryFn: async ({ signal }) => (await cachedScore(tileId!, signal)) ?? score(tileId!, signal),
    enabled: !!tileId,
    retry: retryOnce,
  });

export function useScore(tileId: string | null) {
  return useQuery(scoreQuery(tileId));
}

// several blocks at once, for the compare page and the rank strip
export function useTileScores(tileIds: string[]) {
  return useQueries({ queries: tileIds.map((id) => scoreQuery(id)) });
}

const libraryQuery = (index: number | null | undefined) =>
  queryOptions({
    queryKey: ["library", env.modelVersion, index],
    queryFn: ({ signal }) => library(index!, signal),
    enabled: index != null,
    retry: retryOnce,
  });

// the height grid of a matched moon or mars block, undefined until it has loaded
export function useLibraryGrid(index: number | null | undefined) {
  return useGrid(useQuery(libraryQuery(index)).data?.grid_url);
}

export function useLibraryGrids(indexes: (number | null | undefined)[]) {
  const blocks = useQueries({ queries: indexes.map((i) => libraryQuery(i)) });
  return useGrids(blocks.map((b) => b.data?.grid_url));
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
