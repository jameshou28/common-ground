"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Explore" },
  { href: "/best", label: "Best sites" },
  { href: "/compare", label: "Compare" },
  { href: "/how-we-know", label: "How we know" },
  { href: "/about", label: "About" },
] as const;

// result pages belong to explore
const isActive = (path: string, href: string) =>
  href === "/" ? path === "/" || path.startsWith("/site/") : path === href || path.startsWith(`${href}/`);

export function Header({ children }: { children?: React.ReactNode }) {
  const path = usePathname();
  return (
    <header className="flex h-11 shrink-0 items-center gap-5 border-b border-line bg-panel pr-3 pl-3.5">
      <Link href="/" className="text-sm font-semibold whitespace-nowrap text-text">
        Common Ground
      </Link>
      <nav aria-label="Main" className="flex h-full min-w-0 overflow-x-auto">
        {NAV.map(({ href, label }) => {
          const on = isActive(path, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={on ? "page" : undefined}
              className={cn(
                "flex items-center border-y-2 border-transparent px-3 whitespace-nowrap text-text-2 hover:text-text",
                on && "border-b-brand text-text",
              )}
            >
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="ml-auto flex items-center gap-2">{children}</div>
    </header>
  );
}
