import type { Metadata } from "next";
import { CheckOrder } from "@/components/compare/check-order";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import v from "../../../public/data/validation.json";

export const metadata: Metadata = { title: "How we know" };

type Maybe = number | null;

// every figure comes from validation.json, a missing one says so
function Num({ value, unit = "" }: { value: Maybe; unit?: string }) {
  return value === null ? <span className="text-text-2 italic">not measured yet</span> : <>{value}{unit}</>;
}

export default function Page() {
  const placeholder = v.status === "placeholder";
  return (
    <main className="relative flex-1 overflow-y-auto p-6">
      <article className="mx-auto max-w-3xl [&_h2]:mt-8 [&_h2]:text-base [&_h2]:font-semibold [&_section>p]:mt-2 [&_section>p]:text-text-2">
        <h1 className="text-xl leading-tight font-semibold">How we know the score means something</h1>
        <p className="mt-2 text-text-2">
          We hide known analog sites from the model and ask it to find them again, at the scale of a single 4 km block. Every number on this page is read from{" "}
          <a href="/data/validation.json" className="text-brand">
            validation.json
          </a>
          , which the training run writes.
        </p>
        {placeholder && (
          <p role="note" className="mt-4 rounded-md border border-line bg-raised px-3 py-2 text-xs">
            <b className="block font-semibold">Not measured yet</b>
            <span className="text-text-2">The validation run has not finished, so the figures below are empty. Nothing here is an estimate.</span>
          </p>
        )}

        <section>
          <h2>Finding hidden analog sites</h2>
          <p>
            Each known site is hidden in turn, along with everything near it. The model then ranks every block in that region. A site counts as found if its block lands near the top. Known sites in total:{" "}
            <Num value={v.sites as Maybe} />.
          </p>
          <div className="mt-3 grid gap-6 sm:grid-cols-2">
            {v.recall.map((group) => (
              <div key={group.title}>
                <h3 className="text-xs font-semibold">{group.title}</h3>
                <ul className="mt-2 space-y-1.5 text-xs">
                  {group.rows.map((row) => {
                    const [value, low, high] = [row.value, row.low, row.high] as Maybe[];
                    return (
                      <li key={row.name} className="grid grid-cols-[110px_minmax(0,1fr)_auto] items-center gap-2">
                        <span className={"ours" in row ? "font-semibold" : ""}>{row.name}</span>
                        <span className="relative h-2 rounded-sm bg-raised">
                          {value !== null && <i className={`absolute inset-y-0 left-0 rounded-sm ${"ours" in row ? "bg-brand" : "bg-text-2"}`} style={{ width: `${value}%` }} />}
                          {low !== null && high !== null && <i className="absolute -inset-y-0.5 border-x border-text" style={{ left: `${low}%`, width: `${high - low}%` }} />}
                        </span>
                        <span>
                          <Num value={value} unit="%" />
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2>Sites from programmes the model never saw</h2>
          <p>Trained on one agency&apos;s sites, then tested on other agencies&apos; sites. A low percentile means the site outranks most of the land around it.</p>
          <Table className="mt-3 text-xs">
            <TableHeader>
              <TableRow>
                <TableHead>Held-out programme</TableHead>
                <TableHead className="text-right">Sites</TableHead>
                <TableHead className="text-right">Median percentile</TableHead>
                <TableHead className="text-right">Random would give</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {v.held_out.map((row) => (
                <TableRow key={row.programme}>
                  <TableCell>{row.programme}</TableCell>
                  <TableCell className="text-right">
                    <Num value={row.sites as Maybe} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Num value={row.median_percentile as Maybe} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Num value={row.random_percentile as Maybe} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>

        <section>
          <h2>Can the model tell which world a block is from?</h2>
          <p>
            It should not be able to. If the measurements gave away the planet, a high score could just mean &quot;looks like Earth&quot;. Predicting the world from the model&apos;s inputs is right{" "}
            <Num value={v.planet_check.ours as Maybe} unit="% of the time" />. With {v.planet_check.worlds} worlds, guessing gets {v.planet_check.chance}%.
          </p>
        </section>

        <section>
          <h2>Check sites in the expected order</h2>
          <p>
            Before scoring anything we wrote down how nine places should rank, from Dutch farmland to the McMurdo Dry Valleys. None is used in training. Rank correlation between the two orders:{" "}
            <Num value={v.check_sites.rank_correlation as Maybe} />. The strip below is scored live.
          </p>
          <div className="mt-3 [&_h2]:sr-only">
            <CheckOrder />
          </div>
        </section>

        <section>
          <h2>What this does not show</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-text-2">
            {v.limits.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </section>
      </article>
    </main>
  );
}
