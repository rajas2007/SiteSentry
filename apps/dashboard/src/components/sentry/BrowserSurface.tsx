import type { ReactNode } from "react";
import type { AnalysisResponse } from "../../lib/sentry";
import { cn } from "../../lib/utils";

/** Static, local-only page content used by the extension preview scenarios. */
export function SimulatedBrowserSurface({
  data,
  passwordsProtected = true,
  showProtectionNotice = false,
  modalOpen = false,
  children,
  className,
}: {
  data: AnalysisResponse;
  passwordsProtected?: boolean;
  showProtectionNotice?: boolean;
  modalOpen?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  const secureTransport = data.url.startsWith("https://");

  return (
    <div
      role="region"
      aria-label={`Simulated browser tab: ${data.hostname}`}
      className={cn(
        "relative flex h-[620px] min-w-0 flex-col overflow-hidden border border-border bg-background shadow-[0_18px_48px_rgb(0_0_0/0.24)] max-sm:h-[min(620px,70svh)] max-sm:min-h-[420px]",
        className,
      )}
    >
      <header
        aria-hidden={modalOpen || undefined}
        className="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-secondary/65 px-3"
      >
        <span className="flex shrink-0 gap-1.5" aria-hidden="true">
          <i className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
          <i className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
          <i className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
        </span>
        <div className="flex min-w-0 flex-1 items-center gap-2 border-l border-border pl-3">
          <span
            className={cn(
              "shrink-0 font-mono text-[9px] font-semibold",
              secureTransport ? "text-safe" : "text-caution",
            )}
          >
            {secureTransport ? "HTTPS" : "HTTP"}
          </span>
          <span className="min-w-0 truncate font-mono text-[10px] text-muted-foreground">
            {data.url}
          </span>
        </div>
      </header>

      <div
        aria-hidden={modalOpen || undefined}
        inert={modalOpen}
        className="blueprint-field relative min-h-0 flex-1 overflow-y-auto"
      >
        {data.threat_category === "credential_theft" ? (
          <CredentialPage
            passwordsProtected={passwordsProtected}
            showProtectionNotice={showProtectionNotice}
          />
        ) : data.severity === "LOW" ? (
          <DocumentationPage />
        ) : data.severity === "MEDIUM" ? (
          <MemberPage />
        ) : (
          <DownloadPage />
        )}
      </div>
      {children}
    </div>
  );
}

function DocumentationPage() {
  return (
    <article className="mx-auto max-w-4xl px-5 py-8 sm:px-10 sm:py-10">
      <p className="text-sm font-semibold text-heading">Documentation</p>
      <div className="mt-5 border-b border-border/60 pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-heading sm:text-3xl">
          Guides and reference
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Browse the overview, practical guides, and reference material for this example site.
        </p>
      </div>

      <div className="mt-6 grid gap-7 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-10">
        <nav aria-label="Documentation sections" className="text-sm">
          <p className="mb-3 font-medium text-heading">On this page</p>
          <ul className="space-y-2 text-muted-foreground">
            <li className="text-analysis">Overview</li>
            <li>Guides</li>
            <li>Reference</li>
          </ul>
        </nav>
        <div className="max-w-2xl space-y-5">
          <section>
            <h2 className="text-lg font-semibold text-heading">Getting started</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Start with the overview, then use the guides for common topics and the reference for
              detailed information.
            </p>
          </section>
          <section className="border-t border-border/50 pt-5">
            <h2 className="text-base font-semibold text-heading">Browse the guides</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Each guide is organized around a single topic so that relevant instructions are easy
              to find.
            </p>
          </section>
        </div>
      </div>
    </article>
  );
}

function MemberPage() {
  return (
    <article className="mx-auto max-w-4xl px-5 py-8 sm:px-10 sm:py-10">
      <p className="text-sm font-semibold text-heading">Member access</p>
      <div className="mt-5 max-w-xl">
        <h1 className="text-2xl font-semibold tracking-tight text-heading sm:text-3xl">
          Sign in to view available offers
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Enter your account details to continue to the member area.
        </p>

        <div className="mt-6 max-w-sm space-y-4" role="group" aria-label="Sample sign-in form">
          <StaticField label="Email address" />
          <StaticField label="Password" />
          <div
            className="grid min-h-10 place-items-center border border-border bg-secondary px-3 text-sm font-medium text-heading"
            aria-hidden="true"
          >
            Continue
          </div>
        </div>
      </div>
    </article>
  );
}

function StaticField({ label }: { label: string }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-heading">{label}</p>
      <div
        className="h-10 border border-border bg-background px-3 py-2.5 text-xs text-muted-foreground"
        aria-hidden="true"
      >
        {label}
      </div>
    </div>
  );
}

function CredentialPage({
  passwordsProtected,
  showProtectionNotice,
}: {
  passwordsProtected: boolean;
  showProtectionNotice: boolean;
}) {
  return (
    <article className="mx-auto max-w-4xl px-5 py-8 sm:px-10 sm:py-10">
      <div className="max-w-md border border-border/70 bg-card/80 p-5 sm:p-7">
        <p className="text-xs font-medium text-muted-foreground">Account access</p>
        <h1 className="mt-2 text-xl font-semibold text-heading">Sign in to your account</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Enter your account details to continue.
        </p>

        <label htmlFor="demo-email" className="sr-only">
          Sample email address
        </label>
        <input
          id="demo-email"
          type="email"
          readOnly
          autoComplete="off"
          className="mt-5 w-full border border-border bg-background px-3 py-2.5 text-sm text-heading placeholder:text-muted-foreground"
          placeholder="Email address"
        />
        <label htmlFor="demo-password" className="sr-only">
          Sample password
        </label>
        <input
          id="demo-password"
          type="password"
          disabled={passwordsProtected}
          readOnly
          autoComplete="off"
          placeholder={passwordsProtected ? "Protected by Site Sentry" : "Password"}
          className="mt-2 w-full border border-border bg-background px-3 py-2.5 text-sm text-heading placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:border-danger/40 disabled:bg-danger-soft"
        />

        {showProtectionNotice && passwordsProtected && (
          <p className="mt-4 border-l-2 border-danger bg-danger-soft/70 p-2.5 text-[11px] leading-relaxed text-danger">
            Password fields protected — credential theft detected. Unlock from the popup if you
            must.
          </p>
        )}
      </div>
    </article>
  );
}

function DownloadPage() {
  return (
    <article className="mx-auto max-w-4xl px-5 py-8 sm:px-10 sm:py-10">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold text-heading">HD Video Player</p>
        <div className="mt-5 grid aspect-video place-items-center border border-border/70 bg-card/55 p-5 text-center">
          <div>
            <p className="text-sm font-semibold text-heading">Playback unavailable</p>
            <p className="mt-2 text-xs text-muted-foreground">
              An update is required before this video can play.
            </p>
          </div>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">Download the codec to continue.</p>
        <div
          className="mt-3 inline-flex min-h-9 items-center border border-border bg-secondary px-3 py-2 text-xs font-medium text-heading"
          aria-hidden="true"
        >
          Download codec
        </div>
      </div>
    </article>
  );
}
