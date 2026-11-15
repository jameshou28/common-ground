"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CHECK_SITES } from "@/lib/sites";
import { cn } from "@/lib/utils";

// left: the app's own pages as a trail (Common Ground / Explore / Best sites). right: the reading pages
const NAV = [
  { href: "/how-we-know", label: "How we know" },
  { href: "/about", label: "About" },
] as const;

const Sep = () => <span aria-hidden className="text-text-2 opacity-50">/</span>;

function Crumb({ href, label, on }: { href: string; label: string; on: boolean }) {
  return (
    <Link href={href} aria-current={on ? "page" : undefined} className={cn("hover:text-text hover:no-underline", on ? "text-text" : "text-text-2")}>
      {label}
    </Link>
  );
}

// Common Ground / Explore / Best sites, with the place's name after Explore on a result page
function Crumbs({ path }: { path: string }) {
  const site = path.startsWith("/site/") ? CHECK_SITES.find((s) => s.tileId === decodeURIComponent(path.slice(6).split("/")[0])) : undefined;
  const onSite = path.startsWith("/site/");
  return (
    <>
      <Sep />
      <Crumb href="/" label="Explore" on={path === "/" || onSite} />
      {onSite && (
        <>
          <Sep />
          <span className="truncate text-text">{site?.name ?? "Clicked block"}</span>
        </>
      )}
      <Sep />
      <Crumb href="/best" label="Best sites" on={path === "/best" || path.startsWith("/best/")} />
    </>
  );
}

export function Header() {
  const path = usePathname();
  return (
    <header className="flex h-12 shrink-0 items-center gap-6 border-b border-line bg-panel px-5 max-md:h-auto max-md:flex-wrap max-md:gap-y-1 max-md:px-4 max-md:py-2">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-baseline gap-2.5 text-sm whitespace-nowrap">
        <Link href="/" className="font-semibold text-text hover:no-underline">
          Common Ground
        </Link>
        <Crumbs path={path} />
      </nav>
      <nav aria-label="Main" className="ml-auto flex items-baseline gap-2.5 overflow-x-auto text-sm max-md:ml-0 max-md:w-full">
        {NAV.map(({ href, label }, k) => {
          const on = path === href || path.startsWith(`${href}/`);
          return (
            <span key={href} className="flex items-baseline gap-2.5">
              {k > 0 && <Sep />}
              <Link
                href={href}
                aria-current={on ? "page" : undefined}
                className={cn("whitespace-nowrap text-text-2 hover:text-text hover:no-underline", on && "text-text")}
              >
                {label}
              </Link>
            </span>
          );
        })}
      </nav>
    </header>
  );
}
