'use client';

import React, { useEffect, useState } from 'react';
import { ConsoleShell } from '../../components/sentry/ConsoleShell';
import MetricCards from '../../components/MetricCards';
import LiveScanner from '../../components/LiveScanner';
import SecurityTrendChart from '../../components/SecurityTrendChart';
import ThreatDonutChart from '../../components/ThreatDonutChart';
import RecentScansTable from '../../components/RecentScansTable';
import ScanDetailModal from '../../components/ScanDetailModal';
import AnalyticsView from '../../components/AnalyticsView';
import SettingsView from '../../components/SettingsView';
import {
  INITIAL_METRICS,
  SAMPLE_SCANS,
  checkBackendHealth,
  fetchScanHistory,
  performLiveScan,
  fetchScanDetail
} from '../../lib/api';
import { ScanHistoryItem, DetailedScanResult, DashboardMetrics } from '../../lib/types';
import { ShieldCheck, Server, Database, Terminal } from 'lucide-react';

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'analytics' | 'settings'>('overview');
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [metrics, setMetrics] = useState<DashboardMetrics>(INITIAL_METRICS);
  const [scans, setScans] = useState<ScanHistoryItem[]>(SAMPLE_SCANS);
  const [selectedScan, setSelectedScan] = useState<DetailedScanResult | null>(null);
  const [newlyAddedId, setNewlyAddedId] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const isOnline = await checkBackendHealth();
      setIsBackendConnected(isOnline);

      const historyData = await fetchScanHistory(20);
      if (historyData.items && historyData.items.length > 0) {
        setScans(historyData.items);
      }
    }
    init();
  }, []);

  const handleQuickScan = async (url: string) => {
    setActiveTab('overview');
    const result = await performLiveScan(url);
    handleScanComplete(result);
    setSelectedScan(result);
  };

  const handleScanComplete = (result: DetailedScanResult) => {
    const newItem: ScanHistoryItem = {
      id: result.analysis_id,
      url: result.url,
      domain: result.domain,
      score: result.score,
      severity: result.severity,
      verdict: result.decision.action,
      threat_category: result.threat_category,
      scanned_at: result.scanned_at,
    };

    setNewlyAddedId(result.analysis_id);
    setScans((prev) => [newItem, ...prev]);

    setMetrics((prev) => ({
      ...prev,
      totalScans: prev.totalScans + 1,
      threatsBlocked: result.severity === 'high' ? prev.threatsBlocked + 1 : prev.threatsBlocked,
    }));

    setTimeout(() => {
      setNewlyAddedId(null);
    }, 2500);
  };

  const [loadingScanId, setLoadingScanId] = useState<string | null>(null);
  const fetchIdRef = React.useRef(0);

  const handleInspectScanItem = async (item: ScanHistoryItem) => {
    if (isBackendConnected) {
      const currentFetchId = ++fetchIdRef.current;
      setLoadingScanId(item.id);

      const detailed = await fetchScanDetail(item.id);

      if (currentFetchId !== fetchIdRef.current) {
        return; // Stale request
      }

      setLoadingScanId(null);

      if (detailed) {
        setSelectedScan(detailed);
        return;
      }
    }

    const isSafe = item.score >= 80;
    const isMedium = item.score >= 50 && item.score < 80;

    const fallback: DetailedScanResult = {
      analysis_id: item.id,
      url: item.url,
      domain: item.domain,
      score: item.score,
      severity: item.severity,
      confidence: 0,
      threat_category: item.threat_category,
      recommendations: [],
      factors: ['Full report unavailable. (Sample data or backend disconnected)'],
      decision: {
        action: item.verdict,
        severity: item.severity,
        ui: { color: isSafe ? 'emerald' : isMedium ? 'amber' : 'rose' },
      },
      scanned_at: item.scanned_at,
    };

    setSelectedScan(fallback);
  };

  return (
    <>
      <ConsoleShell
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onQuickScan={handleQuickScan}
        isBackendConnected={isBackendConnected}
      >
        <div key={activeTab} className="page-transition">

          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div>
              <MetricCards metrics={metrics} />

              <LiveScanner
                onScanComplete={handleScanComplete}
                onInspect={(res) => setSelectedScan(res)}
              />

              <div className="mb-8 grid gap-5 lg:grid-cols-2">
                <SecurityTrendChart />
                <ThreatDonutChart />
              </div>

              <RecentScansTable
                scans={scans.slice(0, 6)}
                onSelectScan={handleInspectScanItem}
                title="Recent Live Scans (Latest 6)"
                newlyAddedId={newlyAddedId}
                loadingScanId={loadingScanId}
              />
            </div>
          )}

          {/* SCAN HISTORY TAB */}
          {activeTab === 'history' && (
            <RecentScansTable
              scans={scans}
              onSelectScan={handleInspectScanItem}
              title="Complete Audit Ledger & Scan History"
              isFullHistory={true}
              newlyAddedId={newlyAddedId}
              loadingScanId={loadingScanId}
            />
          )}

          {/* THREAT ANALYTICS TAB */}
          {activeTab === 'analytics' && (
            <AnalyticsView />
          )}

          {/* SETTINGS TAB */}
          {activeTab === 'settings' && (
            <SettingsView />
          )}

        </div>
      </ConsoleShell>

      {/* Scan Detail Slide-Over Drawer */}
      <ScanDetailModal
        scan={selectedScan}
        onClose={() => setSelectedScan(null)}
      />
    </>
  );
}
