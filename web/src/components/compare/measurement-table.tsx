import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ScoreResult } from "@/lib/api";
import { fmtValue } from "@/lib/format";
import { blockLabel } from "@/lib/regions";

// the block measurements of every block side by side
export function MeasurementTable({ blocks }: { blocks: { name: string; result: ScoreResult }[] }) {
  const keys = Object.keys(blocks[0]?.result.block ?? {});
  return (
    <Table className="text-xs">
      <TableHeader>
        <TableRow>
          <TableHead>Measurement</TableHead>
          {blocks.map((b) => (
            <TableHead key={b.name} className="text-right">
              {b.name}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {keys.map((key) => {
          const [label, unit] = blockLabel(key);
          return (
            <TableRow key={key}>
              <TableCell>{label}</TableCell>
              {blocks.map((b) => {
                const v = b.result.block[key];
                return (
                  <TableCell key={b.name} className="text-right">
                    {v == null ? "–" : unit === "share" ? `${Math.round(v * 100)}%` : fmtValue(v, unit)}
                  </TableCell>
                );
              })}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
