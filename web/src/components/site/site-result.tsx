"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AddToCompare } from "@/components/compare/add-to-compare";
import { useExplore } from "@/components/explore/explore-context";
import { WORLD_LABEL } from "@/components/globe/config";
import { describeError } from "@/lib/api";
import { env } from "@/lib/env";
import { bars, conditionLabel, contributionLabel } from "@/lib/regions";
import { CHECK_SITES } from "@/lib/sites";
import { ChartsDialog } from "./charts-dialog";
import { ContributionBars } from "./contribution-bars";
import { FactsTable } from "./facts-table";
import { ExportMenu } from "./export-menu";
import { ScoreGauge } from "./score-gauge";
import { ScoreLoader } from "./score-loader";
import { Section } from "./section";
import { useMatch } from "./use-match";

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
  const { selected, capture } = useExplore();
  const earth = selected?.world === "earth";
  const { q, match } = useMatch(selected);
  const site = CHECK_SITES.find((s) => s.tileId === selected?.id);
  const name = site?.name ?? "This block";
  const r = q.data;
  const terrain = match ? bars(match.site.contributions, contributionLabel) : null;
  const surface = r ? bars(r.conditions.terms, conditionLabel) : null;

  return (
    <aside aria-label="Result" className="flex min-h-0 flex-col border-l border-line bg-panel max-md:border-t max-md:border-l-0">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="border-b border-line p-4">
          <Link href="/" className="text-xs text-text-2 hover:text-text">
            ← Back to the globe
          </Link>
          <h1 className="mt-2 text-xl leading-tight font-semibold">{site?.name ?? "Clicked block"}</h1>
          {site && <p className="text-text-2">{site.region}</p>}
          {selected && <FactsTable tile={selected} match={match} />}

          {!selected && (
            <Notice alert title="That isn't a block">
              {decodeURIComponent(tileId)} isn&apos;t a valid block id. Go back and click the globe.
            </Notice>
          )}
          {selected && !earth && (
            <Notice alert title="Only Earth is scored live">
              Click a place on Earth to score it.
            </Notice>
          )}
          {!env.liveScoring && !r && earth && !q.isError && (
            <Notice title="Live scoring is paused">Right now only places scored before will open. The check sites still work.</Notice>
          )}
          {earth && q.isError && (
            <Notice alert title={describeError(q.error).title}>
              {describeError(q.error).body}
            </Notice>
          )}
          {r?.ood && (
            <Notice title="Unlike anything the model has seen">No block the model learned from looks like this one, so take the score as a rough guide.</Notice>
          )}
        </div>

        {earth && q.isPending && (
          <div className="p-4">
            <ScoreLoader name={site?.name ?? "New place"} />
          </div>
        )}

        {r && match && (
          <>
            <Section title="Analog score" note={`best region: ${match.world.regions.find((g) => g.region === match.world.best_region)?.title ?? ""}`}>
              <ScoreGauge result={r} match={match} />
              <ChartsDialog gridUrl={r.grid_url} libraryIndex={match.site.index} name={name} matchName={match.site.name} />
            </Section>
            <Section title={`Why it matches ${match.region.title.toLowerCase()}`} note={`closest place ${Math.round(match.site.pair_score)}`}>
              <ContributionBars rows={terrain!.rows} zero={terrain!.zero} note={`Measured against ${match.site.name}. Bars to the right help the match.`} />
            </Section>
            <Section title="Surface and climate" note="the same for both worlds">
              <ContributionBars rows={surface!.rows} zero={surface!.zero} note="Bare, dry ground helps. Trees, fields and water hurt." />
            </Section>
          </>
        )}
      </div>
      {earth && r && match && (
        <div className="flex gap-2 border-t border-line p-3">
          <AddToCompare tileId={selected.id} tab={match.tab} />
          <ExportMenu tile={selected} name={site?.name ?? "Clicked block"} result={r} match={match} capture={capture} />
          <span className="sr-only">Showing the {WORLD_LABEL[match.tab]} result</span>
        </div>
      )}
    </aside>
  );
}
