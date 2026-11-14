import type { Metadata } from "next";
import { PageStub } from "@/components/shell/page-stub";

export const metadata: Metadata = { title: "Result" };

export default function Page() {
  return <PageStub title="Result">A scored block.</PageStub>;
}
