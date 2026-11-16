import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CheckOrder } from "@/components/check/check-order";
import v from "../../../public/data/validation.json";

export const metadata: Metadata = { title: "How we know" };

// every figure on this page is read from public/data/validation.json, written from the training and diagnostics runs

function Section({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="mt-10 scroll-mt-6">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="mt-2 space-y-3 text-text-2">{children}</div>
    </section>
  );
}

// a horizontal bar chart on a 0-100 axis. a dashed marker shows chance where it applies
function Bars({ rows, max = 100, unit = "%", chance, lowerIsBetter }: { rows: { name: string; value: number; ours?: boolean }[]; max?: number; unit?: string; chance?: number; lowerIsBetter?: boolean }) {
  return (
    <figure className="mt-3 rounded-lg border border-line bg-panel p-4">
      <ul className="space-y-2 text-xs">
        {rows.map((r) => (
          <li key={r.name} className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)_3.5rem] items-center gap-3">
            <span className={r.ours ? "font-semibold text-text" : "text-text-2"}>{r.name}</span>
            <span className="relative h-3 rounded-sm bg-raised">
              <i className={`absolute inset-y-0 left-0 rounded-sm ${r.ours ? "bg-brand" : "bg-text-2/60"}`} style={{ width: `${(100 * r.value) / max}%` }} />
              {chance != null && <i aria-hidden className="absolute -inset-y-1 border-l border-dashed border-warn" style={{ left: `${(100 * chance) / max}%` }} />}
            </span>
            <span className={`text-right tabular-nums ${r.ours ? "font-semibold text-text" : ""}`}>
              {r.value}
              {unit}
            </span>
          </li>
        ))}
      </ul>
      <figcaption className="mt-3 flex flex-wrap gap-x-4 text-[11px] text-text-2">
        {lowerIsBetter != null && <span>{lowerIsBetter ? "Shorter is better" : "Longer is better"}</span>}
        {chance != null && (
          <span className="flex items-center gap-1.5">
            <i aria-hidden className="h-3 border-l border-dashed border-warn" /> chance ({chance}
            {unit})
          </span>
        )}
      </figcaption>
    </figure>
  );
}

// where verified sites and ordinary land fall on the overall score, as ranges on one 0-100 axis
function Ranges() {
  const s = v.separation;
  const row = (label: string, lo: number, mid: number, hi: number, cls: string) => (
    <li className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] items-center gap-3">
      <span className="text-text-2">{label}</span>
      <span className="relative h-5">
        <i className="absolute top-1/2 h-px w-full bg-line" />
        <i className={`absolute top-1/2 h-2 -translate-y-1/2 rounded-sm ${cls}`} style={{ left: `${lo}%`, width: `${hi - lo}%` }} />
        <i className="absolute top-0 h-5 w-0.5 bg-text" style={{ left: `${mid}%` }} />
        <span className="absolute -top-4 text-[10px] text-text-2 tabular-nums" style={{ left: `${mid}%`, transform: "translateX(-50%)" }}>
          {mid}
        </span>
      </span>
    </li>
  );
  return (
    <figure className="mt-3 rounded-lg border border-line bg-panel p-4 pt-6">
      <ul className="space-y-6 text-xs">
        {row("Verified analog sites", s.sites.p10, s.sites.p50, s.sites.p90, "bg-brand/70")}
        {row("Random land", 0, s.land.p50, s.land.p90, "bg-text-2/50")}
      </ul>
      <div aria-hidden className="mt-2 grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-3 text-[10px] text-text-2">
        <span />
        <span className="flex justify-between">
          <span>0</span>
          <span>50</span>
          <span>100</span>
        </span>
      </div>
      <figcaption className="mt-2 text-[11px] text-text-2">
        Overall score. Bars run from the 10th to the 90th percentile of verified sites, and up to the 90th percentile of random land; the tick is the median. 1% of random land
        scores above {s.land.p99}.
      </figcaption>
    </figure>
  );
}

