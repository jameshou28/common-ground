import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { Header } from "@/components/shell/header";
import { Providers } from "@/components/shell/providers";
import { StatusBar } from "@/components/shell/status-bar";

export const metadata: Metadata = {
  title: { default: "Analog Explorer", template: "%s · Analog Explorer" },
  description:
    "Click a 4 km block on Earth and see how well it stands in for a Moon-base or Mars target, and why.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex h-full flex-col">
        <Providers>
          {/* usepathname needs a suspense boundary */}
          <Suspense fallback={<div className="h-11 shrink-0 border-b border-line bg-panel" />}>
            <Header />
          </Suspense>
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
          <StatusBar />
        </Providers>
      </body>
    </html>
  );
}
