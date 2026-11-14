import type { Metadata } from "next";
import { SiteResult } from "@/components/site/site-result";

export const metadata: Metadata = { title: "Result" };

export default function Page() {
  return <SiteResult />;
}
