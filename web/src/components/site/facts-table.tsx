import { fmtLatLon } from "@/lib/format";
import type { Match } from "@/lib/regions";
import type { Tile } from "@/lib/tiles";

// the survey-sheet facts for one block
export function FactsTable({ tile, match }: { tile: Tile; match: Match | null }) {
  const rows: [string, React.ReactNode][] = [
    ["Block", `4 × 4 km, ${tile.id}`],
    ["Centre", fmtLatLon(tile.center.lat, tile.center.lon)],
  ];
  // earth blocks are scored from glo-30; moon and mars blocks only show the globe's own terrain
  if (tile.world === "earth") rows.push(["Elevation", "Copernicus GLO-30, 30 m"]);
  if (match)
    rows.push([
      "Closest match",
      <>
        <span className="first-letter:uppercase">{match.site.name}</span>, {fmtLatLon(match.site.lat, match.site.lon)}
        {" · "}
        <a href={match.site.href} target="_blank" rel="noreferrer" className="text-brand">
          elevation data
        </a>
      </>,
    ]);
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
