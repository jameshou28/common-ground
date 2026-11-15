import { Suspense } from "react";
import { ExploreShell } from "@/components/explore/explore-shell";

export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  // the ?world= param needs a suspense boundary
  return (
    <Suspense fallback={<div className="sky flex-1" />}>
      <ExploreShell>{children}</ExploreShell>
    </Suspense>
  );
}
