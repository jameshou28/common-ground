"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { BlockResult, Target } from "@/lib/api";
import { groupContributions, groupLabel } from "@/lib/contributions";
import { fmtLatLon, fmtSigned, fmtValue } from "@/lib/format";
import type { Tile } from "@/lib/tiles";

type Props = { tile: Tile; name: string; target: Target; result: BlockResult; capture: () => string | null };

// a one-page print of the block: image, facts, score and bars
export function FieldSheet(p: Props) {
  const [image, setImage] = useState<string | null>(null);
  const print = () => {
    setImage(p.capture());
    // let react put the image in before the print dialog freezes the page
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
  };
  return (
    <>
      <Button size="sm" variant="outline" onClick={print}>
        Print field sheet
      </Button>
      <Sheet {...p} image={image} />
    </>
  );
}

function Sheet({ tile, name, target, result: r, image }: Props & { image: string | null }) {
  const max = Math.max(...r.contributions.map((c) => Math.abs(c.contribution)), 1e-9);
  return (
    <article className="field-sheet hidden text-[11px] leading-snug text-black">
      <header className="flex items-baseline justify-between border-b-2 border-black pb-1">
        <h1 className="text-lg font-semibold">{name}</h1>
        <span>Analog Explorer field sheet · model {r.model_version}</span>
      </header>
      {/* a data url from the canvas, next/image has nothing to optimise */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {image && <img src={image} alt={`${name} as a 4 km block`} className="mt-2 max-h-[90mm] w-full object-contain" />}
      <div className="mt-2 grid grid-cols-2 gap-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3">
          <dt className="font-semibold">Block</dt>
          <dd>4 × 4 km, {tile.id}</dd>
          <dt className="font-semibold">Centre</dt>
          <dd>{fmtLatLon(tile.center.lat, tile.center.lon)}</dd>
          <dt className="font-semibold">Target</dt>
          <dd>
            {target.name}, {fmtLatLon(target.lat, target.lon)}
          </dd>
          <dt className="font-semibold">Elevation</dt>
          <dd>
            {r.dem_source}, {r.resolution_m} m · {r.confidence} confidence
          </dd>
        </dl>
        <p>
          <b className="text-3xl font-semibold">{Math.round(r.score)}</b> out of 100 (trained model)
          <br />
          Physics baseline {Math.round(r.physics_score)}
          {r.score_range.high > r.score_range.low && `, likely range ${Math.round(r.score_range.low)} to ${Math.round(r.score_range.high)}`}
        </p>
      </div>
      <h2 className="mt-3 border-b border-black font-semibold">Why this score</h2>
      {groupContributions(r.contributions).map((g) => (
        <div key={g.name} className="mt-1 break-inside-avoid">
          <div className="flex justify-between font-semibold">
            <span>{groupLabel(g.name)}</span>
            <span>{fmtSigned(g.sum)}</span>
          </div>
          {g.rows.map((c) => (
            <div key={c.key} className="grid grid-cols-[1fr_60mm_12mm] items-center gap-2">
              <span>
                {c.label}: {fmtValue(c.value, c.unit)}, target {fmtValue(c.target_value, c.unit)}
              </span>
              <span className="relative h-2 border-x border-black">
                <i
                  className="absolute inset-y-0 bg-black print:[print-color-adjust:exact]"
                  style={{ [c.contribution < 0 ? "right" : "left"]: "50%", width: `${(Math.abs(c.contribution) / max) * 50}%`, opacity: c.contribution < 0 ? 0.45 : 1 }}
                />
              </span>
              <span className="text-right">{fmtSigned(c.contribution)}</span>
            </div>
          ))}
        </div>
      ))}
      <p className="mt-3 border-t border-black pt-1">Dark bars help the match, light bars hurt it. Terrain and light only: no Earth site reproduces lunar gravity, vacuum or radiation.</p>
    </article>
  );
}
