import { Check, ExternalLink, Lock, LockOpen, Minus, Radar, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { cn } from "../../lib/utils";
import { formatCategory, severityStyle, type AnalysisResponse, type Factor } from "../../lib/sentry";
import { Logo, PendingScoreDial, RiskBadge, RiskMascot, ScoreRing } from "./primitives";



export type PopupState =
  { kind: "ready"; data: AnalysisResponse } | { kind: "loading" } | { kind: "offline" };

function FactorRow({ f }: { f: Factor }) {
  const Icon = f.impact === "positive" ? Check : f.impact === "negative" ? X : Minus;
  const tone =
    f.impact === "positive"
      ? "text-safe"
      : f.impact === "negative"
        ? "text-danger"
        : "text-muted-foreground";

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 py-1.5">
      <span className="flex min-w-0 items-center gap-2 text-xs">
        <Icon className={cn("h-3.5 w-3.5 shrink-0", tone)} aria-hidden="true" />
        <span>{f.name}</span>
      </span>
      <span className="max-w-[140px] text-right font-mono text-[10px] leading-relaxed text-heading">
        {f.value}
      </span>
    </li>
  );
}

function Header() {
  return (
    <header className="flex shrink-0 items-center border-b border-border bg-background px-4 py-3 text-primary-foreground">
      <div className="flex items-center gap-3 border-l border-analysis/55 pl-3">
        <Logo className="h-8 w-8 shrink-0" />
        <p className="text-sm font-semibold tracking-wide text-heading">Site Sentry</p>
      </div>
    </header>
  );
}

const SectionTitle = ({ children }: { children: string }) => (
  <h3 className="mb-3 text-sm font-semibold text-heading">{children}</h3>
);

const riskAtmosphereClass: Record<AnalysisResponse["severity"], string> = {
  LOW: "risk-tone-low",
  MEDIUM: "risk-tone-medium",
  HIGH: "risk-tone-high",
};

export interface PopupControls {
  overlayDismissed: boolean;
  passwordsUnlocked: boolean;
  acknowledged: boolean;
  onRetry: () => void;
  onLeave: () => void;
  onContinueAnyway: () => void;
  onReopenWarning: () => void;
  onUnlockPasswords: () => void;
  onRestoreProtection: () => void;
  onAcknowledge: () => void;
}

const actionBase =
  "inline-flex min-h-10 flex-1 items-center justify-center gap-2 border px-3 py-2 text-xs font-medium transition-colors";
const actionPrimary = `${actionBase} border-analysis/40 bg-analysis-soft text-heading hover:bg-secondary`;
const actionCaution = `${actionBase} border-caution/45 bg-caution-soft text-heading hover:bg-caution/15`;
const actionOutline = `${actionBase} border-border bg-background text-heading hover:bg-secondary`;
const actionDanger = `${actionBase} border-danger/60 bg-danger text-destructive-foreground hover:bg-danger/90`;

