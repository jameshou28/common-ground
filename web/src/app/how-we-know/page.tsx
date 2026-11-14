import type { Metadata } from "next";
import { PageStub } from "@/components/shell/page-stub";

export const metadata: Metadata = { title: "How we know" };

export default function Page() {
  return <PageStub title="How we know">How the score is validated.</PageStub>;
}
