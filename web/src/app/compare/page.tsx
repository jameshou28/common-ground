import type { Metadata } from "next";
import { PageStub } from "@/components/shell/page-stub";

export const metadata: Metadata = { title: "Compare" };

export default function Page() {
  return <PageStub title="Compare">Compare blocks side by side.</PageStub>;
}
