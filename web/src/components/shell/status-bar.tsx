"use client";

import { createPortal } from "react-dom";
import { useSyncExternalStore } from "react";
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
      <span className={env.liveScoring ? "whitespace-nowrap text-help" : "whitespace-nowrap text-warn"}>
        {env.liveScoring ? "Live scoring on" : "Live scoring paused"}
      </span>
    </footer>
  );
}
