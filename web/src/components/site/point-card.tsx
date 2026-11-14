import type { CellPoint } from "@/lib/regions";

const ORD = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth"];
const where = (row: number, col: number) => `${ORD[row]} row from the north, ${ORD[col]} column from the west`;

export function PointCard({ point, id, matchName }: { point: CellPoint; id: string; matchName: string }) {
  const help = point.effect === "help";
  return (
    <div
      id={id}
      role="group"
      aria-label={help ? "A close match" : "A poor match"}
      className="pointer-events-auto absolute bottom-4 left-4 w-64 rounded-md border border-line bg-panel p-3 text-xs shadow-lg group-data-[below]:top-4 group-data-[below]:bottom-auto group-data-[flip]:right-4 group-data-[flip]:left-auto"
    >
      <h3 className="flex items-baseline justify-between gap-2 text-[13px] font-semibold">
        {help ? "Close match" : "Poor match"}
        <span className={help ? "font-normal text-help" : "font-normal text-hurt"}>{help ? "Helps" : "Hurts"}</span>
      </h3>
      <p className="mt-1 text-text-2">
        This 500 m cell {help ? "looks a lot like" : "looks little like"} the part of {matchName} it was paired with.
      </p>
      <dl className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5">
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
