import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import localFont from "next/font/local";
import { Suspense } from "react";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { Header } from "@/components/shell/header";
import { Providers } from "@/components/shell/providers";
import { StatusBar } from "@/components/shell/status-bar";

// the site font, self-hosted by next at build time (no request to google from the browser)
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk", display: "swap" });
// the display face for the wordmark and the title over the globe
const anurati = localFont({ src: "../fonts/Anurati-Regular.otf", variable: "--font-anurati", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Common Ground", template: "%s · Common Ground" },
  description:
    "Click anywhere on Earth and see how much the ground there looks like the Moon or Mars, and why.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${anurati.variable} h-full antialiased`}>
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
