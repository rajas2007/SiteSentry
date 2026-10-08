import { ArrowRight, ExternalLink, LockKeyhole, Radar } from "lucide-react";
import Link from "next/link";
import { cn } from "../../lib/utils";
import { sampleAnalyses } from "../../lib/sentry";
import { SimulatedBrowserSurface } from "./BrowserSurface";
import { ExtensionPopup, type PopupControls } from "./ExtensionPopup";
import { RiskBadge, RiskMascot, ScoreRing } from "./primitives";

const passiveControls: PopupControls = {
  overlayDismissed: false,
  passwordsUnlocked: false,
  acknowledged: false,
  onRetry: () => {},
  onLeave: () => {},
  onContinueAnyway: () => {},
  onReopenWarning: () => {},
  onUnlockPasswords: () => {},
  onRestoreProtection: () => {},
  onAcknowledge: () => {},
};

export function LandingExtensionDemo() {
  const data = sampleAnalyses[0]!;

  return (
    <figure id="product-demo" className="mx-auto w-full max-w-[410px] min-w-0">
      <div className="mb-2 flex items-center justify-between gap-3 border-b border-border/65 pb-2">
        <p className="label-tech">Browser extension</p>
        <p className="font-mono text-[10px] text-muted-foreground">LOCAL FIXTURE · 01</p>
      </div>
      <div className="border border-border/80 bg-card p-2 sm:p-3">
        <ExtensionPopup state={{ kind: "ready", data }} controls={passiveControls} />
      </div>
      <figcaption className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-safe" aria-hidden="true" />
        Example result for {data.hostname}. The score and signals come from a project fixture, not a
        live scan.
      </figcaption>
    </figure>
  );
}

function signalTone(impact: "positive" | "neutral" | "negative") {
  return impact === "positive"
    ? "text-safe"
    : impact === "negative"
      ? "text-danger"
      : "text-muted-foreground";
}

