// one collapsible block of the result panel
export function Section({ title, note, open = true, children }: { title: string; note?: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details open={open} className="group border-b border-line">
      <summary className="flex cursor-pointer list-none items-baseline justify-between px-4 py-2.5 font-semibold hover:bg-hover [&::-webkit-details-marker]:hidden">
        <span>
          <span aria-hidden className="mr-1.5 inline-block text-text-2 transition-transform group-open:rotate-90">
            ›
          </span>
          {title}
        </span>
        {note && <span className="text-xs font-normal text-text-2">{note}</span>}
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  );
}
