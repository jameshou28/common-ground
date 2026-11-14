import type { Bar } from "@/lib/regions";
import { fmtSigned } from "@/lib/format";

// diverging bars: right of the line helps the match, left of it hurts
export function ContributionBars({ rows, zero, note }: { rows: Bar[]; zero: number; note?: string }) {
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1e-9);
  return (
    <>
      {note && <p className="text-xs text-text-2">{note}</p>}
      {rows.map((c) => {
        const neg = c.value < 0;
        return (
          <div key={c.key} className="mt-1.5 grid grid-cols-[minmax(0,1fr)_96px_44px] items-center gap-2">
            <span className="truncate">{c.label}</span>
            <span aria-hidden className="relative h-2.5 border-x border-line-2 before:absolute before:inset-y-[-3px] before:left-1/2 before:w-px before:bg-line">
              <i className={`absolute inset-y-0 ${neg ? "bg-hurt" : "bg-help"}`} style={{ [neg ? "right" : "left"]: "50%", width: `${(Math.abs(c.value) / max) * 50}%` }} />
            </span>
            <span className="text-right text-xs">{fmtSigned(c.value)}</span>
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
