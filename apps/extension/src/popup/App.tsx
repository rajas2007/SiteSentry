import { useEffect, useState } from 'react';
import { ExtensionMessageResponse, PageAnalysisResponse } from '@site-sentry/shared-types';
import { ExternalLink, Minus, Radar } from 'lucide-react';
import { cn } from './utils';
import { formatCategory, severityStyle, type Severity } from './sentry';
import { Logo, PendingScoreDial, RiskMascot, ScoreRing } from './primitives';

const mascotAnalyzing = "/Site-Sentry-assests/site-sentry-mascot-analyzing.png";
const mascotOffline = "/Site-Sentry-assests/site-sentry-mascot-offline.png";

const SectionTitle = ({ children }: { children: string }) => (
  <h3 className="mb-3 text-sm font-semibold text-heading">{children}</h3>
);

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

export default function App() {
  const [analysis, setAnalysis] = useState<PageAnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_CURRENT_ANALYSIS' }, (response: ExtensionMessageResponse) => {
      setLoading(false);
      if (response?.status === 'SUCCESS') {
        setAnalysis(response.data);
      } else if (response?.status === 'ERROR') {
        setError(response.error);
      } else {
        setError('No analysis available for this page.');
      }
    });
  }, []);

  return (
    <div className="mx-auto flex h-[600px] w-full min-w-0 max-w-[380px] flex-col overflow-hidden border border-border bg-card shadow-[0_18px_48px_rgb(0_0_0/0.3)] max-sm:h-[600px] max-sm:min-h-[420px]">
      <Header />
      <div className="min-h-0 flex-1 overflow-y-auto bg-background/55">
        {loading && (
          <div className="blueprint-field flex h-full flex-col justify-center p-4 sm:p-5">
            <div className="mx-auto grid w-full max-w-[340px] grid-cols-[minmax(0,1fr)_92px] items-center gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <img src={mascotAnalyzing} alt="" aria-hidden="true" className="h-[68px] w-[68px] shrink-0 object-contain" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-analysis">Security analysis</p>
                  <p className="mt-1.5 text-sm font-semibold leading-snug text-heading">Analyzing this page...</p>
                </div>
              </div>
              <PendingScoreDial size={92} />
            </div>
            <div className="mx-auto mt-4 w-full max-w-[340px]">
              <p className="text-center text-xs leading-relaxed text-muted-foreground">No result is shown until the analysis completes.</p>
              <div className="scan-track mt-4 h-px w-full" aria-hidden="true" />
            </div>
          </div>
        )}
        {error && (
          <div className="blueprint-field flex h-full flex-col items-center justify-center gap-4 p-7 text-center">
            <img src={mascotOffline} alt="" aria-hidden="true" className="h-[88px] w-[88px] object-contain" />
            <div className="max-w-[275px]">
              <p className="text-base font-semibold text-heading">Analysis unavailable</p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{error}</p>
            </div>
          </div>
        )}
        {!loading && !error && analysis && <Result data={analysis} />}
      </div>
      <footer className="flex-none border-t border-border bg-background">
        {!loading && !error && analysis && (
          <div className="px-3 py-2.5">
            <a href={((import.meta as { env?: { VITE_DASHBOARD_URL?: string } }).env?.VITE_DASHBOARD_URL || 'http://localhost:3000') + '/console'} target="_blank" rel="noreferrer" className="inline-flex min-h-10 w-full items-center justify-center gap-2 border px-3 py-2 text-xs font-medium transition-colors border-border bg-background text-heading hover:bg-secondary">
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              View full analysis dashboard
            </a>
          </div>
        )}
        <p className="border-t border-border/70 px-3 py-2 text-center font-mono text-[9px] text-muted-foreground">
          v0.1.0 · Connected to Site Sentry Engine
        </p>
      </footer>
    </div>
  );
}

