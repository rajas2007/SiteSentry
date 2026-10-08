'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { X, Clock, Radar, Minus } from 'lucide-react';
import { DetailedScanResult } from '../lib/types';
import { ScoreRing, RiskMascot, RiskBadge } from './sentry/primitives';
import { cn } from '../lib/utils';
import { formatCategory, severityStyle, type Severity } from '../lib/sentry';

interface ScanDetailModalProps {
  scan: DetailedScanResult | null;
  onClose: () => void;
}

const riskAtmosphereClass: Record<string, string> = {
  LOW: "risk-tone-low",
  MEDIUM: "risk-tone-medium",
  HIGH: "risk-tone-high",
};

export default function ScanDetailModal({ scan, onClose }: ScanDetailModalProps) {
  const [isClosing, setIsClosing] = useState(false);

  const handleTriggerClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 180);
  }, [onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleTriggerClose();
    };
    if (scan) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'auto';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [scan, handleTriggerClose]);

  if (!scan) return null;

  const severity = scan.severity.toUpperCase() as Severity;
  const tone = severityStyle[severity];

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      {/* Backdrop */}
      <div
        onClick={handleTriggerClose}
        className={cn("absolute inset-0 bg-[#030508]/70 backdrop-blur-[4px]", isClosing ? 'overlay-exit' : 'overlay-enter')}
      />

      {/* Slide-over Drawer */}
      <div
        className={cn(
          "relative z-10 flex h-full w-full max-w-[520px] flex-col overflow-y-auto bg-card border-l border-border/60 shadow-[-10px_0_40px_rgba(0,0,0,0.6)]",
          isClosing ? 'drawer-exit' : 'drawer-enter'
        )}
      >
        {/* Header */}
        <div className="sticky top-0 z-20 flex items-start justify-between gap-4 border-b border-border/60 bg-background/90 p-5 backdrop-blur-md">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2">
              <RiskBadge severity={severity} />
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {new Date(scan.scanned_at).toLocaleString()}
              </span>
            </div>
            <h2 className="break-all font-heading text-lg font-bold text-heading">
              {scan.domain}
            </h2>
            <p className="break-all font-mono text-xs text-muted-foreground">
              {scan.url}
            </p>
          </div>

          <button
            onClick={handleTriggerClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-heading"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1">
          {/* Main Score Area */}
          <section
            className={cn(
              "scan-surface risk-atmosphere relative border-b border-border/60 px-6 py-8",
              riskAtmosphereClass[severity]
            )}
          >
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
              <div className="flex shrink-0 justify-center">
                <ScoreRing
                  key={scan.analysis_id}
                  score={scan.score}
                  severity={severity}
                  size={164}
                />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-muted-foreground">
                  Confidence: {Math.round(scan.confidence * 100)}%
                </p>
                <div className={cn("mt-4 flex items-center gap-3 border-l-2 pl-3", tone.border)}>
                  <RiskMascot
                    severity={severity}
                    scale="supporting"
                    className="h-10 w-10 sm:h-12 sm:w-12 shrink-0"
                  />
                  <p className={cn("min-w-0 text-sm font-semibold leading-relaxed", tone.text)}>
                    {scan.decision.action === "allow" ? "Browsing permitted." : scan.decision.action === "warn" ? "Caution advised." : "Intervention required."}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Details Section */}
          <section className="px-6 py-6">
            <h3 className="mb-4 text-sm font-semibold text-heading">Why this result?</h3>
            <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
              {scan.factors && scan.factors.length > 0
                ? `${scan.factors.length} security factor${scan.factors.length === 1 ? "" : "s"} evaluated.`
                : "No security factors were reported for this sample."}
            </p>

            {scan.factors && scan.factors.length > 0 && (
              <ul className="mb-6 space-y-2">
                {scan.factors.map((factor, i) => (
                  <li key={i} className="flex gap-2.5 border-b border-border/40 pb-2 text-xs last:border-0">
                    <Minus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="text-heading">{factor}</span>
                  </li>
                ))}
              </ul>
            )}

            {scan.threat_intelligence && scan.threat_intelligence.sources && scan.threat_intelligence.sources.length > 0 && (
              <div className="mb-6 rounded-md border border-border/50 bg-background/30 p-4">
                <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold text-heading">
                  <Radar className="h-3.5 w-3.5 text-analysis" aria-hidden="true" />
                  Threat intelligence
                </h4>
                <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-3 text-xs">
                  {scan.threat_intelligence.sources.map((source, i) => (
                    <div key={i} className="contents">
                      <dt className="text-muted-foreground">{source.provider}</dt>
                      <dd className="max-w-[180px] text-right font-mono text-[10px] text-heading">
                        <span className={cn("mr-2", source.status === 'detected' ? 'text-danger' : source.status === 'clean' ? 'text-safe' : 'text-muted-foreground')}>
                          {source.status.toUpperCase()}
                        </span>
                        <span className="block mt-0.5 text-muted-foreground truncate">{source.summary}</span>
                      </dd>
                    </div>
                  ))}
                  <dt className="text-muted-foreground pt-2 border-t border-border/40">Threat category</dt>
                  <dd className="max-w-[180px] text-right font-mono text-[10px] text-heading pt-2 border-t border-border/40">
                    {formatCategory(scan.threat_category)}
                  </dd>
                </dl>
              </div>
            )}

            {scan.recommendations && scan.recommendations.length > 0 && (
              <div className="mt-2">
                <h3 className="mb-3 text-sm font-semibold text-heading">Recommendations</h3>
                <ul className="space-y-2.5">
                  {scan.recommendations.map((rec, i) => (
                    <li key={i} className="flex gap-2.5 text-xs leading-relaxed text-heading">
                      <span className="mt-1.5 h-px w-3 shrink-0 bg-analysis/60" aria-hidden="true" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>
        
        {/* Footer */}
        <div className="border-t border-border/60 bg-background/50 p-4 text-center font-mono text-[9px] text-muted-foreground">
          Analysis ID: {scan.analysis_id}
        </div>
      </div>
    </div>
  );
}
