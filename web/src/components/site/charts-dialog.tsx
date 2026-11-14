"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useGrid, useLibraryGrid } from "@/lib/queries";
import { SLOPE_BIN_DEG, slopeHistogram } from "@/lib/terrain";

const TICK = { fill: "var(--text-2)", fontSize: 11 };

// slope histograms of the block and its closest match
export function ChartsDialog({ gridUrl, libraryIndex, name, matchName }: { gridUrl: string; libraryIndex: number; name: string; matchName: string }) {
  return (
    <Dialog>
      <DialogTrigger className="mt-4 flex w-full items-center justify-between gap-3 rounded-md border border-line px-3 py-2 text-left hover:bg-hover">
        <span>
          Slopes
          <span className="block text-xs text-text-2">How steep this block is next to its closest match</span>
        </span>
        <span aria-hidden className="text-text-2">
          Open →
        </span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Slopes in both blocks</DialogTitle>
          <DialogDescription>Share of each block in every {SLOPE_BIN_DEG}° band of slope. Both are 4 km across and measured on the same 128 by 128 grid.</DialogDescription>
        </DialogHeader>
        <Histogram gridUrl={gridUrl} libraryIndex={libraryIndex} name={name} matchName={matchName} />
      </DialogContent>
    </Dialog>
  );
}

// mounted only while the dialog is open, so the grids load on demand
function Histogram({ gridUrl, libraryIndex, name, matchName }: { gridUrl: string; libraryIndex: number; name: string; matchName: string }) {
  const block = useGrid(gridUrl);
  const over = useLibraryGrid(libraryIndex);
  if (block.isError || over.isError)
    return (
      <p role="alert" className="text-xs text-text-2">
        {block.isError ? "This block's" : "The match's"} height grid didn&apos;t load, so there&apos;s nothing to draw.
      </p>
    );
  if (!block.data || !over.data) return <Skeleton className="h-64" />;
  const [a, b] = [slopeHistogram(block.data), slopeHistogram(over.data)];
  const data = a.map((v, i) => ({ band: `${i * SLOPE_BIN_DEG}° to ${(i + 1) * SLOPE_BIN_DEG}°`, mid: i * SLOPE_BIN_DEG + SLOPE_BIN_DEG / 2, block: v * 100, match: b[i] * 100 }));
  return (
    <div className="h-64">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} accessibilityLayer>
          <CartesianGrid stroke="var(--line-2)" vertical={false} />
          <XAxis dataKey="mid" type="number" domain={[0, 48]} ticks={[0, 12, 24, 36, 48]} unit="°" tick={TICK} stroke="var(--line)" />
          <YAxis unit="%" tick={TICK} stroke="var(--line)" />
          <Tooltip
            contentStyle={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 6, fontSize: 12 }}
            labelFormatter={(_, rows) => `Slope ${rows[0]?.payload?.band ?? ""}`}
            formatter={(v) => `${Number(v).toFixed(1)}%`}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line name={name} dataKey="block" stroke="var(--s1)" strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line name={matchName} dataKey="match" stroke="var(--text)" strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