function Result({ data }: { data: PageAnalysisResponse }) {
  const severity = data.severity.toUpperCase() as Severity;
  const tone = severityStyle[severity];
  
  const riskAtmosphereClass: Record<Severity, string> = {
    LOW: "risk-tone-low",
    MEDIUM: "risk-tone-medium",
    HIGH: "risk-tone-high",
  };

  return (
    <div className="flex flex-col">
      <section className={cn("scan-surface risk-atmosphere relative border-b border-border/65", riskAtmosphereClass[severity])}>
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-border to-transparent opacity-60" />
        <div className="flex flex-col px-4 py-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="risk-marker bg-card p-1">
                <div className={cn("h-1.5 w-1.5 rounded-sm", tone.dot)} />
              </div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Threat assessment
              </p>
            </div>
            <div className="rounded border border-border/45 bg-background/50 px-2 py-0.5 font-mono text-[9px] text-muted-foreground backdrop-blur-sm">
              Confidence: {Math.round(data.confidence * 100)}%
            </div>
          </div>
          <div className="flex justify-center py-1">
            <ScoreRing
              key={data.analysis_id}
              score={data.score}
              severity={severity}
              size={164}
              showRanges={false}
            />
          </div>
          <div className={cn("flex items-center gap-3 border-l-2 pl-3", tone.border)}>
            <RiskMascot severity={severity} scale="supporting" className="h-12 w-12" />
            <p className={cn("min-w-0 text-sm font-semibold leading-snug", tone.text)}>
              {data.decision.action === "allow" ? "Browsing permitted." : data.decision.action === "warn" ? "Caution advised." : "Intervention required."}
            </p>
          </div>
        </div>
      </section>

      <section className="px-4 py-3.5">
        <SectionTitle>Why this result?</SectionTitle>
        <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
          {data.factors.length > 0
            ? `${data.factors.length} security factor${data.factors.length === 1 ? "" : "s"} evaluated.`
            : "No security factors were reported for this sample."}
        </p>
        {data.factors.length > 0 && (
          <ul className="space-y-2">
            {data.factors.map((factor, i) => (
              <li key={i} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-border/55 pb-2 text-xs last:border-b-0">
                <span className="flex min-w-0 items-center gap-2 text-xs">
                  <Minus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="text-heading">{factor}</span>
                </span>
              </li>
            ))}
          </ul>
        )}

        <details className="mt-4 border-t border-border/65 pt-3">
          <summary className="cursor-pointer text-xs font-semibold text-heading marker:text-analysis">
            Threat intelligence and technical details
          </summary>
          <div className="mt-3 space-y-4">
            {data.threat_intelligence && data.threat_intelligence.sources.length > 0 && (
              <div>
                <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold text-heading">
                  <Radar className="h-3.5 w-3.5 text-analysis" aria-hidden="true" />
                  Threat intelligence
                </h4>
                <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 text-xs">
                  {data.threat_intelligence.sources.map((source, i) => (
                    <div key={i} className="contents">
                      <dt className="text-muted-foreground">{source.provider}</dt>
                      <dd className="max-w-[145px] text-right font-mono text-[10px] text-heading">
                        <span className={cn("mr-2", source.status === 'detected' ? 'text-danger' : source.status === 'clean' ? 'text-safe' : 'text-muted-foreground')}>{source.status.toUpperCase()}</span>
                        {source.summary}
                      </dd>
                    </div>
                  ))}
                  <dt className="text-muted-foreground">Threat category</dt>
                  <dd className="max-w-[145px] text-right font-mono text-[10px] text-heading">
                    {formatCategory(data.threat_category)}
                  </dd>
                </dl>
              </div>
            )}
          </div>
        </details>

        {data.recommendations && data.recommendations.length > 0 && (
          <div className="mt-5">
            <SectionTitle>Recommendations</SectionTitle>
            <ul className="space-y-2">
              {data.recommendations.map((recommendation, i) => (
                <li key={i} className="flex gap-2.5 text-xs leading-relaxed text-heading">
                  <span className="mt-1.5 h-px w-3 shrink-0 bg-analysis/60" aria-hidden="true" />
                  {recommendation}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}


