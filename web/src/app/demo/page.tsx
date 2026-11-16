import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DEMO_ON } from "@/lib/demo";
import { DemoStart } from "@/components/demo/demo-start";

export const metadata: Metadata = { title: "Demo" };

// the start screen for the recorded tour; not part of the public site
export default function Page() {
  if (!DEMO_ON) notFound();
  return <DemoStart />;
}
