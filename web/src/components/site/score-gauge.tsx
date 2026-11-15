import { WORLD_LABEL } from "@/components/globe/config";
import type { ScoreResult } from "@/lib/api";
import type { Match } from "@/lib/regions";

const pct = (v: number) => `${Math.min(100, Math.max(0, v))}%`;

// the overall score on a 0 to 100 bar, with the terrain score marked on it
export function ScoreGauge({ result: r, match }: { result: ScoreResult; match: Match }) {
  const overall = Math.round(match.world.overall);
  const landscape = Math.round(match.world.landscape_score);
  const conditions = Math.round(r.conditions.score);
  return (
    <>
      <p className="flex items-baseline gap-2">
        <b className="text-4xl leading-none font-semibold">{overall}</b>
        <span className="text-text-2">out of 100 as a {WORLD_LABEL[match.tab]} stand-in</span>
      </p>
      <div role="img" aria-label={`Overall ${overall} out of 100, terrain ${landscape}`} className="relative mt-4 h-2 rounded-sm bg-raised">
        <div className="absolute inset-y-0 left-0 rounded-sm bg-brand" style={{ width: pct(overall) }} />
        <div className="absolute -inset-y-1.5 w-0.5 -translate-x-1/2 bg-warn" style={{ left: pct(landscape) }} />
      </div>
      <div aria-hidden className="mt-1.5 flex justify-between text-xs text-text-2">
        <span>0</span>
        <span>50</span>
        <span>100</span>
      </div>
      <ul className="mt-3 space-y-1.5 text-xs [&>li]:flex [&>li]:items-baseline [&>li]:gap-2">
        <li>
          <i className="mx-[5px] h-3 w-0.5 shrink-0 bg-warn" />
          <span>
            Terrain <b>{landscape}</b>: how the ground compares with the best {WORLD_LABEL[match.tab]} region
          </span>
        </li>
        <li>
          <i className="h-2 w-3 shrink-0 rounded-sm bg-text-2" />
          <span>
            Surface <b>{conditions}</b>: how bare and dry it is. The same for the Moon and Mars.
          </span>
        </li>
      </ul>
    </>
  );
}