export function ExtensionPopup({
  state,
  controls,
}: {
  state: PopupState;
  controls: PopupControls;
}) {
  return (
    <div className="mx-auto flex h-[620px] w-full min-w-0 max-w-[380px] flex-col overflow-hidden border border-border bg-card shadow-[0_18px_48px_rgb(0_0_0/0.3)] max-sm:h-[min(620px,70svh)] max-sm:min-h-[420px]">
      <Header />
      <div className="min-h-0 flex-1 overflow-y-auto bg-background/55">
        {state.kind === "loading" && (
          <div className="blueprint-field flex h-full flex-col justify-center p-4 sm:p-5">
            <div className="mx-auto grid w-full max-w-[340px] grid-cols-[minmax(0,1fr)_92px] items-center gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <img
                  src="/Site-Sentry-assests/site-sentry-mascot-analyzing.png"
                  alt=""
                  aria-hidden="true"
                  className="h-[68px] w-[68px] shrink-0 object-contain"
                />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-analysis">Security analysis</p>
                  <p className="mt-1.5 text-sm font-semibold leading-snug text-heading">
                    Analyzing this page…
                  </p>
                </div>
              </div>
              <PendingScoreDial size={92} />
            </div>
            <div className="mx-auto mt-4 w-full max-w-[340px]">
              <p className="text-center text-xs leading-relaxed text-muted-foreground">
                No result is shown until the analysis completes.
              </p>
              <div className="scan-track mt-4 h-px w-full" aria-hidden="true" />
            </div>
          </div>
        )}
        {state.kind === "offline" && (
          <div className="blueprint-field flex h-full flex-col items-center justify-center gap-4 p-7 text-center">
            <img
              src="/Site-Sentry-assests/site-sentry-mascot-offline.png"
              alt=""
              aria-hidden="true"
              className="h-[88px] w-[88px] object-contain"
            />
            <div className="max-w-[275px]">
              <p className="text-base font-semibold text-heading">Analysis unavailable</p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                The Site Sentry backend could not be reached. No risk score has been produced and no
                intervention will be triggered for this page.
              </p>
            </div>
            <button
              type="button"
              onClick={controls.onRetry}
              className={`${actionPrimary} max-w-[220px] flex-none`}
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Retry analysis
            </button>
          </div>
        )}
        {state.kind === "ready" && <Result data={state.data} c={controls} />}
      </div>
      <footer className="flex-none border-t border-border bg-background">
        {state.kind === "ready" && <Actions data={state.data} c={controls} />}
        <p className="border-t border-border/70 px-3 py-2 text-center font-mono text-[9px] text-muted-foreground">
          Demo preview · no live protection
        </p>
      </footer>
    </div>
  );
}

