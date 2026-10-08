'use client';

import React from 'react';
import { DashboardMetrics } from '../lib/types';
import AnimatedNumber from './AnimatedNumber';
import { cn } from '../lib/utils';

interface MetricCardsProps {
  metrics: DashboardMetrics;
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
    <div className="min-w-0 glass-card">
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
          <div className="h-full bg-analysis transition-all duration-700" style={{ width: `${progress}%` }} />
        </div>
      )}
      {note && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{note}</p>}
    </div>
  );
}

export default function MetricCards({ metrics }: MetricCardsProps) {
  return (
    <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-4 mb-8">
      <Metric 
        label="Total Scans" 
        value={<AnimatedNumber value={metrics.totalScans} />}
        note={`Trending ${metrics.scansTrend} • Inspected in real-time`}
      />
      <Metric 
        label="High-Risk Blocked" 
        value={<AnimatedNumber value={metrics.threatsBlocked} />}
        note="Active Interventions • Phishing & malware"
      />
      <Metric 
        label="Avg Trust Score" 
        value={<AnimatedNumber value={metrics.averageTrustScore} format={false} />}
        unit="/ 100"
        progress={metrics.averageTrustScore}
        note="Healthy average across network"
      />
      <Metric 
        label="Privacy Violations" 
        value={<AnimatedNumber value={metrics.privacyViolations} />}
        note="AI Verified • Data clauses & pixels"
      />
    </div>
  );
}
