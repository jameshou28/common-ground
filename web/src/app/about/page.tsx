import type { Metadata } from "next";
import { PageStub } from "@/components/shell/page-stub";

export const metadata: Metadata = { title: "About" };

export default function Page() {
  return <PageStub title="About">Data credits and disclosure.</PageStub>;
}
