"use client";

import { useRouter } from "next/navigation";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { WORLDS, type World } from "@/lib/tiles";
import { WORLD_LABEL } from "./config";

export function WorldSwitcher({ world }: { world: World }) {
  const router = useRouter();
  return (
    <ToggleGroup
      type="single"
      size="sm"
      variant="outline"
      spacing={0}
      aria-label="World"
      value={world}
      // radix sends "" when the active item is pressed again
      onValueChange={(w) => w && router.push(w === "earth" ? "/" : `/?world=${w}`)}
      className="absolute top-3 left-3 z-10 bg-panel"
    >
      {WORLDS.map((w) => (
        <ToggleGroupItem key={w} value={w}>
          {WORLD_LABEL[w]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
