import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Analog Explorer", template: "%s · Analog Explorer" },
  description:
    "Click a 4 km block on Earth and see how well it stands in for a Moon-base or Mars target, and why.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
