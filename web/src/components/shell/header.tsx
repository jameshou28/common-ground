"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CHECK_SITES } from "@/lib/sites";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/best", label: "Best sites" },
  { href: "/how-we-know", label: "How we know" },
  { href: "/about", label: "About" },
] as const;

const Sep = () => <span aria-hidden className="text-text-2 opacity-50">/</span>;

// breadcrumb from the path: a result page shows the place under explore
function Crumbs({ path }: { path: string }) {
  if (path.startsWith("/site/")) {
    const tileId = decodeURIComponent(path.slice(6).split("/")[0]);
    const site = CHECK_SITES.find((s) => s.tileId === tileId);
    return (
      <>
        <Sep />
        <Link href="/" className="text-text-2 hover:text-text">Explore</Link>
        <Sep />
        <span className="truncate text-text">{site?.name ?? "Clicked block"}</span>
        {site && <span className="truncate text-text-2 max-sm:hidden">{site.region}</span>}
      </>
    );
  }
  const page = NAV.find((n) => n.href !== "/" && (path === n.href || path.startsWith(`${n.href}/`)));
  return (
    <>
      <Sep />
      <span className="text-text">{page?.label ?? "Explore"}</span>
    </>
  );
}

export function Header() {
  const path = usePathname();
  return (
    <header className="flex h-12 shrink-0 items-center gap-6 border-b border-line bg-panel px-5 max-md:h-auto max-md:flex-wrap max-md:gap-y-1 max-md:px-4 max-md:py-2">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-baseline gap-2.5 text-sm whitespace-nowrap">
        <Link href="/" className="font-semibold text-text">
          Common Ground
        </Link>
        <Crumbs path={path} />
      </nav>
      <nav aria-label="Main" className="ml-auto flex gap-6 overflow-x-auto text-sm max-md:ml-0 max-md:w-full">
        {NAV.map(({ href, label }) => {
          const on = href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={on ? "page" : undefined}
              className={cn("whitespace-nowrap text-text-2 hover:text-text hover:no-underline", on && "text-text")}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
