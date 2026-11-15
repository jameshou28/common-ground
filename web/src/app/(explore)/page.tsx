import Link from "next/link";
import { SiteList } from "@/components/explore/site-list";

export default function Home() {
  return (
    <aside aria-label="Explore" className="min-h-0 overflow-y-auto border-l border-line bg-panel max-md:border-t max-md:border-l-0">
      <div className="border-b border-line p-4">
        <h1 className="text-xl leading-tight font-semibold">Where on Earth is like this?</h1>
        <p className="mt-2 text-text-2">
          Click any land on the globe, or{" "}
          <Link href="/best" className="text-brand underline underline-offset-2">
            start from the best sites
          </Link>
          .
        </p>
      </div>
      <SiteList />
    </aside>
  );
}
