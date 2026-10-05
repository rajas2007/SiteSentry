'use client';

import React from 'react';
import MetricCards from './MetricCards';
import SecurityTrendChart from './SecurityTrendChart';
import ThreatDonutChart from './ThreatDonutChart';
import RightSidebarPanel from './RightSidebarPanel';
import RecentScansTable from './RecentScansTable';
import HighRiskThreatsCard from './HighRiskThreatsCard';
import { DashboardMetrics, ScanHistoryItem } from '../lib/types';
import { ShieldCheck, Lock, Activity, Server, FileText } from 'lucide-react';
import { StatusDot } from './Badges';

interface OverviewViewProps {
  metrics: DashboardMetrics;
  scans: ScanHistoryItem[];
  onSelectScan: (item: ScanHistoryItem) => void;
  onQuickScan: (url: string) => Promise<void>;
  isScanning: boolean;
  isBackendConnected: boolean;
  newlyAddedId: string | null;
  onViewAllThreats: () => void;
}

export default function OverviewView({
  metrics,
  scans,
  onSelectScan,
  onQuickScan,
  isScanning,
  isBackendConnected,
  newlyAddedId,
  onViewAllThreats,
}: OverviewViewProps) {
  const highRiskThreats = scans.filter(s => s.severity === 'high');

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* Top Banner & Quick Telemetry Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.85rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.2rem' }}>
            <StatusDot status="online" />
            <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--secondary-blue)' }}>
              WEB SECURITY INTELLIGENCE • REAL-TIME OPERATIONS
            </span>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary-navy)', letterSpacing: '-0.03em' }}>
            Your Web Security Overview
          </h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
            Real-time analysis, threat intelligence and privacy insights for a safer internet.
          </p>
        </div>

        {/* Quick Operations Telemetry Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div style={{ padding: '0.35rem 0.65rem', backgroundColor: '#FFFFFF', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', fontSize: '0.72rem', color: 'var(--text-body)', boxShadow: 'var(--shadow-xs)' }}>
            Active Engines: <strong style={{ color: 'var(--safe-green-dark)' }}>4/4 Online</strong>
          </div>
          <div style={{ padding: '0.35rem 0.65rem', backgroundColor: '#FFFFFF', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', fontSize: '0.72rem', color: 'var(--text-body)', boxShadow: 'var(--shadow-xs)' }}>
            Audit Ledger: <strong style={{ color: 'var(--primary-blue)' }}>1,248 Scans</strong>
          </div>
          <div style={{ padding: '0.35rem 0.65rem', backgroundColor: '#FFFFFF', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', fontSize: '0.72rem', color: 'var(--text-body)', boxShadow: 'var(--shadow-xs)' }}>
            Fleet Posture: <strong style={{ color: 'var(--safe-green-dark)' }}>84 / 100</strong>
          </div>
        </div>
      </div>

      {/* 4 Information-Dense KPI Cards */}
      <MetricCards metrics={metrics} />

      {/* Main Analytics Row: Security Activity + Threat Donut + Quick Scan / Status Column */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1fr) 300px', gap: '1.25rem', alignItems: 'stretch' }}>
        <SecurityTrendChart />
        <ThreatDonutChart />
        <RightSidebarPanel
          onQuickScan={onQuickScan}
          isScanning={isScanning}
          isBackendConnected={isBackendConnected}
          recentThreats={highRiskThreats}
          onSelectThreat={onSelectScan}
          onViewAllThreats={onViewAllThreats}
        />
      </div>

      {/* Second Analytics Row: Recent Scans Ledger (Left) & Recent High-Risk Threats (Right) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1fr)', gap: '1.25rem', alignItems: 'stretch' }}>
        <RecentScansTable
          scans={scans.slice(0, 7)}
          onSelectScan={onSelectScan}
          title="Recent Scans Ledger"
          newlyAddedId={newlyAddedId}
        />
        <HighRiskThreatsCard
          threats={highRiskThreats}
          onSelectThreat={onSelectScan}
          onViewAllThreats={onViewAllThreats}
        />
      </div>

      {/* Bottom Telemetry Strip */}
      <div
        className="sentry-card"
        style={{
          padding: '0.75rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          backgroundColor: 'var(--blue-soft-50)',
          fontSize: '0.74rem',
          color: 'var(--text-dark-muted)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <ShieldCheck size={16} color="var(--safe-green)" />
          <span>Multi-Vendor OSINT Coverage: <strong style={{ color: 'var(--primary-navy)' }}>99.8% across Google SB, VirusTotal, PhishTank</strong></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <Activity size={15} color="var(--primary-blue)" />
          <span>Interception Latency: <strong style={{ color: 'var(--primary-navy)' }}>42ms (Cache) / 380ms (Deep Heuristics)</strong></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <Lock size={15} color="var(--teal-accent)" />
          <span>TLS Encryption Standard: <strong style={{ color: 'var(--primary-navy)' }}>94.2% TLS 1.3 Verified</strong></span>
        </div>
      </div>

    </div>
  );
}
