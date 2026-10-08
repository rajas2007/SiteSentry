'use client';

import React, { useState } from 'react';
import { History, Search, Eye } from 'lucide-react';
import { ScanHistoryItem } from '../lib/types';
import { RiskBadge } from './sentry/primitives';

interface RecentScansTableProps {
  scans: ScanHistoryItem[];
  onSelectScan: (item: ScanHistoryItem) => void;
  title?: string;
  isFullHistory?: boolean;
  newlyAddedId?: string | null;
}

export default function RecentScansTable({ 
  scans, 
  onSelectScan, 
  title = 'Real-Time Scan Audit Ledger',
  isFullHistory = false,
  newlyAddedId = null,
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
    <div className="scan-surface mb-8 rounded-md border border-border/60">
      
      {/* Title & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 p-5 bg-background/50">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold text-heading">
            <History className="h-4 w-4 text-analysis" /> {title}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Chronological audit trail of analyzed websites and intervention events
          </p>
        </div>

        {/* Search & Pills */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search box */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter domain..."
              className="h-9 w-44 rounded-md border border-border/80 bg-background/50 pl-8 pr-3 text-xs text-heading placeholder:text-muted-foreground focus:border-analysis focus:outline-none focus:ring-1 focus:ring-analysis"
            />
          </div>

          {/* Severity Pills */}
          <div className="flex rounded-md border border-border/80 bg-background/30 p-0.5">
            {(['all', 'high', 'medium', 'low'] as const).map((sev) => (
              <button
                key={sev}
                onClick={() => setFilterSeverity(sev)}
                className={`rounded px-3 py-1.5 text-[10px] font-semibold capitalize transition-colors ${
                  filterSeverity === sev
                    ? 'bg-analysis/20 text-analysis'
                    : 'text-muted-foreground hover:bg-secondary/50 hover:text-heading'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-background/30 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border/60">
              <th className="px-5 py-3 font-medium">Domain & Target URL</th>
              <th className="px-5 py-3 font-medium">Trust Score</th>
              <th className="px-5 py-3 font-medium">Threat Category</th>
              <th className="px-5 py-3 font-medium">Verdict</th>
              <th className="px-5 py-3 font-medium">Scanned At</th>
              <th className="px-5 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {filteredScans.length > 0 ? (
              filteredScans.map((scan) => {
                const isNew = scan.id === newlyAddedId;

                return (
                  <tr 
                    key={scan.id} 
                    className={`transition-colors hover:bg-secondary/20 ${isNew ? 'row-new' : ''}`}
                  >
                    <td className="px-5 py-3">
                      <div className="text-sm font-medium text-heading">
                        {scan.domain}
                      </div>
                      <div className="max-w-[270px] truncate font-mono text-[10px] text-muted-foreground mt-0.5">
                        {scan.url}
                      </div>
                    </td>

                    <td className="px-5 py-3">
                      <div className="flex items-baseline gap-1">
                        <span className={`text-base font-bold ${scan.severity === 'high' ? 'text-danger' : scan.severity === 'medium' ? 'text-caution' : 'text-safe'}`}>
                          {scan.score}
                        </span>
                        <span className="text-[10px] text-muted-foreground">/100</span>
                      </div>
                    </td>

                    <td className="px-5 py-3">
                      <span className="inline-flex rounded-sm bg-secondary/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        {scan.threat_category.replace('_', ' ')}
                      </span>
                    </td>

                    <td className="px-5 py-3">
                      <RiskBadge severity={scan.severity.toUpperCase() as any} />
                    </td>

                    <td className="px-5 py-3 font-mono text-[10px] text-muted-foreground">
                      {new Date(scan.scanned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>

                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => onSelectScan(scan)}
                        className="inline-flex items-center gap-1.5 rounded bg-secondary px-2.5 py-1.5 text-[11px] font-medium text-heading opacity-70 transition-all hover:bg-secondary/80 hover:opacity-100 border border-border/50"
                      >
                        <Eye className="h-3.5 w-3.5" /> Inspect
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="p-8 text-center text-xs text-muted-foreground">
                  No scans match the active search or severity filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
