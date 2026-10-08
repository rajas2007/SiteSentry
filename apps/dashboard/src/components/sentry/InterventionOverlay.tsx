import { Lock, LockOpen } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "../../lib/utils";
import { formatCategory, type AnalysisResponse } from "../../lib/sentry";
import type { PopupControls } from "./ExtensionPopup";
import { SimulatedBrowserSurface } from "./BrowserSurface";
import { Logo, RiskBadge, RiskMascot, ScoreRing } from "./primitives";

/** Branded Site Sentry warning layered over the local sample page. */
export function InterventionPreview({ data, c }: { data: AnalysisResponse; c: PopupControls }) {
  const credentialTheft = data.threat_category === "credential_theft";
  const protectedPw = credentialTheft && !c.passwordsUnlocked;
  const category = formatCategory(data.threat_category);
  const threatTitle =
    category === "none"
      ? "High-risk activity detected"
      : `${category[0]!.toUpperCase()}${category.slice(1)} detected`;
  const riskFactors = data.factors.filter((factor) => factor.impact === "negative");
  const dialogRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (c.overlayDismissed) return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const getFocusable = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );

    const focusable = getFocusable();
    dialog.focus({ preventScroll: true });
    const dialogBounds = dialog.getBoundingClientRect();
    if (dialogBounds.top < 0 || dialogBounds.bottom > window.innerHeight) {
      dialog.scrollIntoView({ block: "start", inline: "nearest" });
    }

    const containTabFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;

      const currentFocusable = getFocusable();
      const first = currentFocusable[0];
      const last = currentFocusable[currentFocusable.length - 1];
      if (!first || !last) {
        event.preventDefault();
        dialog.focus({ preventScroll: true });
      } else if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === dialog)
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    dialog.addEventListener("keydown", containTabFocus);
    return () => {
      dialog.removeEventListener("keydown", containTabFocus);
      if (previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: true });
    };
  }, [c.overlayDismissed, data.analysis_id]);

  return (
    <SimulatedBrowserSurface
      data={data}
      passwordsProtected={protectedPw}
      showProtectionNotice={c.overlayDismissed}
      modalOpen={!c.overlayDismissed}
    >
      {!c.overlayDismissed && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="ss-ov-title"
          className="absolute inset-0 z-10 flex items-center justify-center overflow-y-auto bg-background/80 p-2 backdrop-blur-[1px] sm:p-5"
        >
          <section
            ref={dialogRef}
            tabIndex={-1}
            className="my-auto max-h-full w-full max-w-[600px] overflow-y-auto border border-border bg-card shadow-[0_20px_56px_rgb(0_0_0/0.4)]"
          >
            <header className="flex items-center justify-between gap-3 border-b border-border/75 bg-secondary/35 px-3 py-3 sm:px-5">
              <div className="flex min-w-0 items-center gap-2.5">
                <Logo className="h-8 w-8 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-heading">Site Sentry</p>
                  <p className="text-[11px] text-muted-foreground">Protection warning</p>
                </div>
              </div>
              <RiskBadge severity={data.severity} className="shrink-0" />
            </header>

            <div className="grid grid-cols-[minmax(0,1fr)_100px] items-center gap-2 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_112px] sm:gap-4 sm:px-5 sm:py-5">
              <div className="min-w-0">
                <p className="text-xs font-medium text-danger">
                  Site Sentry detected a serious risk.
                </p>
                <h2
                  id="ss-ov-title"
                  className="mt-2 text-lg font-semibold leading-snug text-heading sm:text-xl"
                >
                  This site may put your information at risk.
                </h2>
                <p className="mt-2 break-all font-mono text-xs text-muted-foreground">
                  {data.hostname}
                </p>
              </div>
              <ScoreRing
                key={data.analysis_id}
                score={data.score}
                severity={data.severity}
                size={100}
                showRanges={false}
              />
            </div>

            <div className="mx-4 flex items-center gap-3 border-l-2 border-danger/75 bg-danger-soft/30 px-3 py-2.5 sm:mx-5 sm:gap-4 sm:px-4 sm:py-3">
              <RiskMascot
                severity={data.severity}
                scale="supporting"
                className="h-14 w-14 shrink-0 sm:h-16 sm:w-16"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-heading">{threatTitle}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {data.decision.message}
                </p>
              </div>
            </div>

            <div className="px-4 py-4 sm:px-5">
              <h3 className="text-sm font-semibold text-heading">Why Site Sentry stepped in</h3>
              {riskFactors.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {riskFactors.map((factor) => (
                    <li
                      key={factor.name}
                      className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-border/55 pb-2 text-xs last:border-b-0"
                    >
                      <span className="text-heading">{factor.name}</span>
                      <span className="max-w-[150px] text-right font-mono leading-relaxed text-muted-foreground">
                        {factor.value}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border/55 pt-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    Google Safe Browsing
                  </p>
                  <p className="mt-1 break-words font-mono text-[11px] text-heading">
                    {data.threat_intelligence.google_safe_browsing}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-muted-foreground">VirusTotal</p>
                  <p className="mt-1 break-words font-mono text-[11px] text-heading">
                    {data.threat_intelligence.virustotal}
                  </p>
                </div>
              </div>
            </div>

            {credentialTheft && (
              <div
                className={cn(
                  "mx-4 mb-4 flex items-start gap-2.5 border-l-2 px-3 py-2.5 text-[11px] leading-relaxed sm:mx-5",
                  protectedPw
                    ? "border-danger bg-danger-soft/70 text-danger"
                    : "border-caution bg-caution-soft/70 text-caution",
                )}
              >
                {protectedPw ? (
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <LockOpen className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                )}
                {protectedPw
                  ? "Password fields are protected in this simulated preview."
                  : "Protection override shown; the sample password field remains read-only."}
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 border-t border-border bg-background/55 p-3 sm:flex-row sm:justify-end sm:px-5 sm:py-4">
              <button
                type="button"
                onClick={c.onLeave}
                className="min-h-10 border border-danger/55 bg-danger px-4 py-2 text-xs font-semibold text-destructive-foreground transition-colors hover:bg-danger/90 sm:min-w-36"
              >
                Leave Site
              </button>
              <button
                type="button"
                onClick={c.onContinueAnyway}
                className="min-h-10 border border-border bg-secondary px-4 py-2 text-xs font-medium text-heading transition-colors hover:bg-muted sm:min-w-36"
              >
                Continue Anyway
              </button>
            </div>
          </section>
        </div>
      )}
    </SimulatedBrowserSurface>
  );
}
