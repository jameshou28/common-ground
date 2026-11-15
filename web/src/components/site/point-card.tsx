import type { CellPoint } from "@/lib/regions";
import { fmtPoints } from "@/lib/format";

const ORD = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth"];
const where = (row: number, col: number) => `${ORD[row]} row from the north, ${ORD[col]} column from the west`;

const TITLE: Record<CellPoint["effect"], [title: string, tag: string, cls: string]> = {
  help: ["Close match", "Helps", "text-help"],
  weak: ["Weaker match", "Helps a little", "text-text-2"],
  hurt: ["Poor match", "Hurts", "text-hurt"],
};

// points to two decimals: one cell's share is small
const fmtCell = (v: number) => `${v < 0 ? "−" : "+"}${Math.abs(v).toFixed(2)}`;

export function PointCard({ point, id, matchName }: { point: CellPoint; id: string; matchName: string }) {
  const [title, tag, cls] = TITLE[point.effect];
  const scored = point.points != null;
  return (
    <div
      id={id}
      role="group"
      aria-label={title}
      className="pointer-events-auto w-64 rounded-md border border-line bg-panel p-3 text-xs shadow-lg"
    >
      <h3 className="flex items-baseline justify-between gap-2 text-[13px] font-semibold">
        {title}
        <span className={`font-normal ${cls}`}>{tag}</span>
      </h3>
      <p className="mt-1 text-text-2">
        {scored
          ? `This 500 m cell's share of the score against ${matchName}, from how well it lines up with the cell it was paired with.`
          : `This 500 m cell ${point.effect === "help" ? "looks a lot like" : "looks little like"} the part of ${matchName} it was paired with.`}
      </p>
      <dl className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5">
        {scored && (
          <>
            <dt className="text-text-2">Effect</dt>
            <dd className="text-right">{fmtCell(point.points!)} points</dd>
            {point.total != null && (
              <>
                <dt className="text-text-2">All 64 cells</dt>
                <dd className="text-right">{fmtPoints(point.total)} points</dd>
              </>
            )}
          </>
        )}
        <dt className="text-text-2">Mismatch</dt>
        <dd className="text-right">{point.ratio.toFixed(1)}× the block average</dd>
        <dt className="text-text-2">Cell</dt>
        <dd className="text-right">{where(point.row, point.col)}</dd>
        {point.partner && (
          <>
            <dt className="text-text-2">Paired with</dt>
            <dd className="text-right">{where(point.partner.row, point.partner.col)}</dd>
          </>
        )}
      </dl>
    </div>
  );
}
