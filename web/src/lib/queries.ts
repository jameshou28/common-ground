import { queryOptions, useQueries, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { type Alignment, alignBlock } from "./align";
import { ApiError, cachedScore, fetchGrid, getTargets, library, score } from "./api";
import { env } from "./env";
import { BLOCK_M, type Grid } from "./grid";

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

// several blocks at once, for the check-site rank strip
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

// the matched block lined up with the clicked one for display: read with 2 km of margin, then the best turn and shift
// of that margin. until the earth grid is in, or with an api that sends no margin, it's the block as the model cut it
export function useAlignedLibraryGrid(index: number | null | undefined, block: Grid | undefined): { grid?: Grid; alignment: Alignment | null } {
  const lib = useQuery(
    queryOptions({
      queryKey: ["library", env.modelVersion, index, "pad"],
      queryFn: ({ signal }) => library(index!, signal, true),
      enabled: index != null,
      retry: retryOnce,
    }),
  );
  const padded = useGrid(lib.data?.grid_url).data;
  const pad = lib.data?.pad_px ?? 0;
  const alignment = useMemo(() => (padded && block && pad > 0 ? alignBlock(block, padded, pad) : null), [padded, block, pad]);
  if (!padded) return { grid: undefined, alignment: null };
  if (pad === 0) return { grid: padded, alignment: null };
  return { grid: alignment?.grid ?? centre(padded, pad), alignment };
}

// the block as the model cut it, out of a padded grid
function centre(g: Grid, pad: number): Grid {
  const k = g.n - 2 * pad;
  const z = new Float32Array(k * k);
  let lo = Infinity;
  let hi = -Infinity;
  for (let r = 0; r < k; r++)
    for (let c = 0; c < k; c++) {
      const v = g.z[(r + pad) * g.n + c + pad];
      z[r * k + c] = v;
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
  return { n: k, cellM: BLOCK_M / k, lo, hi, z };
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