// the comparison behind "closest places": two blocks' slope distributions as quantile curves; the shaded gap between
// them is the 1-d wasserstein (earth mover's) distance
function WassersteinFigure() {
  const a = [2, 3, 4, 5, 6.5, 8, 10, 13, 18];
  const b = [1, 1.5, 2.5, 3.5, 4.5, 6, 7.5, 9.5, 12];
  const x = (i: number) => 30 + i * 40;
  const y = (val: number) => 150 - val * 7;
  const line = (q: number[]) => q.map((val, i) => `${i ? "L" : "M"}${x(i)},${y(val)}`).join(" ");
  const back = b
    .map((val, i): [number, number] => [x(i), y(val)])
    .reverse()
    .map(([px, py]) => `L${px},${py}`)
    .join(" ");
  return (
    <figure className="mt-3 rounded-lg border border-line bg-panel p-4">
      <svg viewBox="0 0 380 170" className="h-auto w-full max-w-md" role="img" aria-label="Two quantile curves with the gap between them shaded">
        <path d={`${line(a)} ${back} Z`} className="fill-brand/20" />
        <path d={line(a)} fill="none" className="stroke-brand" strokeWidth="2" />
        <path d={line(b)} fill="none" className="stroke-text-2" strokeWidth="2" strokeDasharray="5 4" />
        <line x1="30" y1="150" x2="350" y2="150" className="stroke-line" />
        <line x1="30" y1="10" x2="30" y2="150" className="stroke-line" />
        <text x="190" y="166" textAnchor="middle" className="fill-text-2 text-[10px]">
          share of the block&apos;s 64 cells (quantile)
        </text>
        <text x="12" y="80" textAnchor="middle" transform="rotate(-90 12 80)" className="fill-text-2 text-[10px]">
          slope
        </text>
        <text x="296" y="28" className="fill-brand text-[10px]">
          Earth block
        </text>
        <text x="296" y="92" className="fill-text-2 text-[10px]">
          Moon block
        </text>
      </svg>
      <figcaption className="mt-2 text-[11px] text-text-2">
        Each curve lists one measurement (here slope) over a block&apos;s 64 cells, from smallest to largest. The shaded area between the curves is the Wasserstein distance: how
        much of the slope distribution has to move, and how far, to turn one block into the other.
      </figcaption>
    </figure>
  );
}

const STEPS: [string, string][] = [
  ["Measure", "A 4 km block and the 32 km around it, each cut into 64 cells: 9 measurements per cell and 15 for the whole block."],
  ["Shortlist", "Compare the distributions of those measurements with thousands of Moon and Mars blocks (a Wasserstein comparison) and keep the closest 100."],
  ["Match", "Pair the 64 cells one-to-one with each shortlisted block (optimal transport), and score each pair with a monotone I-spline model."],
  ["Analog model", "A model trained on verified analog sites against ordinary land: how analog-like is this ground, whatever it matches?"],
  ["Surface model", "Land cover and rainfall: bare, dry ground helps; trees, crops, water and buildings hurt."],
  ["Combine", "Region score = analog model plus how well the ground matches that region. Overall = region^0.8 × surface^0.2."],
];

