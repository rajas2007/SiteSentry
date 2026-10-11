'use client';

import React from 'react';
import { Server, CheckCircle2, ShieldAlert, BarChart3, ShieldCheck } from 'lucide-react';
import { AnalyticsOverview } from '../lib/types';
import { cn } from '../lib/utils';

interface AnalyticsViewProps {
  analytics?: AnalyticsOverview | null;
  isLoading?: boolean;
}

export default function AnalyticsView({ analytics = null, isLoading = false }: AnalyticsViewProps) {
  return (
    <div className="page-transition flex flex-col gap-8 max-w-[1200px]">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-heading sm:text-2xl">
          Threat Intelligence & Telemetry Analytics
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Real-time visibility into decision distributions, risk severity tiers, and threat detection intelligence calculated from persisted database records.
        </p>
      </div>

      {/* Decision Engine Breakdown (Real Data) */}
      <div className="rounded-md border border-border/60 bg-card p-6 scan-surface">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-heading">
          <BarChart3 className="h-4 w-4 text-analysis" /> Decision Matrix & Risk Severity Distribution
        </h3>

        {isLoading ? (
          <div className="py-8 text-center text-xs text-muted-foreground animate-pulse">
            Loading decision matrix data...
          </div>
        ) : !analytics ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            Decision analytics unavailable (Backend offline)
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {/* Low / Allow */}
            <div className="rounded-md border border-border/50 bg-background/30 p-5">
              <div className="mb-3 flex items-start justify-between gap-2">
                <span className="font-semibold text-sm text-heading">Low Risk / Permitted</span>
                <span className="inline-flex rounded-sm bg-safe/20 px-2 py-0.5 text-[10px] font-semibold text-safe">
                  ALLOW
                </span>
              </div>
              <div className="flex items-baseline justify-between text-xs text-muted-foreground">
                <span>Total Scans:</span>
                <span className="text-xl font-bold text-safe font-mono">
                  {analytics.risk_distribution['low'] ?? 0}
                </span>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Passed heuristics with valid transport and no blacklists.
              </p>
            </div>

            {/* Medium / Caution */}
            <div className="rounded-md border border-border/50 bg-background/30 p-5">
              <div className="mb-3 flex items-start justify-between gap-2">
                <span className="font-semibold text-sm text-heading">Medium Risk / Elevated</span>
                <span className="inline-flex rounded-sm bg-caution/20 px-2 py-0.5 text-[10px] font-semibold text-caution">
                  WARN
                </span>
              </div>
              <div className="flex items-baseline justify-between text-xs text-muted-foreground">
                <span>Total Scans:</span>
                <span className="text-xl font-bold text-caution font-mono">
                  {analytics.risk_distribution['medium'] ?? 0}
                </span>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Exhibits tracking beacons, anomalous DNS, or suspicious keywords.
              </p>
            </div>

            {/* High / Block */}
            <div className="rounded-md border border-border/50 bg-background/30 p-5">
              <div className="mb-3 flex items-start justify-between gap-2">
                <span className="font-semibold text-sm text-heading">High Risk / Intervention</span>
                <span className="inline-flex rounded-sm bg-danger/20 px-2 py-0.5 text-[10px] font-semibold text-danger">
                  BLOCK
                </span>
              </div>
              <div className="flex items-baseline justify-between text-xs text-muted-foreground">
                <span>Total Scans:</span>
                <span className="text-xl font-bold text-danger font-mono">
                  {analytics.threats_blocked}
                </span>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Active credential harvesting, malware signatures, or blacklists.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Future Feed Placeholders (Honest States) */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Safe Domains Section */}
        <div className="rounded-md border border-border/60 bg-card p-6">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-heading">
            <CheckCircle2 className="h-4 w-4 text-safe" /> Top Verified Authority Domains
          </h3>
          <div className="rounded border border-dashed border-border/60 bg-background/30 p-6 text-center">
            <ShieldCheck className="mx-auto h-8 w-8 text-muted-foreground/60 mb-2" />
            <p className="text-xs font-semibold text-heading">Not available yet</p>
            <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
              Domain trust certificates and verified institutional authority feeds are scheduled for a future audit milestone.
            </p>
          </div>
        </div>

        {/* Malicious Domains Section */}
        <div className="rounded-md border border-border/60 bg-card p-6">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-heading">
            <ShieldAlert className="h-4 w-4 text-danger" /> Multi-Vendor Threat Intelligence Telemetry
          </h3>
          <div className="rounded border border-dashed border-border/60 bg-background/30 p-6 text-center">
            <Server className="mx-auto h-8 w-8 text-muted-foreground/60 mb-2" />
            <p className="text-xs font-semibold text-heading">Not available yet</p>
            <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
              Google Safe Browsing and VirusTotal vendor query telemetry logs are currently logged per scan in the database and will be aggregated in an upcoming release.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
