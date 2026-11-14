import type { BlockResult } from "@/lib/api";

export type Mode = "ml" | "phys";

const pct = (v: number) => `${Math.min(100, Math.max(0, v))}%`;

// the headline score on a 0 to 100 bar, the other score stays on it as a marker
export function ScoreGauge({ result: r, mode }: { result: BlockResult; mode: Mode }) {
  const ml = mode === "ml";
  const main = Math.round(ml ? r.score : r.physics_score);
  const other = Math.round(ml ? r.physics_score : r.score);
  const [low, high] = [Math.round(r.score_range.low), Math.round(r.score_range.high)];
  const spread = high > low;

  return (
    <>
      <p className="mt-3 flex items-baseline gap-2">
        <b className="text-4xl leading-none font-semibold">{main}</b>
        <span className="text-text-2">out of 100</span>
      </p>
      <div
        role="img"
        aria-label={`${ml ? "Trained model" : "Physics baseline"} ${main} out of 100, ${ml ? "physics baseline" : "trained model"} ${other}`}
        className="relative mt-4 h-2 rounded-sm bg-raised"
      >
        <div className="absolute inset-y-0 left-0 rounded-sm bg-brand" style={{ width: pct(main) }} />
        {ml && spread && <div className="absolute -inset-y-1 border-x-2 border-text bg-text/25" style={{ left: pct(low), width: pct(high - low) }} />}
        <div className="absolute -inset-y-1.5 w-0.5 -translate-x-1/2 bg-warn" style={{ left: pct(other) }} />
      </div>
      <div aria-hidden className="mt-1.5 flex justify-between text-xs text-text-2">
        <span>0</span>
        <span>50</span>
        <span>100</span>
      </div>
      <ul className="mt-3 space-y-1.5 text-xs [&>li]:flex [&>li]:items-baseline [&>li]:gap-2">
        {ml ? (
          <>
            {spread && (
              <li>
                <i className="h-2.5 w-3 shrink-0 border-x-2 border-text bg-text/25" />
                <span>
                  Likely range <b>{low} to {high}</b>, from copies of the model
                </span>
              </li>
            )}
            {r.percentile != null && (
              <li>
                <i className="h-2 w-3 shrink-0 rounded-sm bg-brand" />
                <span>
                  In the <b>top {Math.max(1, Math.round(100 - r.percentile))}%</b> of Earth&apos;s land for this target
                </span>
              </li>
            )}
            <li>
              <i className="h-3 w-0.5 shrink-0 bg-warn mx-[5px]" />
              <span>
                Physics baseline <b>{other}</b>: the same measurements with no training
              </span>
            </li>
          </>
        ) : (
          <>
            <li>
              <i className="h-2 w-3 shrink-0 rounded-sm bg-brand" />
              <span>The measurements compared directly, with no training</span>
            </li>
            <li>
              <i className="h-3 w-0.5 shrink-0 bg-warn mx-[5px]" />
              <span>
                Trained model <b>{other}</b>
                {spread && `, likely range ${low} to ${high}`}
              </span>
            </li>
          </>
        )}
      </ul>
    </>
  );
}
