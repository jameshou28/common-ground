"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useExplore } from "@/components/explore/explore-context";
import { WORLD_LABEL } from "@/components/globe/config";
import { ApiError, describeError } from "@/lib/api";
import { env } from "@/lib/env";
import { bars, conditionLabel, landformOf, landformPlural } from "@/lib/regions";
import { placeNear } from "@/lib/places";
import { isLandCell } from "@/lib/land-mask";
import { useAlignedLibraryGrid, useGrid } from "@/lib/queries";
import { CHECK_SITES } from "@/lib/sites";
import { ChartsDialog } from "./charts-dialog";
import { ContributionBars } from "./contribution-bars";
import { FactsTable } from "./facts-table";
import { ExportMenu } from "./export-menu";
import { MatchReasons } from "./match-reasons";
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

// longest the loader waits for the height grids once the score is in
const WAIT_MS = 5000;

// the right-hand panel for one scored block
export function SiteResult() {
  const { tileId } = useParams<{ tileId: string }>();
  const { selected, capture } = useExplore();
  const earth = selected?.world === "earth";
  const { q, match } = useMatch(selected);
  const site = CHECK_SITES.find((s) => s.tileId === selected?.id);
  // a moon or mars landmark opened from its pin
  const place = selected && !earth ? placeNear(selected.world, selected.center.lat, selected.center.lon) : undefined;
  const name = site?.name ?? "This block";
  const r = q.data;
  const surface = r ? bars(r.conditions.terms, conditionLabel) : null;
  // keep the loader up until the 3d side is ready too (the block's grid and the lined-up match), so the panel and the
  // view appear together; at most WAIT_MS after the score. the queries are shared with the globe, so nothing loads twice
  const blockGrid = useGrid(r?.grid_url).data;
  const { grid: matchedGrid } = useAlignedLibraryGrid(match?.site.index, blockGrid);
  const [waitedFor, setWaitedFor] = useState<string | null>(null);
  useEffect(() => {
    if (!r || !selected) return;
    const id = selected.id;
    const t = setTimeout(() => setWaitedFor(id), WAIT_MS);
    return () => clearTimeout(t);
  }, [r, selected]);
  // water: open sea (no elevation tile) is never scored; a coastal block the api finds mostly water says no_terrain
  const water = earth && !!selected && (!isLandCell(selected.center.lat, selected.center.lon) || (q.error instanceof ApiError && q.error.code === "no_terrain"));
  const loading = earth && !water && (q.isPending || (!!r && !!match && !(blockGrid && matchedGrid) && waitedFor !== selected?.id));
  const landform = match ? landformOf(match.region) : null;
  // the selected region's overall; the api has it per region since v1.3
  const regionOverall = match ? (typeof match.region.overall === "number" ? match.region.overall : match.world.overall) : 0;

  return (
    <aside aria-label="Result" className="flex min-h-0 flex-col border-l border-line bg-panel max-md:border-t max-md:border-l-0">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="border-b border-line p-4">
          <Link href="/" className="text-xs text-text-2 hover:text-text">
            ← Back to the globe
          </Link>
          <div className="mt-2 flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-lg leading-tight font-semibold">{site?.name ?? place?.name ?? "Clicked block"}</h1>
              {site && <p className="mt-0.5 text-sm text-text-2">{site.region}</p>}
              {place && <p className="mt-0.5 text-sm text-text-2">{place.note}</p>}
            </div>
            {earth && r && match && (
              <>
                <ExportMenu tile={selected} name={site?.name ?? "Clicked block"} result={r} match={match} capture={capture} />
                <span className="sr-only">Showing the {WORLD_LABEL[match.tab]} result</span>
              </>
            )}
          </div>
          {selected && <FactsTable tile={selected} match={match} />}

          {!selected && (
            <Notice alert title="That isn't a block">
              {decodeURIComponent(tileId)} isn&apos;t a valid block id. Go back and click the globe.
            </Notice>
          )}
          {selected && !earth && (
            <Notice title={`${WORLD_LABEL[selected.world]} blocks are for reference`}>
              The model scores Earth blocks against regions of the Moon and Mars, so this block has no score of its own. To find Earth places like
              this terrain, open{" "}
              <Link href={`/best?tab=${selected.world}`} className="text-brand">
                Best sites
              </Link>{" "}
              or click Earth.
            </Notice>
          )}
          {!env.liveScoring && !r && earth && !q.isError && (
            <Notice title="Live scoring is paused">Right now only places scored before will open. The check sites still work.</Notice>
          )}
          {water && (
            <Notice title="Open water">
              The model only knows land, and nothing on the Moon or Mars looks like a sea or a lake, so water blocks aren&apos;t scored. Try a nearby coast or
              island.
            </Notice>
          )}
          {earth && q.isError && !water && (
            <Notice alert title={describeError(q.error).title}>
              {describeError(q.error).body}
            </Notice>
          )}
          {r?.ood && (
            <Notice title="Unlike anything the model has seen">No block the model learned from looks like this one, so take the score as a rough guide.</Notice>
          )}
        </div>

        {loading && (
          <div className="p-4">
            <ScoreLoader name={site?.name ?? "New place"} />
          </div>
        )}

        {r && match && !loading && (
          <>
            <Section title="Region score" note={match.region.region === match.world.best_region ? `best region: ${match.region.title}` : match.region.title}>
              <ScoreGauge
                overall={regionOverall}
                terrain={match.region.score}
                surface={r.conditions.score}
                standIn={`a ${WORLD_LABEL[match.tab]} stand-in`}
                terrainNote={`how the ground compares with ${match.region.title.toLowerCase()}`}
              />
            </Section>
            <Section title="Feature score" note={landform ? `${landform.label.toLowerCase()}${landform.validated ? "" : ", not validated yet"}` : "none for this region"}>
              {landform ? (
                <>
                  <ScoreGauge
                    overall={typeof landform.overall === "number" ? landform.overall : Math.sqrt(Math.max(landform.score, 0) * r.conditions.score)}
                    terrain={landform.score}
                    surface={r.conditions.score}
                    standIn={`${/^[aeiou]/i.test(landform.label) ? "an" : "a"} ${landform.label.toLowerCase()} stand-in`}
                    terrainNote={`how the ground compares with the ${landformPlural(landform)} in ${match.region.title.toLowerCase()}`}
                  />
                  {landform.badge ? (
                    <p className="mt-3 inline-block rounded-sm border border-help px-1.5 py-0.5 text-xs text-help">Checked feature match</p>
                  ) : (
                    !landform.validated && (
                      <p className="mt-3 text-xs text-text-2">The model can&apos;t yet reliably tell this feature apart from the rest of the region, so take it as a rough guide.</p>
                    )
                  )}
                </>
              ) : (
                <p className="text-xs text-text-2">The model has too few mapped features in {match.region.title.toLowerCase()} to score one.</p>
              )}
              <ChartsDialog gridUrl={r.grid_url} libraryIndex={match.site.index} name={name} matchName={match.site.name} />
            </Section>
            <Section title={`Why it matches ${match.region.title.toLowerCase()}`}>
              <MatchReasons key={`${match.tab}|${match.region.region}|${match.site.index}`} match={match} landform={landform} />
            </Section>
            <Section title="Surface and climate" note="the same for both worlds">
              <ContributionBars rows={surface!.rows} zero={surface!.zero} note="Bare, dry ground helps. Trees, fields and water hurt." />
            </Section>
          </>
        )}
      </div>
    </aside>
  );
}
