"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useExplore } from "@/components/explore/explore-context";
import { describeError } from "@/lib/api";
import { useScore, useTargets } from "@/lib/queries";
import { CHECK_SITES } from "@/lib/sites";
import { CannotCopy } from "./cannot-copy";
import { ContributionBars } from "./contribution-bars";
import { FactsTable } from "./facts-table";
import { ScoreGauge, type Mode } from "./score-gauge";
import { Section } from "./section";

function Notice({ title, children, alert }: { title: string; children: React.ReactNode; alert?: boolean }) {
  return (
    <p role={alert ? "alert" : "note"} className="mt-3 rounded-md border border-line bg-raised px-3 py-2 text-xs">
      <b className="block font-semibold">{title}</b>
      <span className="text-text-2">{children}</span>
    </p>
  );
}

// the right-hand panel for one scored block
export function SiteResult() {
  const { tileId } = useParams<{ tileId: string }>();
  const { selected, targetId } = useExplore();
  const earth = selected?.world === "earth";
  const q = useScore(earth ? selected.id : null, targetId);
  const target = useTargets().data?.find((t) => t.id === targetId);
  const site = CHECK_SITES.find((s) => s.tileId === selected?.id);
  // which score is the headline, both stay on screen
  const [mode, setMode] = useState<Mode>("ml");
  const r = q.data;

  return (
    <aside aria-label="Result" className="flex min-h-0 flex-col border-l border-line bg-panel max-md:border-t max-md:border-l-0">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="border-b border-line p-4">
          <Link href="/" className="text-xs text-text-2 hover:text-text">
            ← Back to the globe
          </Link>
          <h1 className="mt-2 text-xl leading-tight font-semibold">{site?.name ?? "Clicked block"}</h1>
          {site && <p className="text-text-2">{site.region}</p>}
          {selected && <FactsTable tile={selected} target={target} result={r} />}

          {!selected && (
            <Notice alert title="This is not a block">
              {decodeURIComponent(tileId)} is not a valid block id. Go back and click the globe.
            </Notice>
          )}
          {selected && !earth && (
            <Notice alert title="Only Earth is scored live">
              Moon and Mars blocks are fixed targets. Click Earth to score a place.
            </Notice>
          )}
          {earth && q.isError && (
            <Notice alert title={describeError(q.error).title}>
              {describeError(q.error).body}
            </Notice>
          )}
          {r?.confidence === "lower" && (
            <Notice title="Lower confidence">Part of this block has no elevation data, such as open water. The score uses the rest.</Notice>
          )}
          {r?.confidence === "coarse" && (
            <Notice title="Coarse elevation data">The only elevation data here is coarser than usual, so the fine roughness is less certain.</Notice>
          )}
          {r?.ood && (
            <Notice title="Outside what the model has seen">No training block resembles this one, so treat the score as a rough guide.</Notice>
          )}
        </div>

        {earth && q.isPending && (
          <div role="status" aria-live="polite" className="p-4">
            <b className="block font-semibold">Scoring this block{target ? ` against ${target.name}` : ""}</b>
            <span className="text-text-2">Reading 30 m elevation. A new place takes 2 to 5 seconds; a place scored before opens at once.</span>
            <Skeleton className="mt-4 h-9 w-2/3" />
            <Skeleton className="mt-2 h-4" />
            <Skeleton className="mt-2 h-4 w-1/2" />
          </div>
        )}

        {r && (
          <>
            <Section title="Analog score">
              <ToggleGroup
                type="single"
                size="sm"
                variant="outline"
                spacing={0}
                aria-label="Score shown"
                value={mode}
                onValueChange={(m) => m && setMode(m as Mode)}
              >
                <ToggleGroupItem value="ml">Trained model</ToggleGroupItem>
                <ToggleGroupItem value="phys">Physics baseline</ToggleGroupItem>
              </ToggleGroup>
              <ScoreGauge result={r} mode={mode} />
            </Section>
            <Section title="Why this score" note={mode === "ml" ? "points toward the score" : "block against target"}>
              <ContributionBars result={r} mode={mode} />
            </Section>
            {target && (
              <Section title="What no Earth site can copy" open={false}>
                <CannotCopy world={target.world} />
              </Section>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
