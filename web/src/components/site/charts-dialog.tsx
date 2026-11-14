"use client";

import { CartesianGrid, Legend, Line, LineChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { BlockResult, Target } from "@/lib/api";
import { RADAR_CAP, radarRows } from "@/lib/contributions";
import { fmtValue } from "@/lib/format";
import { useGrid } from "@/lib/queries";
import { SLOPE_BIN_DEG, slopeHistogram } from "@/lib/terrain";
import { targetGridUrl } from "./target-block";

const TIP = { background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 6, fontSize: 12 };
const TICK = { fill: "var(--text-2)", fontSize: 11 };

// slope histograms of both grids and a radar of five measurements, block against target
export function ChartsDialog({ result, target, name }: { result: BlockResult; target: Target; name: string }) {
  return (
    <Dialog>
      <DialogTrigger className="mt-4 flex w-full items-center justify-between gap-3 rounded-md border border-line px-3 py-2 text-left hover:bg-hover">
        <span>
          Charts
          <span className="block text-xs text-text-2">Slope histograms and a five-measurement radar, block against target</span>
        </span>
        <span aria-hidden className="text-text-2">
          Open →
        </span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {name} against {target.name}
          </DialogTitle>
          <DialogDescription>Both blocks are 4 km across and measured on the same 128 by 128 grid.</DialogDescription>
        </DialogHeader>
        <Charts result={result} target={target} name={name} />
      </DialogContent>
    </Dialog>
  );
}

// mounted only while the dialog is open, so the grids load on demand
function Charts({ result, target, name }: { result: BlockResult; target: Target; name: string }) {
  const block = useGrid(result.grid_url);
  const over = useGrid(targetGridUrl(target));
  const radar = radarRows(result.contributions);
  const hist =
    block.data && over.data
      ? (() => {
          const [a, b] = [slopeHistogram(block.data), slopeHistogram(over.data)];
          return a.map((v, i) => ({ band: `${i * SLOPE_BIN_DEG}° to ${(i + 1) * SLOPE_BIN_DEG}°`, mid: i * SLOPE_BIN_DEG + SLOPE_BIN_DEG / 2, block: v * 100, target: b[i] * 100 }));
        })()
      : null;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section>
        <h3 className="font-semibold">Slope histogram</h3>
        <p className="text-xs text-text-2">Share of each block in every {SLOPE_BIN_DEG}° band of slope.</p>
        <div className="mt-2 h-64">
          {hist ? (
            <ResponsiveContainer>
              <LineChart data={hist} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} accessibilityLayer>
                <CartesianGrid stroke="var(--line-2)" vertical={false} />
                <XAxis dataKey="mid" type="number" domain={[0, 48]} ticks={[0, 12, 24, 36, 48]} unit="°" tick={TICK} stroke="var(--line)" />
                <YAxis unit="%" tick={TICK} stroke="var(--line)" />
                <Tooltip
                  contentStyle={TIP}
                  labelFormatter={(_, rows) => `Slope ${rows[0]?.payload?.band ?? ""}`}
                  formatter={(v) => `${Number(v).toFixed(1)}%`}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line name={name} dataKey="block" stroke="var(--s1)" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line name={target.name} dataKey="target" stroke="var(--text)" strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : block.isError || over.isError ? (
            <p role="alert" className="text-xs text-text-2">
              {block.isError ? "This block's" : "The target's"} height grid is missing from the grid store, so the histogram cannot be drawn.
            </p>
          ) : (
            <Skeleton className="size-full" />
          )}
        </div>
      </section>
      <section>
        <h3 className="font-semibold">Five measurements</h3>
        <p className="text-xs text-text-2">Each spoke is the block&apos;s value as a multiple of the target&apos;s. The dashed ring is the target.</p>
        <div className="mt-2 h-64">
          <ResponsiveContainer>
            <RadarChart data={radar} outerRadius="68%" accessibilityLayer>
              <PolarGrid stroke="var(--line)" />
              <PolarAngleAxis dataKey="label" tick={TICK} />
              <PolarRadiusAxis domain={[0, RADAR_CAP]} tick={false} axisLine={false} />
              <Tooltip
                contentStyle={TIP}
                formatter={(_, key, item) => {
                  const r = item.payload as (typeof radar)[number];
                  return key === "ring" ? [fmtValue(r.target, r.unit), target.name] : [`${fmtValue(r.value, r.unit)}, ${r.ratio.toFixed(2)} × the target`, name];
                }}
              />
              <Radar dataKey="ring" stroke="var(--text)" strokeWidth={2} strokeDasharray="5 4" fill="none" isAnimationActive={false} />
              <Radar dataKey="shown" stroke="var(--s1)" strokeWidth={2} fill="var(--s1)" fillOpacity={0.18} isAnimationActive={false} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
