'use client';

import React from 'react';
import { DashboardMetrics } from '../lib/types';
import AnimatedNumber from './AnimatedNumber';

interface MetricCardsProps {
  metrics: DashboardMetrics | null;
  isLoading?: boolean;
}

function Metric({
  label,
  value,
  unit,
  note,
  progress,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  note?: string;
  progress?: number;
}) {
  return (
    <div className="min-w-0 flex flex-col p-5 sm:p-6 border border-border/60 bg-card rounded-md shadow-sm">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{label}</h3>
      <p className="mt-2 flex items-baseline gap-1.5 text-2xl font-semibold leading-none tracking-tight text-heading sm:text-3xl">
        {value}
        {unit && <span className="text-xs font-normal tracking-normal text-muted-foreground">{unit}</span>}
      </p>
      {progress !== undefined && (
        <div
          className="mt-3 h-1 overflow-hidden bg-background/80 rounded-full"
          role="meter"
          aria-label={`${label} score`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <div className="h-full bg-analysis transition-all duration-700" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
        </div>
      )}
      {note && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{note}</p>}
    </div>
  );
}

export default function MetricCards({ metrics, isLoading = false }: MetricCardsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-4 mb-8">
        <Metric label="Total Scans" value={<span className="text-muted-foreground animate-pulse">—</span>} note="Loading live analytics..." />
        <Metric label="High-Risk / Blocked" value={<span className="text-muted-foreground animate-pulse">—</span>} note="Loading live analytics..." />
        <Metric label="Avg Trust Score" value={<span className="text-muted-foreground animate-pulse">—</span>} note="Loading live analytics..." />
        <Metric label="Privacy Violations" value={<span className="text-muted-foreground animate-pulse">—</span>} note="Loading live analytics..." />
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-4 mb-8">
        <Metric label="Total Scans" value={<span className="text-muted-foreground">—</span>} note="Analytics unavailable (Backend offline)" />
        <Metric label="High-Risk / Blocked" value={<span className="text-muted-foreground">—</span>} note="Analytics unavailable (Backend offline)" />
        <Metric label="Avg Trust Score" value={<span className="text-muted-foreground">—</span>} note="Analytics unavailable (Backend offline)" />
        <Metric label="Privacy Violations" value={<span className="text-muted-foreground">—</span>} note="Analytics unavailable (Backend offline)" />
      </div>
    );
  }

  return (
    <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-4 mb-8">
      <Metric
        label="Total Scans"
        value={<AnimatedNumber value={metrics.totalScans} />}
        note="Inspected in requested period"
      />
      <Metric
        label="High-Risk / Blocked"
        value={<AnimatedNumber value={metrics.threatsBlocked} />}
        note="Blocked verdict or high risk severity"
      />
      <Metric
        label="Avg Trust Score"
        value={<AnimatedNumber value={Math.round(metrics.averageTrustScore)} format={false} />}
        unit="/ 100"
        progress={metrics.averageTrustScore}
        note={metrics.totalScans > 0 ? `Calculated from ${metrics.totalScans} scan records` : "No scans recorded in period"}
      />
      <Metric
        label="Privacy Violations"
        value={<AnimatedNumber value={metrics.privacyViolations} />}
        note="Flagged as privacy abuse category"
      />
    </div>
  );
}
