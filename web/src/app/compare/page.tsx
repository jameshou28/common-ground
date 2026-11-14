import type { Metadata } from "next";
import { Suspense } from "react";
import { CompareView } from "@/components/compare/compare-view";

export const metadata: Metadata = { title: "Compare" };

export default function Page() {
  // the ?tiles= and ?target= params need a suspense boundary
  return (
    <Suspense fallback={<main className="flex-1" />}>
      <CompareView />
    </Suspense>
  );
}
