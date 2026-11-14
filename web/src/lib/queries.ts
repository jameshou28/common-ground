import { useQuery } from "@tanstack/react-query";
import { ApiError, fetchGrid, getTargets, score } from "./api";
import { env } from "./env";

// only transient failures are worth a second try
const retryOnce = (count: number, e: Error) => count < 1 && e instanceof ApiError && (e.code === "network" || e.code === "busy");

export function useTargets() {
  return useQuery({ queryKey: ["targets"], queryFn: () => getTargets(), retry: retryOnce });
}

// a score is fixed by tile, target and model version, so cache it for the session
export function useScore(tileId: string | null, targetId: string | null) {
  return useQuery({
    queryKey: ["score", env.modelVersion, tileId, targetId],
    queryFn: ({ signal }) => score(tileId!, targetId!, signal),
    enabled: !!tileId && !!targetId,
    retry: retryOnce,
  });
}

export function useGrid(url: string | null | undefined) {
  return useQuery({
    queryKey: ["grid", url],
    queryFn: ({ signal }) => fetchGrid(url!, signal),
    enabled: !!url,
  });
}
