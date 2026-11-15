import { ExampleSites } from "@/components/explore/example-sites";

export default function Home() {
  return (
    <aside aria-label="Explore" className="min-h-0 overflow-y-auto border-l border-line bg-panel max-md:border-t max-md:border-l-0">
      <ExampleSites />
    </aside>
  );
}