export function ExplainabilityDemo() {
  const data = sampleAnalyses[1]!;

  return (
    <figure className="border-y border-border/80 py-6 sm:py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="label-tech">Why this score?</p>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
            SAMPLE FIXTURE · {data.analysis_id}
          </p>
        </div>
        <span className="inline-flex items-center gap-2 border border-border/75 px-2.5 py-1 font-mono text-[10px] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-analysis" aria-hidden="true" />
          Example only · not a live scan
        </span>
      </div>

      <div className="grid gap-7 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
        <div className="flex flex-col items-center border-b border-border/55 pb-6 lg:items-start lg:border-b-0 lg:border-r lg:pb-0 lg:pr-8">
          <ScoreRing score={data.score} severity={data.severity} size={170} showRanges={false} />
          <div className="mt-2 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
            <RiskBadge severity={data.severity} />
            <span className="font-mono text-xs text-muted-foreground">
              {Math.round(data.confidence * 100)}% confidence
            </span>
          </div>
          <div className="mt-4 flex items-center gap-3 border-l-2 border-caution/70 pl-3">
            <RiskMascot severity={data.severity} scale="supporting" className="h-10 w-10" />
            <p className="max-w-[180px] text-sm font-medium leading-relaxed text-heading">
              {data.decision.message}
            </p>
          </div>
        </div>

        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-heading">Signals behind the 64-point result</h3>
          <ul className="mt-3 divide-y divide-border/55">
            {data.factors.map((factor: any) => (
              <li
                key={factor.name}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 py-2.5 text-xs"
              >
                <span className="text-foreground">{factor.name}</span>
                <span
                  className={cn(
                    "max-w-[190px] text-right font-mono leading-relaxed",
                    signalTone(factor.impact),
                  )}
                >
                  {factor.value}
                  <span className="sr-only">, {factor.impact} signal</span>
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-5 grid gap-5 border-t border-border/60 pt-4 sm:grid-cols-2">
            <div>
              <h4 className="label-tech mb-2 flex items-center gap-2">
                <Radar className="h-3.5 w-3.5 text-analysis" aria-hidden="true" />
                Threat intelligence
              </h4>
              <dl className="space-y-2 text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Google Safe Browsing</dt>
                  <dd className="text-right text-heading">
                    {data.threat_intelligence.google_safe_browsing}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">VirusTotal</dt>
                  <dd className="text-right font-mono text-heading">
                    {data.threat_intelligence.virustotal}
                  </dd>
                </div>
              </dl>
            </div>
            <div>
              <h4 className="label-tech mb-2">Privacy signals</h4>
              <ul className="space-y-1.5 text-xs leading-relaxed text-muted-foreground">
                {data.privacy.notes.map((note: any) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="mt-5 text-xs leading-relaxed text-muted-foreground">
        Values are taken from the {data.hostname} sample analysis. A score is more useful when its
        supporting signals are visible.
      </figcaption>
    </figure>
  );
}

export function CredentialProtectionDemo() {
  const data = sampleAnalyses[2]!;
  const concernFactors = data.factors.filter((factor: any) => factor.impact === "negative");

  return (
    <div className="grid min-w-0 gap-7 lg:grid-cols-[minmax(0,1.05fr)_minmax(330px,0.95fr)] lg:items-center lg:gap-10">
      <div className="min-w-0">
        <SimulatedBrowserSurface
          data={data}
          passwordsProtected
          showProtectionNotice
          className="h-[440px] max-sm:h-[min(440px,68svh)] max-sm:min-h-[340px]"
        />
        <p className="mt-2 flex items-center gap-2 text-xs leading-relaxed text-muted-foreground">
          <LockKeyhole className="h-3.5 w-3.5 shrink-0 text-danger" aria-hidden="true" />
          The sample password field is disabled in this local demonstration.
        </p>
      </div>

      <div className="min-w-0 border-l-2 border-danger/70 pl-5 sm:pl-7">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <RiskBadge severity={data.severity} />
            <p className="mt-3 text-xs font-medium text-danger">
              Site Sentry detected a serious risk.
            </p>
          </div>
          <ScoreRing score={data.score} severity={data.severity} size={96} showRanges={false} />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <RiskMascot severity={data.severity} scale="supporting" className="h-14 w-14 shrink-0" />
          <div className="min-w-0">
            <h3 className="text-xl font-semibold leading-snug tracking-tight text-heading sm:text-2xl">
              Credential theft detected.
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              This site may put your information at risk.
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2.5 border-l-2 border-danger bg-danger-soft/45 px-3 py-2.5 text-xs leading-relaxed text-heading">
          <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
          <span>Password fields are protected in this simulated preview.</span>
        </div>

        <h4 className="mt-5 text-sm font-semibold text-heading">Why Site Sentry stepped in</h4>
        <ul className="mt-2 divide-y divide-border/60 border-y border-border/60">
          {concernFactors.map((factor: any) => (
            <li key={factor.name} className="flex justify-between gap-4 py-2.5 text-xs">
              <span className="text-heading">{factor.name}</span>
              <span className="text-right font-mono text-danger">{factor.value}</span>
            </li>
          ))}
        </ul>

        <dl className="mt-4 grid grid-cols-2 gap-3 border-b border-border/60 pb-4 text-xs">
          <div className="min-w-0">
            <dt className="text-muted-foreground">Google Safe Browsing</dt>
            <dd className="mt-1 break-words font-mono text-heading">
              {data.threat_intelligence.google_safe_browsing}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-muted-foreground">VirusTotal</dt>
            <dd className="mt-1 break-words font-mono text-heading">
              {data.threat_intelligence.virustotal}
            </dd>
          </div>
        </dl>

        <div aria-hidden="true" className="mt-4 grid grid-cols-2 gap-2">
          <span className="inline-flex min-h-10 items-center justify-center border border-danger/55 bg-danger px-3 text-xs font-semibold text-destructive-foreground">
            Leave Site
          </span>
          <span className="inline-flex min-h-10 items-center justify-center border border-border bg-secondary px-3 text-xs font-medium text-heading">
            Continue Anyway
          </span>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          Illustrative controls only. This page does not affect a real tab or handle real
          credentials.
        </p>
        <Link
          href="/extension-preview"
          
          className="mt-4 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-analysis hover:text-heading"
        >
          Explore the interactive extension preview
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

export function DashboardPreview() {
  return (
    <figure className="min-w-0 border border-border/80 bg-background">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-3 py-3 sm:px-4">
        <div>
          <p className="label-tech">Site Sentry Security Console</p>
          <p className="mt-1 text-xs text-muted-foreground">Actual dashboard route · sample data</p>
        </div>
        <Link
          href="/console"
          className="inline-flex min-h-9 items-center gap-2 border border-border px-3 text-xs font-medium text-heading hover:bg-secondary"
        >
          Open dashboard
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
      <iframe
        src="/console"
        title="Site Sentry dashboard overview preview, showing a sample 64 out of 100 assessment"
        loading="lazy"
        className="h-[560px] w-full border-0 bg-background sm:h-[680px]"
      />
      <figcaption className="border-t border-border/70 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground sm:px-4">
        The embedded interface is the existing dashboard. Its records and scores are local fixtures,
        not live browsing history.
      </figcaption>
    </figure>
  );
}
