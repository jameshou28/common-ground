"use client";

import { ChevronUpIcon } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { WORLD_LABEL } from "@/components/globe/config";
import type { ScoreResult } from "@/lib/api";
import { download, exportName, toCsv, toJson } from "@/lib/export";
import { fmtLatLon, fmtSigned } from "@/lib/format";
import { bars, conditionLabel, contributionLabel, type Bar, type Match } from "@/lib/regions";
import type { Tile } from "@/lib/tiles";

type Props = { tile: Tile; name: string; result: ScoreResult; match: Match; capture: () => string | null };

// field sheet to print or save as pdf, plus csv and json for research use
export function ExportMenu(p: Props) {
  const [image, setImage] = useState<string | null | undefined>(undefined);
  const print = () => {
    setImage(p.capture());
    // let react put the image in before the print dialog freezes the page
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
  };
  const save = (ext: string, body: string, type: string) => download(exportName(p.result, p.match, ext), body, type);
  const items: [string, string, () => void][] = [
    ["Field sheet", "PDF", print],
    ["Scores", "CSV", () => save("csv", toCsv(p.result, p.match), "text/csv")],
    ["Everything", "JSON", () => save("json", toJson(p.result, p.match), "application/json")],
  ];
  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button size="sm" variant="outline" className="group ml-auto">
            Export <ChevronUpIcon className="transition-transform group-data-[state=closed]:rotate-180" />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content side="top" align="end" sideOffset={6} className="z-50 min-w-48 rounded-lg border border-line bg-panel p-1 text-sm shadow-lg">
            {items.map(([label, kind, run]) => (
              <DropdownMenu.Item key={label} onSelect={run} className="flex cursor-pointer items-center justify-between gap-6 rounded-md px-2.5 py-1.5 outline-none data-[highlighted]:bg-hover">
                {label} <span className="text-xs text-text-2">{kind}</span>
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      {/* straight under body so print css can drop the rest of the app; only after a click, so never on the server */}
      {image !== undefined && createPortal(<Sheet {...p} image={image} />, document.body)}
    </>
  );
}

function Rows({ rows }: { rows: Bar[] }) {
  const max = Math.max(...rows.map((c) => Math.abs(c.value)), 1e-9);
  return rows.map((c) => (
    <div key={c.key} className="grid grid-cols-[1fr_60mm_12mm] items-center gap-2 break-inside-avoid">
      <span>{c.label}</span>
      <span className="relative h-2 border-x border-black">
        <i
          className="absolute inset-y-0 bg-black print:[print-color-adjust:exact]"
          style={{ [c.value < 0 ? "right" : "left"]: "50%", width: `${(Math.abs(c.value) / max) * 50}%`, opacity: c.value < 0 ? 0.45 : 1 }}
        />
      </span>
      <span className="text-right">{fmtSigned(c.value)}</span>
    </div>
  ));
}

function Sheet({ tile, name, result: r, match, image }: Props & { image: string | null }) {
  const { site, world, tab } = match;
  return (
    <article className="field-sheet hidden text-[11px] leading-snug text-black">
      <header className="flex items-baseline justify-between border-b-2 border-black pb-1">
        <h1 className="text-lg font-semibold">{name}</h1>
        <span>Common Ground field sheet · model {r.model_version}</span>
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
          <dt className="font-semibold">Closest match</dt>
          <dd className="first-letter:uppercase">
            {site.name}, {fmtLatLon(site.lat, site.lon)}
          </dd>
          <dt className="font-semibold">Region</dt>
          <dd>{match.region.title}</dd>
        </dl>
        <p>
          <b className="text-3xl font-semibold">{Math.round(world.overall)}</b> out of 100 as a {WORLD_LABEL[tab]} stand-in
          <br />
          Terrain {Math.round(world.landscape_score)} · Surface {Math.round(r.conditions.score)}
        </p>
      </div>
      <h2 className="mt-3 border-b border-black font-semibold">Why it matches</h2>
      <Rows rows={bars(site.contributions, contributionLabel).rows} />
      <h2 className="mt-3 border-b border-black font-semibold">Surface and climate</h2>
      <Rows rows={bars(r.conditions.terms, conditionLabel).rows} />
      <p className="mt-3 border-t border-black pt-1">Dark bars help the match, light bars hurt it. This covers terrain and surface only. No Earth site has lunar or Martian gravity, air or radiation.</p>
      <p className="mt-1">
        Tile {r.tile_id} · model {r.model_version} · printed {new Date().toISOString().slice(0, 10)}
      </p>
    </article>
  );
}
