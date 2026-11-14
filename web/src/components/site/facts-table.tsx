import type { BlockResult, Target } from "@/lib/api";
import { fmtLatLon } from "@/lib/format";
import type { Tile } from "@/lib/tiles";

const CONFIDENCE: Record<BlockResult["confidence"], string> = { normal: "normal confidence", lower: "lower confidence", coarse: "coarse data" };

// the survey-sheet facts for one block
export function FactsTable({ tile, target, result }: { tile: Tile; target?: Target; result?: BlockResult }) {
  const rows: [string, string][] = [
    ["Block", `4 × 4 km, ${tile.id}`],
    ["Centre", fmtLatLon(tile.center.lat, tile.center.lon)],
  ];
  if (target) rows.push(["Matched to", `${target.name}, ${fmtLatLon(target.lat, target.lon)}`]);
  if (result) rows.push(["Elevation", `${result.dem_source}, ${result.resolution_m} m · ${CONFIDENCE[result.confidence]}`]);
  return (
    <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-xs">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-text-2">{k}</dt>
          <dd className="break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
