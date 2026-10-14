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
  checkBackendHealth,
  fetchScanHistory,
  performLiveScan,
  fetchScanDetail,
  fetchAnalytics
} from '../../lib/api';
import { ScanHistoryItem, DetailedScanResult, DashboardMetrics, AnalyticsOverview } from '../../lib/types';
import { AlertCircle, X } from 'lucide-react';

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'analytics' | 'settings'>('overview');
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const analyticsFetchIdRef = React.useRef(0);
  const [scans, setScans] = useState<ScanHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [selectedScan, setSelectedScan] = useState<DetailedScanResult | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [newlyAddedId, setNewlyAddedId] = useState<string | null>(null);

  const loadDashboardData = React.useCallback(async () => {
    setHistoryLoading(true);
    setAnalyticsLoading(true);
    setHistoryError(null);

    const isOnline = await checkBackendHealth();
    setIsBackendConnected(isOnline);

    if (!isOnline) {
      setScans([]);
      setHistoryError('Backend service is offline. Please start the Site Sentry API server.');
      setHistoryLoading(false);
      setAnalytics(null);
      setAnalyticsLoading(false);
      return;
    }

    const fetchId = ++analyticsFetchIdRef.current;
    const [historyData, analyticsData] = await Promise.all([
      fetchScanHistory(20),
      fetchAnalytics(30),
    ]);

    if (fetchId !== analyticsFetchIdRef.current) {
      return;
    }

    if (historyData) {
      setScans(historyData.items);
      setHistoryError(null);
    } else {
      setScans([]);
      setHistoryError('Scan history could not be retrieved from the backend.');
    }
    setHistoryLoading(false);

    setAnalytics(analyticsData);
    setAnalyticsLoading(false);
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleQuickScan = async (url: string) => {
    setActiveTab('overview');
    setDetailError(null);
    try {
      const result = await performLiveScan(url);
      handleScanComplete(result);
      setSelectedScan(result);
    } catch (error) {
      console.error('Quick scan failed:', error);
      const msg = error instanceof Error ? error.message : 'Quick scan request failed.';
      setDetailError(`Quick scan failed for ${url}: ${msg}`);
    }
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

    // Fetch authoritative analytics overview from backend
    if (isBackendConnected) {
      const fetchId = ++analyticsFetchIdRef.current;
      fetchAnalytics(30).then((freshAnalytics) => {
        if (fetchId !== analyticsFetchIdRef.current) {
          return; // Discard stale response
        }
        if (freshAnalytics) {
          setAnalytics(freshAnalytics);
        }
      });
    }

    setTimeout(() => {
      setNewlyAddedId(null);
    }, 2500);
  };


  const metrics: DashboardMetrics | null = analytics
    ? {
        totalScans: analytics.total_scans,
        threatsBlocked: analytics.threats_blocked,
        averageTrustScore: analytics.average_trust_score,
        privacyViolations: analytics.privacy_violations,
      }
    : null;

  const [loadingScanId, setLoadingScanId] = useState<string | null>(null);
  const fetchIdRef = React.useRef(0);

  const handleInspectScanItem = async (item: ScanHistoryItem) => {
    setDetailError(null);
    if (!isBackendConnected) {
      setDetailError(`Cannot inspect scan for ${item.domain}: Backend service is offline.`);
      return;
    }

    const currentFetchId = ++fetchIdRef.current;
    setLoadingScanId(item.id);

    const detailed = await fetchScanDetail(item.id);

    if (currentFetchId !== fetchIdRef.current) {
      return; // Stale request
    }

    setLoadingScanId(null);

    if (detailed) {
      setSelectedScan(detailed);
    } else {
      setDetailError(`Detailed scan report for ${item.domain} could not be retrieved from the backend.`);
    }
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
          {detailError && (
            <div
              role="alert"
              className="mb-5 flex items-center justify-between gap-3 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-xs text-danger"
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{detailError}</span>
              </div>
              <button
                type="button"
                onClick={() => setDetailError(null)}
                className="text-muted-foreground hover:text-heading transition-colors"
                aria-label="Dismiss error"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div>
              <MetricCards metrics={metrics} isLoading={analyticsLoading} />

              <LiveScanner
                onScanComplete={handleScanComplete}
                onInspect={(res) => setSelectedScan(res)}
              />

              <div className="mb-8 grid gap-5 lg:grid-cols-2">
                <SecurityTrendChart
                  timeline={analytics?.timeline ?? null}
                  isLoading={analyticsLoading}
                />
                <ThreatDonutChart
                  categories={analytics?.threat_categories ?? null}
                  totalScans={analytics?.total_scans ?? null}
                  isLoading={analyticsLoading}
                />
              </div>

              <RecentScansTable
                scans={scans.slice(0, 6)}
                onSelectScan={handleInspectScanItem}
                title="Recent Live Scans (Latest 6)"
                newlyAddedId={newlyAddedId}
                loadingScanId={loadingScanId}
                isLoading={historyLoading}
                error={historyError}
                onRetry={loadDashboardData}
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
              isLoading={historyLoading}
              error={historyError}
              onRetry={loadDashboardData}
            />
          )}

          {/* THREAT ANALYTICS TAB */}
          {activeTab === 'analytics' && (
            <AnalyticsView analytics={analytics} isLoading={analyticsLoading} />
          )}

          {/* SETTINGS TAB */}
          {activeTab === 'settings' && (
            <SettingsView scans={scans} />
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
