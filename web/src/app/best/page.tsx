import type { Metadata } from "next";
import { Suspense } from "react";
import { BestSites } from "@/components/best/best-sites";

export const metadata: Metadata = { title: "Best sites" };

export default function Page() {
  // the ?tab= and ?region= params need a suspense boundary
  return (
    <Suspense fallback={<main className="flex-1" />}>
      <BestSites />
    </Suspense>
  );
}
