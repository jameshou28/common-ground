"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Grid } from "@/lib/grid";
import { cumulativeSlope, SLOPE_BIN_DEG } from "@/lib/terrain";

export type Series = { name: string; color: string; grid: Grid; dashed?: boolean };

// share of each block gentler than a slope, a plain histogram is squashed by flat sites
export function SlopeChart({ series }: { series: Series[] }) {
  const curves = series.map((s) => cumulativeSlope(s.grid));
  const data = (curves[0] ?? []).map((_, i) => ({
    deg: (i + 1) * SLOPE_BIN_DEG,
    ...Object.fromEntries(series.map((s, k) => [s.name, curves[k][i] * 100])),
  }));
  return (
    <div className="h-64">
      <ResponsiveContainer>
        <LineChart data={[{ deg: 0, ...Object.fromEntries(series.map((s) => [s.name, 0])) }, ...data]} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} accessibilityLayer>
          <CartesianGrid stroke="var(--line-2)" vertical={false} />
          <XAxis dataKey="deg" type="number" domain={[0, 48]} ticks={[0, 12, 24, 36, 48]} unit="°" tick={{ fill: "var(--text-2)", fontSize: 11 }} stroke="var(--line)" />
          <YAxis unit="%" domain={[0, 100]} tick={{ fill: "var(--text-2)", fontSize: 11 }} stroke="var(--line)" />
          <Tooltip
            contentStyle={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 6, fontSize: 12 }}
            labelFormatter={(deg) => `Gentler than ${deg}°`}
            formatter={(v) => `${Number(v).toFixed(1)}%`}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {series.map((s) => (
            <Line key={s.name} dataKey={s.name} stroke={s.color} strokeWidth={2} strokeDasharray={s.dashed ? "5 4" : undefined} dot={false} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
