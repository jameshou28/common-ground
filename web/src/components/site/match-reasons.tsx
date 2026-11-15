"use client";

import { useState } from "react";
import { WORLD_LABEL } from "@/components/globe/config";
import type { BreakdownContext, Landform, Match } from "@/lib/regions";
import { bars, breakdownOf, contributionLabel, landformPlural } from "@/lib/regions";
import { BreakdownBars, ContributionBars } from "./contribution-bars";

type View = "region" | "feature" | "site";

// "why it matches": how the region score, the feature score and the closest place's score add up
export function MatchReasons({ match, landform }: { match: Match; landform: Landform | null }) {
  const regionBd = breakdownOf(match.region);
  const featureBd = landform ? breakdownOf(landform) : null;
  const siteBd = breakdownOf(match.site);
  const region = match.region.title.toLowerCase();
  const world = WORLD_LABEL[match.tab];
  const regionPct = typeof match.region.earth_percentile === "number" ? match.region.earth_percentile : null;
  // the region's earth factor applies to the region score and to its closest places, the feature has its own
  const regionCtx: BreakdownContext = { world, target: region, earthPercentile: regionPct };
  const featureCtx: BreakdownContext | null = landform
    ? { world, target: `${landformPlural(landform)} in ${region}`, earthPercentile: landform.earth_percentile ?? null }
    : null;
  const views: { id: View; label: string; score: number }[] = [
    ...(regionBd ? [{ id: "region" as const, label: "Region", score: match.region.score }] : []),
    ...(featureBd && landform ? [{ id: "feature" as const, label: "Feature", score: landform.score }] : []),
    { id: "site", label: "Closest place", score: match.site.pair_score },
  ];
  const [pick, setPick] = useState<View>("region");
  const view = views.find((v) => v.id === pick)?.id ?? views[0].id;

  return (
    <>
      {views.length > 1 && (
        <div role="group" aria-label="Which score to explain" className="mb-3 flex gap-1 rounded-md border border-line bg-raised p-0.5 text-xs">
          {views.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={view === v.id}
              onClick={() => setPick(v.id)}
              className={`flex-1 rounded px-2 py-1 ${view === v.id ? "bg-panel font-semibold text-text" : "text-text-2 hover:text-text"}`}
            >
              {v.label} <span className="font-normal">{Math.round(v.score)}</span>
            </button>
          ))}
        </div>
      )}
      {view === "region" && regionBd && (
        <BreakdownBars breakdown={regionBd} context={regionCtx} total="Region score" note={
            regionBd.kind === "head"
              ? `How the region score adds up: each measurement next to verified analog sites and ordinary land, then how well the ground matches ${region}. Bars to the right add points.`
              : `How the region score adds up, over the blocks of ${region} that match best. Bars to the right add points.`
          } />
      )}
      {view === "feature" && featureBd && landform && (
        <BreakdownBars
          breakdown={featureBd}
          context={featureCtx!}
          total="Feature score"
          note={
            featureBd.kind === "head"
              ? `How the feature score adds up: each measurement next to verified analog sites and ordinary land, then how well the ground matches the ${landformPlural(landform)} in ${region}. Bars to the right add points.`
              : `How the feature score adds up, over the ${landformPlural(landform)} in ${region} that match best. Bars to the right add points.`
          }
        />
      )}
      {view === "site" &&
        (siteBd ? (
          <BreakdownBars breakdown={siteBd} context={regionCtx} total="Closest place" note={`Against ${match.site.name} alone. Bars to the right add points.`} />
        ) : (
          <ContributionBars {...bars(match.site.contributions, contributionLabel)} note={`Measured against ${match.site.name}. Bars to the right help the match.`} />
        ))}
    </>
  );
}