function Result({ data, c }: { data: AnalysisResponse; c: PopupControls }) {
  const tone = severityStyle[data.severity];
  const riskFactors = data.factors.filter((factor) => factor.impact === "negative");

  return (
    <div className="min-h-full">
      <section
        className={cn(
          "assessment-composition risk-atmosphere border-b border-border/55 px-4 py-5",
          riskAtmosphereClass[data.severity],
        )}
        aria-label="Website security assessment"
      >
        <div className="mx-auto max-w-[340px]">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <p className="min-w-0 flex-1 break-all font-mono text-[13px] font-medium leading-relaxed text-heading">
              {data.hostname}
            </p>
            <RiskBadge severity={data.severity} className="shrink-0" />
          </div>

          <div className="flex justify-center py-1">
            <ScoreRing
              key={data.analysis_id}
              score={data.score}
              severity={data.severity}
              size={164}
              showRanges={false}
            />
          </div>

          <div className={cn("flex items-center gap-3 border-l-2 pl-3", tone.border)}>
            <RiskMascot severity={data.severity} scale="supporting" className="h-12 w-12" />
            <p className={cn("min-w-0 text-sm font-semibold leading-snug", tone.text)}>
              {data.decision.message}
            </p>
          </div>
        </div>
      </section>

      <section className="px-4 py-3.5">
        <SectionTitle>Why this result?</SectionTitle>
        <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
          {riskFactors.length > 0
            ? `${riskFactors.length} security concern${riskFactors.length === 1 ? "" : "s"} contributed to this result.`
            : "No negative security factors were reported for this sample."}
        </p>
        {riskFactors.length > 0 && (
          <ul className="space-y-2">
            {riskFactors.map((factor) => (
              <li
                key={factor.name}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-border/55 pb-2 text-xs last:border-b-0"
              >
                <span className="text-heading">{factor.name}</span>
                <span className="max-w-[145px] text-right font-mono text-[10px] leading-relaxed text-danger">
                  {factor.value}
                </span>
              </li>
            ))}
          </ul>
        )}

        {data.privacy.notes.length > 0 && (
          <div className="mt-4 border-l border-analysis/35 pl-3.5">
            <h4 className="text-xs font-semibold text-heading">Privacy signals</h4>
            <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
              {data.privacy.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        )}

        <details className="mt-4 border-t border-border/65 pt-3">
          <summary className="cursor-pointer text-xs font-semibold text-heading marker:text-analysis">
            Threat intelligence and technical details
          </summary>
          <div className="mt-3 space-y-4">
            <div>
              <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold text-heading">
                <Radar className="h-3.5 w-3.5 text-analysis" aria-hidden="true" />
                Threat intelligence
              </h4>
              <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 text-xs">
                <dt className="text-muted-foreground">Google Safe Browsing</dt>
                <dd className="max-w-[145px] text-right font-mono text-[10px] text-heading">
                  {data.threat_intelligence.google_safe_browsing}
                </dd>
                <dt className="text-muted-foreground">VirusTotal</dt>
                <dd className="max-w-[145px] text-right font-mono text-[10px] text-heading">
                  {data.threat_intelligence.virustotal}
                </dd>
                <dt className="text-muted-foreground">Threat category</dt>
                <dd className="max-w-[145px] text-right font-mono text-[10px] text-heading">
                  {formatCategory(data.threat_category)}
                </dd>
              </dl>
            </div>
            <div>
              <h4 className="mb-1 text-xs font-semibold text-heading">All security factors</h4>
              <ul>
                {data.factors.map((factor) => (
                  <FactorRow key={factor.name} f={factor} />
                ))}
              </ul>
            </div>
          </div>
        </details>

        <div className="mt-5">
          <SectionTitle>Recommendations</SectionTitle>
          <ul className="space-y-2">
            {data.recommendations.map((recommendation) => (
              <li
                key={recommendation}
                className="flex gap-2.5 text-xs leading-relaxed text-heading"
              >
                <span className="mt-1.5 h-px w-3 shrink-0 bg-analysis/60" aria-hidden="true" />
                {recommendation}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

function Actions({ data, c }: { data: AnalysisResponse; c: PopupControls }) {
  const details = (
    <Link href="/console" className={`${actionOutline} min-h-9 flex-none`}>
      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
      View full analysis
    </Link>
  );

  if (data.severity === "LOW") {
    return <div className="px-3 py-2.5">{details}</div>;
  }

  if (data.severity === "MEDIUM") {
    return (
      <div className="space-y-2 px-3 py-2.5">
        {c.acknowledged ? (
          <p className="border-l-2 border-caution bg-caution-soft px-2.5 py-2 text-[11px] text-caution">
            Caution acknowledged. Browsing is permitted.
          </p>
        ) : (
          <div className="flex gap-2">
            <button type="button" onClick={c.onLeave} className={actionOutline}>
              Leave Site
            </button>
            <button type="button" onClick={c.onAcknowledge} className={actionCaution}>
              I understand, continue
            </button>
          </div>
        )}
        {details}
      </div>
    );
  }

  return (
    <div className="space-y-2 px-3 py-2.5">
      {data.threat_category === "credential_theft" && (
        <div
          className={cn(
            "flex items-center justify-between gap-2 border-l-2 px-2.5 py-2",
            c.passwordsUnlocked
              ? "border-caution bg-caution-soft/75"
              : "border-danger bg-danger-soft/75",
          )}
        >
          <div className="flex min-w-0 items-start gap-2">
            {c.passwordsUnlocked ? (
              <LockOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-caution" aria-hidden="true" />
            ) : (
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" aria-hidden="true" />
            )}
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-heading">
                {c.passwordsUnlocked
                  ? "Password protection overridden"
                  : "Password fields protected"}
              </p>
              <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                {c.passwordsUnlocked
                  ? "Preview override shown. The sample password field remains read-only."
                  : "Credential theft detected. Password entry is disabled on this page."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={c.passwordsUnlocked ? c.onRestoreProtection : c.onUnlockPasswords}
            className="min-h-8 shrink-0 whitespace-nowrap border border-border bg-background px-2 text-[10px] font-medium text-heading hover:bg-secondary"
          >
            {c.passwordsUnlocked ? "Restore protection" : "Unlock password fields"}
          </button>
        </div>
      )}
      {c.overlayDismissed ? (
        <div className="flex gap-2">
          <button type="button" onClick={c.onLeave} className={actionDanger}>
            Leave Site
          </button>
          <button type="button" onClick={c.onReopenWarning} className={actionOutline}>
            Show warning again
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button type="button" onClick={c.onLeave} className={actionDanger}>
            Leave Site
          </button>
          <button type="button" onClick={c.onContinueAnyway} className={actionOutline}>
            Continue Anyway
          </button>
        </div>
      )}
      {details}
    </div>
  );
}
