import Link from "next/link";
import { SiteList } from "@/components/explore/site-list";

export default function Home() {
  return (
    <aside aria-label="Explore" className="min-h-0 overflow-y-auto border-l border-line bg-panel max-md:border-t max-md:border-l-0">
      <div className="border-b border-line p-4">
        <h1 className="text-xl leading-tight font-semibold">Where on Earth is like this?</h1>
        <p className="mt-2 text-text-2">
          Click any land on Earth. The 4 km block under the click is scored against the Moon and Mars targets, with the reasons.
        </p>
        <p className="mt-3 flex items-center gap-3 text-text-2">
          <Link href="/best" className="inline-flex h-7 shrink-0 items-center rounded-md whitespace-nowrap bg-brand px-3 font-semibold text-on-brand hover:bg-brand-hover hover:no-underline">
            Best sites
          </Link>
          or start from the places the model already found
        </p>
      </div>
      <SiteList />
    </aside>
  );
}
