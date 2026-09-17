"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { HuskMark, HuskWordmark } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DOCS_URL, REPO_URL } from "@/lib/content";

/**
 * Docs is external until the docs site has a domain: `DOCS_URL` resolves to the
 * repository README today and to docs.<domain> the day NEXT_PUBLIC_SITE_URL is
 * set for `apps/docs`. One constant, so the nav follows without an edit here.
 */
const NAV = [
  { href: "/manifesto", label: "Manifesto" },
  { href: "/pricing", label: "Pricing" },
];

const NAV_EXTERNAL = [{ href: DOCS_URL, label: "Docs" }];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="site-header">
      <div className="container site-header-inner">
        <Link href="/" className="lockup" aria-label="Husk, home">
          <HuskMark size={26} />
          <HuskWordmark height={16} />
        </Link>

        <nav className="site-nav" aria-label="Main">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="nav-link"
              aria-current={pathname === item.href ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
          {NAV_EXTERNAL.map((item) => (
            <a
              key={item.label}
              className="nav-link"
              href={item.href}
              rel="noreferrer noopener"
            >
              {item.label}
            </a>
          ))}
          <a
            className="nav-link nav-hide-sm"
            href={REPO_URL}
            rel="noreferrer noopener"
          >
            Source
          </a>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
