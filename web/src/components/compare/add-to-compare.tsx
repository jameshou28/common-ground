"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { compareHref, compareStore, MAX_COMPARE, parseTiles } from "@/lib/compare";

// puts a block on the compare list, then turns into the way there
export function AddToCompare({ tileId, tab }: { tileId: string; tab: string }) {
  const list = parseTiles(useSyncExternalStore(compareStore.subscribe, compareStore.read, () => ""));
  if (list.includes(tileId))
    return (
      <Link href={compareHref(list, tab)} className={buttonVariants({ size: "sm" })}>
        ✓ In compare · open
      </Link>
    );
  return (
    // a fifth block pushes out the oldest
    <Button size="sm" onClick={() => compareStore.write([...list, tileId].slice(-MAX_COMPARE))}>
      Add to compare
    </Button>
  );
}
