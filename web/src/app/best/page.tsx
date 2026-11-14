import type { Metadata } from "next";
import { PageStub } from "@/components/shell/page-stub";

export const metadata: Metadata = { title: "Best sites" };

export default function Page() {
  return <PageStub title="Best sites">The best Earth sites the model found for each target.</PageStub>;
}
