'use client';
import { ArrowUpRight, Menu, X } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { BrandWordmark } from "./primitives";

const navLinks = [
  { hash: "product-experience", label: "Product" },
  { hash: "how-it-works", label: "How it works" },
  { hash: "security", label: "Security" },
  { hash: "privacy", label: "Privacy" },
] as const;

const linkClass =
  "text-sm text-muted-foreground transition-colors hover:text-heading focus-visible:text-heading";

export function PublicSiteLayout({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only z-50 bg-background px-4 py-3 text-heading focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background">
        <div className="mx-auto flex min-h-[68px] max-w-[1360px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label="Site Sentry home" className="flex shrink-0 items-center">
            <BrandWordmark className="w-[132px] sm:w-[158px]" />
          </Link>

          <nav aria-label="Main navigation" className="hidden items-center gap-6 lg:flex">
            {navLinks.map(({ hash, label }) => (
              <Link key={hash} href="/"  className={linkClass}>
                {label}
              </Link>
            ))}
            <Link href="/console" className={linkClass}>
              Dashboard
            </Link>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              className="inline-flex min-h-10 items-center gap-2 border border-border px-3 text-xs font-medium text-heading hover:bg-secondary lg:hidden"
              aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={menuOpen}
              aria-controls="public-mobile-navigation"
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? (
                <X className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Menu className="h-4 w-4" aria-hidden="true" />
              )}
              Menu
            </button>
            <Link
              href="/extension-preview"
              className="inline-flex min-h-10 items-center gap-2 border border-analysis/55 bg-analysis px-3 text-xs font-semibold text-background transition-colors hover:bg-analysis/90 sm:px-4"
            >
              <span className="hidden sm:inline">Explore preview</span>
              <span className="sm:hidden">Preview</span>
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>

        {menuOpen && (
          <nav
            id="public-mobile-navigation"
            aria-label="Mobile navigation"
            className="border-t border-border bg-background px-4 py-3 lg:hidden"
          >
            <div className="mx-auto grid max-w-[1360px] gap-1 sm:px-2">
              {navLinks.map(({ hash, label }) => (
                <Link
                  key={hash}
                  href="/"
                  
                  className="min-h-11 border-b border-border/60 py-3 text-sm text-heading"
                  onClick={() => setMenuOpen(false)}
                >
                  {label}
                </Link>
              ))}
              <Link
                href="/console"
                className="min-h-11 border-b border-border/60 py-3 text-sm text-heading"
                onClick={() => setMenuOpen(false)}
              >
                Dashboard
              </Link>
            </div>
          </nav>
        )}
      </header>

      <main id="main-content">{children}</main>
      <SiteFooter />
    </div>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-border/80 bg-background">
      <div className="mx-auto grid max-w-[1360px] gap-9 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-[minmax(0,1.5fr)_repeat(2,minmax(0,1fr))] lg:px-8 lg:py-14">
        <div className="max-w-sm">
          <Link href="/" aria-label="Site Sentry home" className="inline-flex">
            <BrandWordmark className="w-[154px]" />
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
            Website security and trust signals, explained in a way people can use.
          </p>
        </div>

        <div>
          <h2 className="label-tech mb-3">Product</h2>
          <ul className="space-y-2.5">
            <li>
              <Link href="/extension-preview" className={linkClass}>
                Extension preview
              </Link>
            </li>
            <li>
              <Link href="/console" className={linkClass}>
                Dashboard
              </Link>
            </li>
            <li>
              <a href="/#how-it-works" className={linkClass}>
                How it works
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="label-tech mb-3">Legal</h2>
          <ul className="space-y-2.5">
            <li>
              <Link href="/privacy" className={linkClass}>
                Privacy notice status
              </Link>
            </li>
            <li>
              <Link href="/terms" className={linkClass}>
                Terms status
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border/70">
        <p className="mx-auto max-w-[1360px] px-4 py-4 text-xs leading-relaxed text-muted-foreground sm:px-6 lg:px-8">
          Public demonstrations use local sample data. They do not scan or protect a live browser
          tab.
        </p>
      </div>
    </footer>
  );
}
