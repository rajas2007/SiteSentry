'use client';

import React, { useState } from 'react';
import { History, Search, Eye } from 'lucide-react';
import { ScanHistoryItem } from '../lib/types';
import { Panel, RiskBadge } from './sentry/primitives';
import { cn } from '../lib/utils';

interface RecentScansTableProps {
  scans: ScanHistoryItem[];
  onSelectScan: (item: ScanHistoryItem) => void;
  title?: string;
  isFullHistory?: boolean;
  newlyAddedId?: string | null;
  loadingScanId?: string | null;
}

const severityStyle: Record<string, { bg: string; border: string; text: string }> = {
  high: { bg: 'bg-danger/10', border: 'border-danger/35', text: 'text-danger' },
  medium: { bg: 'bg-caution/10', border: 'border-caution/35', text: 'text-caution' },
  low: { bg: 'bg-safe/10', border: 'border-safe/35', text: 'text-safe' },
};

export default function RecentScansTable({ 
  scans, 
  onSelectScan, 
  title = 'Real-Time Scan Audit Ledger',
  isFullHistory = false,
  newlyAddedId = null,
  loadingScanId = null,
}: RecentScansTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  const filteredScans = scans.filter((s) => {
    const matchesSearch = s.domain.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          s.url.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSeverity = filterSeverity === 'all' || s.severity === filterSeverity;
    return matchesSearch && matchesSeverity;
  });

  return (
    <Panel 
      title={title} 
      meta={isFullHistory ? `${filteredScans.length} scan records` : "Latest 6 scans"}
      className="mb-8 overflow-visible"
    >
      {/* Title & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-secondary/25 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          Chronological audit trail of analyzed websites and intervention events
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search domains..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-44 rounded-md border border-border/80 bg-background/50 pl-8 pr-3 text-xs text-heading placeholder:text-muted-foreground focus:border-analysis focus:outline-none focus:ring-1 focus:ring-analysis"
            />
          </div>
          <div className="flex rounded-md border border-border/80 bg-background/30 p-0.5">
            {(['all', 'high', 'medium', 'low'] as const).map((sev) => (
              <button
                key={sev}
                onClick={() => setFilterSeverity(sev)}
                className={`rounded px-2.5 py-1 text-[10px] font-semibold capitalize transition-colors ${
                  filterSeverity === sev
                    ? 'bg-analysis/20 text-analysis'
                    : 'text-muted-foreground hover:bg-secondary hover:text-heading'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>
      </div>

      <ol aria-label="Sample website analysis history" className="m-0">
        {filteredScans.length > 0 ? (
          filteredScans.map((scan, index) => {
            const isNew = scan.id === newlyAddedId;
            const tone = severityStyle[scan.severity] || severityStyle.low;
            
            return (
              <li
                key={scan.id}
                className={`relative grid grid-cols-[22px_minmax(0,1fr)] gap-3 border-b border-border/65 px-4 py-4 last:border-b-0 sm:gap-4 sm:py-4 ${isNew ? 'row-new' : ''}`}
              >
                <span className="relative flex justify-center" aria-hidden="true">
                  {index < filteredScans.length - 1 && (
                    <span className="absolute bottom-[-17px] top-2 w-px bg-border/70" />
                  )}
                  <span
                    className={cn(
                      "relative z-10 mt-1 h-2.5 w-2.5 border bg-background",
                      tone.border,
                    )}
                  />
                </span>

                <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1.25fr)_minmax(125px,0.7fr)_minmax(130px,0.8fr)_minmax(150px,0.9fr)_auto] sm:items-center sm:gap-4">
                  <div className="min-w-0">
                    <p className="label-tech mb-1">Website</p>
                    <p className="break-all font-mono text-xs font-medium text-heading sm:text-sm">
                      {scan.domain}
                    </p>
                    <p className="max-w-full truncate font-mono text-[10px] text-muted-foreground mt-0.5" title={scan.url}>
                      {scan.url}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 sm:block">
                    <div>
                      <p className="label-tech mb-1">Risk score</p>
                      <p className="font-mono text-sm font-semibold text-heading">
                        {scan.score}
                        <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                          /100
                        </span>
                      </p>
                    </div>
                    <div className="sm:mt-1.5">
                      <RiskBadge severity={scan.severity.toUpperCase() as any} />
                    </div>
                  </div>

                  <div className="min-w-0">
                    <p className="label-tech mb-1">Threat category</p>
                    <p className="break-words font-mono text-[11px] text-muted-foreground">
                      {scan.threat_category.replace('_', ' ')}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-3 sm:block">
                    <div className="min-w-0">
                      <p className="label-tech mb-1">Date / time</p>
                      <time
                        dateTime={scan.scanned_at}
                        className="font-mono text-[10px] leading-relaxed text-muted-foreground"
                      >
                        {new Date(scan.scanned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </time>
                    </div>
                  </div>

                  <div className="flex items-center justify-end sm:mt-1">
                    <button
                      onClick={() => onSelectScan(scan)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border/80 bg-secondary/50 px-2.5 py-1.5 text-[10px] font-medium text-heading transition-colors hover:bg-secondary"
                    >
                      {loadingScanId === scan.id ? (
                        <>
                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-analysis border-t-transparent" />
                          Loading...
                        </>
                      ) : (
                        <>
                          <Eye className="h-3 w-3" /> Inspect
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </li>
            );
          })
        ) : (
          <div className="p-8 text-center text-xs text-muted-foreground">
            No scans match the active search or severity filter.
          </div>
        )}
      </ol>
    </Panel>
  );
}
