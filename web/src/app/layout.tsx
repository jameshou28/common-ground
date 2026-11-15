import type { Metadata } from "next";
import { Suspense } from "react";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { Header } from "@/components/shell/header";
import { Providers } from "@/components/shell/providers";
import { StatusBar } from "@/components/shell/status-bar";

export const metadata: Metadata = {
  title: { default: "Analog Explorer", template: "%s · Analog Explorer" },
  description:
    "Click anywhere on Earth and see how much the ground there looks like the Moon or Mars, and why.",
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
        <Analytics />
      </body>
    </html>
  );
}
