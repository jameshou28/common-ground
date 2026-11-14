"use client";

import { createPortal } from "react-dom";
import { useSyncExternalStore } from "react";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { env } from "@/lib/env";

export const STATUS_SLOT = "status-slot";
const subscribe = () => () => {};

// pages add readouts to the bar through this
export function StatusItems({ children }: { children: React.ReactNode }) {
  const target = useSyncExternalStore(
    subscribe,
    () => document.getElementById(STATUS_SLOT),
    () => null,
  );
  return target ? createPortal(children, target) : null;
}

export function StatusBar() {
  return (
    <footer className="flex h-[26px] shrink-0 items-center gap-4 border-t border-line bg-panel px-3.5 text-xs text-text-2">
      <div id={STATUS_SLOT} className="flex min-w-0 items-center gap-4 overflow-hidden whitespace-nowrap" />
      <span className="ml-auto whitespace-nowrap">Model {env.modelVersion}</span>
      <LiveScoring />
    </footer>
  );
}

// paused when switched off, or when the last score request could not reach the api
function LiveScoring() {
  const client = useQueryClient();
  useIsFetching();
  const down = client
    .getQueryCache()
    .findAll({ queryKey: ["score"] })
    .sort((a, b) => Math.max(b.state.dataUpdatedAt, b.state.errorUpdatedAt) - Math.max(a.state.dataUpdatedAt, a.state.errorUpdatedAt))[0]?.state;
  const unreachable = down?.status === "error" && down.error instanceof ApiError && down.error.code === "network";
  const on = env.liveScoring && !unreachable;
  return <span className={on ? "whitespace-nowrap text-help" : "whitespace-nowrap text-warn"}>{on ? "Live scoring on" : "Live scoring paused"}</span>;
}
