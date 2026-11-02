import { useEffect, useState } from 'react';
import { ShieldAlert, AlertTriangle, ArrowLeft, ChevronDown, ChevronRight, Shield, AlertOctagon } from 'lucide-react';
import { WarningData } from '../types/warning';
import { sanitizeUrl } from '../utils/url';

export const WARNING_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes bounded lifetime

export function isWarningExpired(timestamp: number, maxAgeMs = WARNING_EXPIRY_MS): boolean {
  if (typeof timestamp !== 'number' || isNaN(timestamp)) return true;
  const now = Date.now();
  // Reject future timestamps as invalid (tampering/clock skew guard)
  if (timestamp > now) return true;
  return now - timestamp > maxAgeMs;
}

export function isValidHttpUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export default function WarningApp() {
  const [data, setData] = useState<WarningData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [proceedConfirmed, setProceedConfirmed] = useState(false);
  const [protocolError, setProtocolError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');

    if (!id) {
      setLoading(false);
      return;
    }

    if (typeof chrome !== 'undefined' && chrome.storage?.session) {
      const key = `warning_${id}`;
      chrome.storage.session.get(key, (items) => {
        const warning = items?.[key] as WarningData | undefined;
        if (warning && warning.targetUrl) {
          if (isWarningExpired(warning.timestamp)) {
            // Expired record: remove it immediately and fall back to safe advisory
            chrome.storage.session.remove(key);
            setData(null);
          } else {
            const cleanTarget = sanitizeUrl(warning.targetUrl) || warning.targetUrl;
            setData({
              ...warning,
              targetUrl: cleanTarget,
            });
          }
        } else {
          setData(null);
        }
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  const handleReturnToSafety = () => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id && typeof chrome !== 'undefined' && chrome.storage?.session?.remove) {
      chrome.storage.session.remove(`warning_${id}`);
    }

    if (typeof chrome !== 'undefined' && chrome.tabs?.getCurrent) {
      chrome.tabs.getCurrent((tab) => {
        if (tab?.id && chrome.tabs?.update) {
          chrome.tabs.update(tab.id, { url: 'chrome://newtab' });
          return;
        }
        window.close();
      });
    } else {
      window.close();
    }
  };

  const handleProceedAnyway = () => {
    if (!data) return;

    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');

    // Pre-navigation expiry re-check: reject expired or invalid timestamps
    if (isWarningExpired(data.timestamp)) {
      if (id && typeof chrome !== 'undefined' && chrome.storage?.session?.remove) {
        chrome.storage.session.remove(`warning_${id}`);
      }
      setData(null);
      return;
    }

    if (!isValidHttpUrl(data.targetUrl)) {
      setProtocolError('Navigation blocked: The target URL does not use a supported HTTP or HTTPS protocol.');
      return;
    }

    if (id && typeof chrome !== 'undefined' && chrome.storage?.session?.remove) {
      chrome.storage.session.remove(`warning_${id}`);
    }

    if (typeof chrome !== 'undefined' && chrome.tabs?.getCurrent) {
      chrome.tabs.getCurrent((tab) => {
        if (tab?.id && chrome.tabs?.update) {
          chrome.tabs.update(tab.id, { url: data.targetUrl });
        } else {
          window.location.assign(data.targetUrl);
        }
      });
    } else {
      window.location.assign(data.targetUrl);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
        <div className="text-center">
          <Shield className="mx-auto h-12 w-12 animate-pulse text-analysis" />
          <p className="mt-4 text-sm font-medium text-heading">Loading security advisory...</p>
        </div>
      </div>
    );
  }

  // Safe Fallback UI: If session data is missing or expired, do not expose URL from another channel
  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
        <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl sm:p-8">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Shield className="h-6 w-6 text-analysis" />
            <span className="text-sm font-semibold tracking-wide text-heading uppercase">Site Sentry</span>
          </div>

          <div className="mt-6 flex items-start gap-4">
            <div className="rounded-lg bg-secondary p-3 text-analysis">
              <AlertOctagon className="h-8 w-8 text-danger" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-heading">Security Advisory Unavailable</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                No active threat report was found for this session or the analysis data has expired.
                For your safety, navigation to the untrusted page was prevented.
              </p>
            </div>
          </div>

          <div className="mt-8 border-t border-border pt-6">
            <button
              onClick={handleReturnToSafety}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-danger px-5 py-3 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-danger/90 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <ArrowLeft className="h-4 w-4" />
              Return to Safety
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8 text-foreground sm:py-16">
      <div className="mx-auto max-w-2xl">
        {/* Header Branding */}
        <header className="mb-6 flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-danger/10 text-danger">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold tracking-wider text-heading uppercase">Site Sentry</p>
              <p className="text-xs text-muted-foreground">Real-Time Threat Protection</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-danger/30 bg-danger/10 px-3 py-1 text-xs font-semibold text-danger">
            <span className="h-2 w-2 rounded-full bg-danger animate-pulse" />
            Threat Blocked
          </div>
        </header>

        {/* Main Alert Card */}
        <main className="overflow-hidden rounded-xl border border-danger/30 bg-card shadow-2xl">
          {/* Hero Alert Banner */}
          <div className="border-b border-danger/20 bg-danger/10 p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <div className="hidden rounded-xl bg-danger/20 p-3 sm:block">
                <AlertTriangle className="h-8 w-8 text-danger" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-bold tracking-tight text-heading sm:text-3xl">
                  Deceptive or Malicious Site Ahead
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Site Sentry blocked access to this page because it was identified as dangerous.
                  Visiting this site may compromise your personal data, passwords, or device security.
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            {/* Target URL Card - Plain Text Only */}
            <div className="rounded-lg border border-border bg-secondary/50 p-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-semibold uppercase tracking-wider">Blocked Destination</span>
                <span className="font-mono text-xs text-analysis">Threat Score: {data.score}/100</span>
              </div>
              <p className="mt-2 font-mono text-sm font-semibold text-heading break-all">
                {data.hostname}
              </p>
              <div className="mt-2 border-t border-border/50 pt-2">
                <span className="text-xs text-muted-foreground">Full URL: </span>
                {/* STRICT REQUIREMENT: Render strictly as plain text, no innerHTML or dangerous links */}
                <span data-testid="blocked-target-url" className="font-mono text-xs text-foreground/80 break-all select-all">
                  {data.targetUrl}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded bg-danger/20 px-2 py-0.5 text-xs font-medium text-danger uppercase">
                  Category: {data.threatCategory.replace(/_/g, ' ')}
                </span>
                <span className="rounded bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground uppercase">
                  Severity: {data.severity}
                </span>
              </div>
            </div>

            {/* Why was this blocked? */}
            {data.factors && data.factors.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold tracking-wide text-heading uppercase">
                  Detection Factors
                </h2>
                <ul className="mt-3 space-y-2 text-xs sm:text-sm text-muted-foreground">
                  {data.factors.map((factor, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-danger" />
                      <span>{factor}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendations */}
            {data.recommendations && data.recommendations.length > 0 && (
              <div className="rounded-lg border border-border bg-secondary/30 p-4">
                <h2 className="text-xs font-semibold tracking-wide text-heading uppercase">
                  Safety Guidance
                </h2>
                <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                  {data.recommendations.map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-analysis font-bold">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-4 pt-4 border-t border-border">
              {/* Primary Action */}
              <button
                type="button"
                onClick={handleReturnToSafety}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-danger px-6 py-3.5 text-base font-semibold text-white shadow-lg transition-all hover:bg-danger/90 focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <ArrowLeft className="h-5 w-5" />
                Take Me Back to Safety (Recommended)
              </button>

              {/* Advanced / Proceed Anyway Section */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-heading transition-colors"
                  aria-expanded={showAdvanced}
                >
                  {showAdvanced ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <span>Advanced: Proceed to unsafe site</span>
                </button>

                {showAdvanced && (
                  <div className="mt-3 rounded-lg border border-danger/30 bg-danger/5 p-4 text-xs space-y-3">
                    <p className="leading-relaxed text-muted-foreground">
                      Bypassing this warning is strongly discouraged. Attackers often design pages that appear
                      identical to legitimate services to steal your login credentials, financial information,
                      or execute unauthorized transactions.
                    </p>

                    <label className="flex items-start gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={proceedConfirmed}
                        onChange={(e) => {
                          setProceedConfirmed(e.target.checked);
                          setProtocolError(null);
                        }}
                        className="mt-0.5 rounded border-border bg-secondary text-danger focus:ring-danger"
                      />
                      <span className="text-foreground">
                        I understand the risks and wish to proceed anyway
                      </span>
                    </label>

                    {protocolError && (
                      <div className="rounded bg-danger/20 p-2 text-danger font-medium" role="alert">
                        {protocolError}
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={!proceedConfirmed}
                      onClick={handleProceedAnyway}
                      className="mt-2 inline-flex items-center justify-center rounded border border-danger/50 bg-secondary px-4 py-2 text-xs font-semibold text-danger transition-colors hover:bg-danger hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Proceed to {data.hostname} (Unsafe)
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