export default function Page() {
  const f = v.finding_sites;
  const ours = f.rows[f.rows.length - 1].value;
  return (
    <main className="relative flex-1 overflow-y-auto p-6 max-md:p-4">
      <article className="mx-auto max-w-3xl">
        <h1 className="text-xl leading-tight font-semibold">How we know the score means something</h1>
        <p className="mt-2 text-text-2">
          Every number here is measured on places the model never saw while it learned: verified sites and ordinary land in the same 6° patch of the Earth are held out together, so a
          site is never scored by a model that has seen its neighbourhood. Model {v.model_version}; the figures are in{" "}
          <a href="/data/validation.json" className="text-brand">
            validation.json
          </a>
          .
        </p>

        <Section title="How the model works">
          <p>
            The model has two layers. The first finds which Moon or Mars terrain a place looks like, and which real places on the Moon or Mars are closest. The second, trained on{" "}
            {v.training.verified_sites} verified analog sites against {v.training.random_land.toLocaleString()} blocks of ordinary land, judges how analog-like the place is. The library
            holds {v.training.library_blocks.toLocaleString()} Moon and Mars blocks in {v.training.regions} regions.
          </p>
          <ol className="mt-3 grid gap-2 sm:grid-cols-2">
            {STEPS.map(([t, d], i) => (
              <li key={t} className="rounded-lg border border-line bg-panel p-3 text-xs">
                <b className="flex items-baseline gap-2 text-sm font-semibold text-text">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand/20 text-[11px] text-brand">{i + 1}</span>
                  {t}
                </b>
                <p className="mt-1 text-text-2">{d}</p>
              </li>
            ))}
          </ol>
        </Section>

        <Section title="Comparing two pieces of ground: the Wasserstein distance">
          <p>
            Two blocks can look alike even if their features sit in different places, so we don&apos;t compare them pixel by pixel. We compare the distribution of each measurement over
            the block&apos;s 64 cells. The Wasserstein distance, also called the earth mover&apos;s distance, is the natural way to compare two distributions: how much has to move, and
            how far, to turn one into the other.
          </p>
          <WassersteinFigure />
          <p>
            Each block carries a 32-number &quot;sketch&quot;, built from the quantiles of every cell measurement. The distance between two sketches approximates the summed Wasserstein
            distances across the measurements, and it&apos;s cheap enough to compare a click against every library block in milliseconds. The closest 100 then get the exact version: the 64 cells
            are paired one-to-one by optimal transport (the Hungarian algorithm), and a pair model built from monotone I-splines turns the mismatch in each measurement into a
            similarity. Monotone means more mismatch can never raise the score.
          </p>
        </Section>

        <Section title="Finding verified analog sites">
          <p>
            The main test: rank every verified terrain analog site among ordinary land. 0% means it beats all of it, 50% is what a random score would give. The current model puts the
            median site in the top {ours}% of Earth&apos;s land; {f.top10.v3}% of sites land in the top tenth ({f.top10.v2}% before v3) and {f.top25.v3}% in the top quarter.
          </p>
          <Bars rows={f.rows} chance={50} lowerIsBetter />
          <p>
            Matching alone was close to chance: most Moon and Mars terrain is plains, so &quot;looks like a typical lunar block&quot; rewarded flat land, while real analog sites are
            rugged (median relief about 214 m, against 48 m for ordinary land). The trained analog model is what moved this number.
          </p>
        </Section>

        <Section title="How far apart good and ordinary places score">
          <p>
            The median verified site scores {v.separation.sites.p50} overall; the median piece of random land scores {v.separation.land.p50}. The best 4 km block within reach of each
            listed site scores {v.separation.best_block_within_4km} at the median, since listed coordinates are often a few kilometres off.
          </p>
          <Ranges />
        </Section>

        <Section title="Which region: matching Moon and Mars terrain">
          <p>
            How often the model picks the right one of the {v.training.regions} regions for a Moon or Mars block it hasn&apos;t seen (± {v.region_accuracy.plus_minus} points over repeated
            runs). The wider 32 km view carries most of it.
          </p>
          <Bars rows={v.region_accuracy.rows} chance={v.region_accuracy.chance} lowerIsBetter={false} />
        </Section>

        <Section title="Can it tell which world a block is from?">
          <p>
            It shouldn&apos;t be able to: if the measurements gave the planet away, a high score could just mean &quot;looks like Earth&quot;. Guessing the world (Earth, Moon or Mars) from
            the measurements works this often. Lower is better; we&apos;d like it under 50%.
          </p>
          <Bars rows={v.planet_check.rows} chance={v.planet_check.chance} lowerIsBetter />
        </Section>

        <Section title="Places that should never score well">
          <p>
            A standing list of {v.negative_set.places} places that are nothing like the Moon or Mars: city centres, farmland, rainforest and river deltas. Every model version has to keep
            all of them out of the top quarter of Earth&apos;s land. Now: {v.negative_set.in_top_quarter} of {v.negative_set.places}.
          </p>
        </Section>

        <Section title="Check sites in the expected order">
          <p>
            Before scoring anything we wrote down how nine places should rank, from Dutch farmland to the McMurdo Dry Valleys. None is used in training. Rank correlation between the
            expected order and the model&apos;s overall score: {v.check_sites.spearman} (1 is the same order).
          </p>
          <figure className="mt-3 overflow-x-auto rounded-lg border border-line bg-panel">
            <table className="w-full text-left text-xs">
              <thead className="text-text-2">
                <tr className="border-b border-line">
                  <th className="px-3 py-2 font-medium">Place</th>
                  <th className="px-3 py-2 font-medium">Expected</th>
                  <th className="px-3 py-2 text-right font-medium">Terrain</th>
                  <th className="px-3 py-2 text-right font-medium">Surface</th>
                  <th className="px-3 py-2 text-right font-medium">Overall</th>
                </tr>
              </thead>
              <tbody>
                {v.check_sites.rows.map((r) => (
                  <tr key={r.name} className="border-b border-line last:border-0">
                    <td className="px-3 py-1.5 text-text">{r.name}</td>
                    <td className="px-3 py-1.5">{r.expected}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{r.terrain}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{r.surface}</td>
                    <td className="px-3 py-1.5 text-right font-semibold text-text tabular-nums">{r.overall}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </figure>
          <p>Scored live by the site right now:</p>
          <div className="mt-3 [&_h2]:sr-only">
            <CheckOrder />
          </div>
        </Section>

        <Section title="Agreement with expert opinion">
          <p>
            We rated {v.expert_list.sites} well-known analog sites from the literature before scoring them, and never trained on those ratings. The model agrees with the ordering only
            weakly (rank correlation {v.expert_list.spearman}): {v.expert_list.rated_80_scoring_70} of the {v.expert_list.rated_80} sites experts rate highest score 70 or more, and{" "}
            {v.expert_list.rated_80_scoring_70_nearby} do when the best block within 4 km counts. It separates analog-like land from ordinary land well, but much of what makes the Dry
            Valleys or Haughton crater special, such as cold, ice-cemented ground or impact rock, isn&apos;t in its inputs.
          </p>
        </Section>

        <Section title="Features">
          <p>
            Feature scores rate how well a place matches one kind of landform inside a region, like wrinkle ridges in the lunar maria. A feature only counts as checked when its own
            Moon or Mars blocks score clearly higher than the rest of their region (area under the curve at least 0.65). {v.landforms.validated} of {v.landforms.scored} features pass.
          </p>
        </Section>

        <Section title="Finding new places">
          <p>
            The Best sites lists come from scoring all {v.discovery.cells.toLocaleString()} cells of Earth&apos;s dry land on a 32 km grid, then every promising 4 km block in full. As a
            check, verified analog sites land at the {v.discovery.sites_percentile}th percentile of that screen ({v.discovery.sites_top_quarter}% in the top quarter), and none of the
            never-good places is within 40 km of a pick.
          </p>
        </Section>

        <Section title="Getting better, version by version">
          <p>Median rank of verified analog sites among random land, by model version.</p>
          <Bars rows={v.versions.map((r, i) => ({ name: r.name, value: r.rank, ours: i === v.versions.length - 1 }))} lowerIsBetter />
        </Section>

        <Section title="What this doesn't show">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>The score is about the shape of the ground and how bare it is. It doesn&apos;t know rock type, dust, temperature, or whether you&apos;d be allowed to drive a rover there.</li>
            <li>No place on Earth has lunar or Martian gravity: Earth 9.81 m/s², Moon 1.62 m/s² (about 1/6), Mars 3.71 m/s² (about 3/8).</li>
            <li>Earth is scored from 30 m elevation data, so boulders and craters smaller than that are invisible to it, and forest canopy makes the ground look rougher than it is.</li>
            <li>The analog model learned from {v.training.verified_sites} verified sites, many of them in the US Southwest, Iceland and Hawaii.</li>
            <li>A region score moves about ±{v.stability.region_score_wobble_points} points between retrainings, so small differences mean little.</li>
          </ul>
        </Section>
      </article>
    </main>
  );
}
