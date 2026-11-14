import type { Metadata } from "next";

export const metadata: Metadata = { title: "About" };

// content is back before submission
export default function Page() {
  return (
    <main className="flex-1 overflow-y-auto p-6">
      <h1 className="mx-auto max-w-3xl text-xl leading-tight font-semibold">About</h1>
    </main>
  );
}
