import type { Point } from "@/lib/api";
import { fmtNum } from "@/lib/format";

// the per-cell values the api sends, anything else falls back to its key
const LOCAL: Record<string, [label: string, unit: string]> = {
  slope_mean: ["Mean slope", "°"],
  cell_relief: ["Relief in this cell", " m"],
  shadow: ["Shadow at the target's Sun", ""],
  rms_150m: ["Roughness at 150 m", " m"],
};

export function PointCard({ point, id }: { point: Point; id: string }) {
  const help = point.effect === "help";
  return (
    <div
      id={id}
      role="group"
      aria-label={`${point.landform}, ${help ? "helps" : "hurts"} the match`}
      className="pointer-events-auto absolute bottom-4 left-4 w-60 rounded-md border border-line bg-panel p-3 text-xs shadow-lg group-data-[below]:top-4 group-data-[below]:bottom-auto group-data-[flip]:right-4 group-data-[flip]:left-auto"
    >
      <h3 className="flex items-baseline justify-between gap-2 text-[13px] font-semibold">
        {point.landform.charAt(0).toUpperCase() + point.landform.slice(1)}
        <span className={help ? "font-normal text-help" : "font-normal text-hurt"}>{help ? "Helps" : "Hurts"}</span>
      </h3>
      <p className="mt-1 text-text-2 first-letter:uppercase">{point.reason}</p>
      <dl className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5">
        {Object.entries(point.local).map(([k, v]) => {
          const [label, unit] = LOCAL[k] ?? [k.replaceAll("_", " "), ""];
          return (
            <div key={k} className="contents">
              <dt className="text-text-2 first-letter:uppercase">{label}</dt>
              <dd className="text-right">
                {fmtNum(v, Math.abs(v) >= 100 ? 0 : 1)}
                {unit}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
