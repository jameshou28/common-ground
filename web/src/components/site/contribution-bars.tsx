import type { BlockResult } from "@/lib/api";
import { groupContributions, groupLabel, totals } from "@/lib/contributions";
import { fmtSigned, fmtValue } from "@/lib/format";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Mode } from "./score-gauge";

// why the trained score is what it is, the baseline has no weights so it shows the measurements
export function ContributionBars({ result: r, mode }: { result: BlockResult; mode: Mode }) {
  if (mode === "phys")
    return (
      <>
        <p className="text-xs text-text-2">The baseline has no weights to explain. It is the distance between these measurements.</p>
        <Table className="mt-2 text-xs">
          <TableHeader>
            <TableRow>
              <TableHead>Measurement</TableHead>
              <TableHead className="text-right">This block</TableHead>
              <TableHead className="text-right">Target</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {r.contributions.map((c) => (
              <TableRow key={c.key}>
                <TableCell>{c.label}</TableCell>
                <TableCell className="text-right">{fmtValue(c.value, c.unit)}</TableCell>
                <TableCell className="text-right">{fmtValue(c.target_value, c.unit)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </>
    );

  const groups = groupContributions(r.contributions);
  const t = totals(r);
  const max = Math.max(...r.contributions.map((c) => Math.abs(c.contribution)), 1e-9);
  if (process.env.NODE_ENV !== "production" && Math.abs(t.gap) > 1e-3) console.error(`contributions are off the score by ${t.gap.toFixed(4)} logits`, r.tile_id);

  return (
    <>
      <p className="text-xs text-text-2">Measured against a typical land block. The bars add up exactly.</p>
      {groups.map((g) => (
        <div key={g.name} className="mt-3">
          <div className="flex justify-between border-b border-line-2 pb-1 text-xs font-semibold">
            <span>{groupLabel(g.name)}</span>
            <span>{fmtSigned(g.sum)}</span>
          </div>
          {g.rows.map((c) => {
            const neg = c.contribution < 0;
            return (
              <div key={c.key} className="mt-1.5 grid grid-cols-[minmax(0,1fr)_96px_44px] items-center gap-2">
                <span className="min-w-0">
                  <span className="block truncate">{c.label}</span>
                  <span className="block truncate text-xs text-text-2">
                    {fmtValue(c.value, c.unit)} · target {fmtValue(c.target_value, c.unit)}
                  </span>
                </span>
                <span aria-hidden className="relative h-2.5 border-x border-line-2 before:absolute before:inset-y-[-3px] before:left-1/2 before:w-px before:bg-line">
                  <i
                    className={`absolute inset-y-0 ${neg ? "bg-hurt" : "bg-help"}`}
                    style={{ [neg ? "right" : "left"]: "50%", width: `${(Math.abs(c.contribution) / max) * 50}%` }}
                  />
                </span>
                <span className="text-right text-xs">{fmtSigned(c.contribution)}</span>
              </div>
            );
          })}
        </div>
      ))}
      <dl className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-y-1 border-t border-line pt-2 text-xs">
        <dt className="text-text-2">Typical land block</dt>
        <dd className="text-right">{fmtSigned(r.bias)}</dd>
        <dt className="text-text-2">All bars</dt>
        <dd className="text-right">{fmtSigned(t.bars)}</dd>
        <dt className="font-semibold">Total, which gives the score {Math.round(r.score)}</dt>
        <dd className="text-right font-semibold">{fmtSigned(t.total)}</dd>
      </dl>
    </>
  );
}
