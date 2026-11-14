"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { cameraLink } from "@/components/grid/grid-block";
import { targetGridUrl } from "@/components/site/target-block";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { describeError } from "@/lib/api";
import { compareHref, compareStore, MAX_COMPARE, parseTiles } from "@/lib/compare";
import type { Grid } from "@/lib/grid";
import { useGrid, useGrids, useTargets, useTileScores } from "@/lib/queries";
import { CHECK_SITES, siteHref } from "@/lib/sites";
import { MeasurementTable } from "./measurement-table";
import { RankStrip } from "./rank-strip";
import { SlopeChart, type Series } from "./slope-chart";

const GridBlock = dynamic(() => import("@/components/grid/grid-block"), { ssr: false });

const COLORS = ["var(--s1)", "var(--s2)", "var(--s3)", "var(--s4)"];
const nameOf = (tileId: string) => CHECK_SITES.find((s) => s.tileId === tileId)?.name ?? tileId.replace(/^earth:/, "");
const span = (g: Grid) => Math.max(g.hi - g.lo, 1e-6);

// up to four earth blocks and the target side by side, one camera for all
export function CompareView() {
  const search = useSearchParams();
  const router = useRouter();
  const raw = search.get("tiles");
  const tiles = useMemo(() => parseTiles(raw), [raw]);
  const targets = useTargets();
  const targetId = search.get("target") ?? targets.data?.[0]?.id ?? null;
  const target = targets.data?.find((t) => t.id === targetId);
  const scores = useTileScores(tiles, targetId);
  const grids = useGrids(scores.map((q) => q.data?.grid_url));
  const targetGrid = useGrid(targetGridUrl(target)).data;
  const [relief, setRelief] = useState(1);
  const [equal, setEqual] = useState(false);
  const [wire, setWire] = useState(false);
  const [link] = useState(cameraLink);

  // the stored list follows the url, so a block added from a result page appends to what is shown
  useEffect(() => compareStore.write(tiles), [tiles]);
  const go = (next: string[], t = targetId) => router.replace(compareHref(next, t), { scroll: false });

  // equal relief stretches every block to the tallest one's height range
  const loaded = [...grids.flatMap((q) => (q.data ? [q.data] : [])), ...(targetGrid ? [targetGrid] : [])];
  const tallest = Math.max(...loaded.map(span), 1e-6);
  const scale = (g: Grid) => relief * (equal ? tallest / span(g) : 1);

  const blocks = tiles.flatMap((id, i) => (scores[i].data ? [{ name: nameOf(id), result: scores[i].data }] : []));
  const series: Series[] = [
    ...tiles.flatMap((id, i) => (grids[i].data ? [{ name: nameOf(id), color: COLORS[i], grid: grids[i].data }] : [])),
    ...(targetGrid && target ? [{ name: target.name, color: "var(--text)", grid: targetGrid, dashed: true }] : []),
  ];
  const spare = CHECK_SITES.filter((s) => !tiles.includes(s.tileId));

  return (
    <main className="flex-1 overflow-y-auto p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="text-xl leading-tight font-semibold">Compare</h1>
        <ToggleGroup type="single" size="sm" variant="outline" spacing={0} aria-label="Target" value={targetId ?? ""} onValueChange={(t) => t && go(tiles, t)}>
          {(targets.data ?? []).map((t) => (
            <ToggleGroupItem key={t.id} value={t.id}>
              {t.name}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <div role="toolbar" aria-label="Block view" className="ml-auto flex items-center gap-2 text-xs">
          <span id="cmp-relief" className="text-text-2">
            Relief
          </span>
          <ToggleGroup type="single" size="sm" spacing={0} aria-labelledby="cmp-relief" value={String(relief)} onValueChange={(r) => r && setRelief(Number(r))}>
            {[1, 2, 3].map((r) => (
              <ToggleGroupItem key={r} value={String(r)}>
                {r}×
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Toggle size="sm" pressed={equal} onPressedChange={setEqual}>
            Equal relief
          </Toggle>
          <Toggle size="sm" pressed={wire} onPressedChange={setWire} disabled={!targetGrid}>
            Target as wireframe
          </Toggle>
        </div>
      </div>

      {!tiles.length && (
        <p className="mt-4 max-w-prose text-text-2">
          Nothing to compare yet. Open a block on the globe and choose Add to compare, or start with the check sites below. Up to {MAX_COMPARE} blocks fit, and the link to this page reproduces the view.
        </p>
      )}

      <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
        {tiles.map((id, i) => {
          const [q, g] = [scores[i], grids[i]];
          return (
            <figure key={id} className="relative h-72 overflow-hidden rounded-md border border-line bg-space">
              {g.data && (
                <GridBlock
                  grid={g.data}
                  relief={scale(g.data)}
                  tone="earth"
                  link={link}
                  wire={wire && targetGrid ? { grid: targetGrid, scale: scale(targetGrid) } : undefined}
                  label={`${nameOf(id)} as a 4 km block of terrain`}
                />
              )}
              {!g.data && !q.isError && !g.isError && <Skeleton className="absolute inset-8" />}
              {(q.isError || g.isError) && (
                <p role="alert" className="absolute inset-x-2 top-12 text-xs">
                  <b className="block font-semibold">{q.isError ? describeError(q.error).title : "The height grid did not load"}</b>
                  <span className="text-text-2">{q.isError ? describeError(q.error).body : "The score is unaffected."}</span>
                </p>
              )}
              <figcaption className="absolute inset-x-2 top-2 flex items-center gap-2 rounded-md border border-line bg-panel py-1 pr-1 pl-2 text-xs">
                <i className="h-0.5 w-3 shrink-0" style={{ background: COLORS[i] }} />
                <Link href={siteHref(id, targetId)} className="min-w-0 flex-1 truncate">
                  {nameOf(id)}
                </Link>
                {q.data && <b className="font-semibold">{Math.round(q.data.score)}</b>}
                <Button size="icon-xs" variant="ghost" aria-label={`Remove ${nameOf(id)}`} onClick={() => go(tiles.filter((t) => t !== id))}>
                  ×
                </Button>
              </figcaption>
            </figure>
          );
        })}
        {target && (
          <figure className="relative h-72 overflow-hidden rounded-md border border-line bg-space">
            {targetGrid ? <GridBlock grid={targetGrid} relief={scale(targetGrid)} tone={target.world} link={link} label={`${target.name} as a 4 km block of terrain`} /> : <Skeleton className="absolute inset-8" />}
            <figcaption className="absolute inset-x-2 top-2 flex items-center gap-2 rounded-md border border-line bg-panel px-2 py-1.5 text-xs">
              <i className="h-0 w-3 shrink-0 border-t-2 border-dashed border-text" />
              <span className="min-w-0 flex-1 truncate">{target.name}</span>
              <span className="text-text-2">Target</span>
            </figcaption>
          </figure>
        )}
      </div>

      {tiles.length < MAX_COMPARE && spare.length > 0 && (
        <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="mr-1 text-text-2">Add a check site</span>
          {spare.map((s) => (
            <Button key={s.id} size="xs" variant="outline" onClick={() => go([...tiles, s.tileId])}>
              {s.name}
            </Button>
          ))}
        </p>
      )}

      {series.length > 0 && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section aria-labelledby="slope-h">
            <h2 id="slope-h" className="font-semibold">
              Slopes
            </h2>
            <p className="mt-1 text-xs text-text-2">Share of each block gentler than a given slope. A curve that rises early is a flat place.</p>
            <SlopeChart series={series} />
          </section>
          {blocks.length > 0 && target && (
            <section aria-labelledby="meas-h">
              <h2 id="meas-h" className="font-semibold">
                Measurements
              </h2>
              <MeasurementTable blocks={blocks} targetName={target.name} />
            </section>
          )}
        </div>
      )}

      <div className="mt-6">
        <RankStrip targetId={targetId} />
      </div>
    </main>
  );
}
