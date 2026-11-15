import type { Bar, Breakdown, BreakdownContext } from "@/lib/regions";
import { breakdownBars } from "@/lib/regions";
import { fmtPoints, fmtSigned } from "@/lib/format";

// diverging bars: right of the line helps the match, left of it hurts
export function ContributionBars({ rows, zero, note, fmt = fmtSigned }: { rows: Bar[]; zero: number; note?: string; fmt?: (v: number) => string }) {
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1e-9);
  return (
    <>
      {note && <p className="text-xs text-text-2">{note}</p>}
      {rows.map((c) => {
        const neg = c.value < 0;
        return (
          <div key={c.key} className="mt-1.5 grid grid-cols-[minmax(0,1fr)_96px_44px] items-center gap-2">
            <span className="break-words">{c.label}</span>
            <span aria-hidden className="relative h-2.5 border-x border-line-2 before:absolute before:inset-y-[-3px] before:left-1/2 before:w-px before:bg-line">
              <i className={`absolute inset-y-0 ${neg ? "bg-hurt" : "bg-help"}`} style={{ [neg ? "right" : "left"]: "50%", width: `${(Math.abs(c.value) / max) * 50}%` }} />
            </span>
            <span className="text-right text-xs">{fmt(c.value)}</span>
          </div>
        );
      })}
      {rows.length === 0 && <p className="mt-2 text-xs text-text-2">Nothing pulls this match either way.</p>}
      {zero > 0 && rows.length > 0 && (
        <p className="mt-2 text-xs text-text-2">
          {zero} more {zero === 1 ? "measurement makes" : "measurements make"} no difference here.
        </p>
      )}
    </>
  );
}

// a score as points that add up to it: the starting point, then the bars, then the total
export function BreakdownBars({ breakdown, context, total, note }: { breakdown: Breakdown; context?: BreakdownContext; total: string; note?: string }) {
  const { rows, zero } = breakdownBars(breakdown, context);
  const line = "mt-1.5 grid grid-cols-[minmax(0,1fr)_44px] items-baseline gap-2";
  return (
    <>
      {note && <p className="text-xs text-text-2">{note}</p>}
      <div className={`${line} mt-2 border-b border-line pb-1.5`}>
        <span>
          Starting point{" "}
          <span className="text-xs text-text-2">{context ? `the score of a typical match to ${context.target}` : "a typical match"}</span>
        </span>
        <span className="text-right text-xs">{breakdown.base.toFixed(1)}</span>
      </div>
      <ContributionBars rows={rows} zero={zero} fmt={fmtPoints} />
      <div className={`${line} mt-2 border-t border-line pt-1.5 font-semibold`}>
        <span>= {total}</span>
        <span className="text-right text-xs">{breakdown.total.toFixed(1)}</span>
      </div>
    </>
  );
}
