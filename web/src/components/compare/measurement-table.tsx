import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { BlockResult } from "@/lib/api";
import { fmtValue } from "@/lib/format";

// distance is in target spreads, these cut-offs only colour the table
const NEAR = 0.35;
const FAR = 1;

// every measurement of every block next to the target's, marked where it is near or far
export function MeasurementTable({ blocks, targetName }: { blocks: { name: string; result: BlockResult }[]; targetName: string }) {
  const rows = blocks[0]?.result.contributions ?? [];
  return (
    <>
      <Table className="text-xs">
        <TableHeader>
          <TableRow>
            <TableHead>Measurement</TableHead>
            {blocks.map((b) => (
              <TableHead key={b.name} className="text-right">
                {b.name}
              </TableHead>
            ))}
            <TableHead className="text-right">{targetName}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell>{row.label}</TableCell>
              {blocks.map((b) => {
                const c = b.result.contributions.find((x) => x.key === row.key);
                const mark = !c ? "" : c.distance <= NEAR ? "text-help" : c.distance >= FAR ? "text-hurt" : "";
                return (
                  <TableCell key={b.name} className={`text-right ${mark}`}>
                    {c ? fmtValue(c.value, c.unit) : "–"}
                    {mark && <span className="sr-only">{c!.distance <= NEAR ? " (near the target)" : " (far from the target)"}</span>}
                  </TableCell>
                );
              })}
              <TableCell className="text-right">{fmtValue(row.target_value, row.unit)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="mt-2 flex gap-4 text-xs text-text-2">
        <span className="text-help">Near the target</span>
        <span className="text-hurt">Far from it</span>
      </p>
    </>
  );
}
