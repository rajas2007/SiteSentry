'use client';

import React from 'react';
import { Server, CheckCircle2, ShieldAlert } from 'lucide-react';
import { cn } from '../lib/utils';

export default function AnalyticsView() {
  const osintProviders = [
    { name: 'Google Safe Browsing v4', queries: 1248, detections: 34, coverage: '99.8%' },
    { name: 'VirusTotal v3 Multi-Vendor', queries: 1248, detections: 41, coverage: '99.2%' },
    { name: 'SiteSentry Structural Heuristics', queries: 1248, detections: 58, coverage: '100%' },
  ];

  const safeDomains = [
    { domain: 'github.com', score: 98, totalScans: 412, status: 'Verified High Trust' },
    { domain: 'developer.mozilla.org', score: 95, totalScans: 285, status: 'Educational Authority' },
    { domain: 'chat.openai.com', score: 96, totalScans: 190, status: 'Valid EV Transport' },
  ];

  const maliciousDomains = [
    { domain: 'verify-account.security-update.xyz', score: 12, reason: 'Credential Harvesting & Fake Login', blocked: 'Blocked 28 times' },
    { domain: 'crypto-airdrop-rewards-free.net', score: 25, reason: 'Deceptive Phishing Payload', blocked: 'Blocked 14 times' },
    { domain: 'shopping-deals-unlimited.biz', score: 48, reason: 'Excessive Privacy Exploitation', blocked: 'Blocked 9 times' },
  ];

  return (
    <div className="page-transition flex flex-col gap-8 max-w-[1200px]">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-heading sm:text-2xl">Threat Intelligence & OSINT Analytics</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Detailed visibility into external vendor detection consensus, privacy trackers, and domain reputation.
        </p>
      </div>

      <div className="rounded-md border border-border/60 bg-card p-6 scan-surface">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-heading">
          <Server className="h-4 w-4 text-analysis" /> OSINT Engine Consensus & Coverage
        </h3>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {osintProviders.map((prov, i) => (
            <div key={i} className="rounded-md border border-border/50 bg-background/30 p-5">
              <div className="mb-4 flex items-start justify-between gap-2">
                <span className="font-semibold text-sm text-heading">{prov.name}</span>
                <span className="inline-flex rounded-sm bg-analysis/20 px-2 py-0.5 text-[10px] font-semibold text-analysis">
                  {prov.coverage}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Total Queries:</span>
                <span className="font-semibold text-heading">{prov.queries.toLocaleString()}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>Threat Detections:</span>
                <span className="font-semibold text-danger">{prov.detections.toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Safe Domains */}
        <div className="rounded-md border border-border/60 bg-card p-6">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-heading">
            <CheckCircle2 className="h-4 w-4 text-safe" /> Top Verified Trusted Domains
          </h3>
          <div className="space-y-4">
            {safeDomains.map((d, i) => (
              <div key={i} className="flex items-center justify-between border-b border-border/40 pb-4 last:border-0 last:pb-0">
                <div className="min-w-0 flex-1 pr-4">
                  <p className="truncate font-semibold text-sm text-heading">{d.domain}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{d.status}</p>
                </div>
                <div className="text-right">
                  <div className="flex items-baseline justify-end gap-1">
                    <span className="text-lg font-bold text-safe">{d.score}</span>
                    <span className="text-[10px] text-muted-foreground">/100</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{d.totalScans} scans</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Malicious Domains */}
        <div className="rounded-md border border-border/60 bg-card p-6">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-heading">
            <ShieldAlert className="h-4 w-4 text-danger" /> Most Frequent Active Threats
          </h3>
          <div className="space-y-4">
            {maliciousDomains.map((d, i) => (
              <div key={i} className="flex items-center justify-between border-b border-border/40 pb-4 last:border-0 last:pb-0">
                <div className="min-w-0 flex-1 pr-4">
                  <p className="truncate font-semibold text-sm text-heading">{d.domain}</p>
                  <p className="mt-1 truncate text-[11px] text-danger">{d.reason}</p>
                </div>
                <div className="text-right">
                  <div className="flex items-baseline justify-end gap-1">
                    <span className="text-lg font-bold text-danger">{d.score}</span>
                    <span className="text-[10px] text-muted-foreground">/100</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{d.blocked}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
