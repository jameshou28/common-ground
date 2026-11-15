const pct = (v: number) => `${Math.min(100, Math.max(0, v))}%`;

// a score on a 0 to 100 bar, with its terrain part marked on it. the shown score is sqrt(terrain x surface)
export function ScoreGauge({ overall, terrain, surface, standIn, terrainNote }: { overall: number; terrain: number; surface: number; standIn: string; terrainNote: string }) {
  const o = Math.round(overall);
  const t = Math.round(terrain);
  const s = Math.round(surface);
  return (
    <>
      <p className="flex items-baseline gap-2">
        <b className="text-4xl leading-none font-semibold">{o}</b>
        <span className="text-text-2">out of 100 as {standIn}</span>
      </p>
      <div role="img" aria-label={`Overall ${o} out of 100, terrain ${t}`} className="relative mt-4 h-2 rounded-sm bg-raised">
        <div className="absolute inset-y-0 left-0 rounded-sm bg-brand" style={{ width: pct(o) }} />
        <div className="absolute -inset-y-1.5 w-0.5 -translate-x-1/2 bg-warn" style={{ left: pct(t) }} />
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
            Terrain <b>{t}</b>: {terrainNote}
          </span>
        </li>
        <li>
          <i className="h-2 w-3 shrink-0 rounded-sm bg-text-2" />
          <span>
            Surface <b>{s}</b>: how bare and dry it is. The same for the Moon and Mars.
          </span>
        </li>
      </ul>
    </>
  );
}
