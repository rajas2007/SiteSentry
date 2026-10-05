'use client';

import React, { useState } from 'react';
import { History, Search, Eye } from 'lucide-react';
import { ScanHistoryItem } from '../lib/types';

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
    <div className="glass-panel" style={{ padding: '1.75rem', marginBottom: '2rem' }}>
      
      {/* Title & Filter Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.15rem', flexWrap: 'wrap', gap: '0.85rem' }}>
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <History size={17} color="#38bdf8" /> {title}
          </h3>
          <p style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
            Chronological audit trail of analyzed websites and intervention events
          </p>
        </div>

        {/* Search & Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          {/* Search box */}
          <div style={{ position: 'relative' }}>
            <Search size={13} color="var(--text-muted)" style={{ position: 'absolute', left: '9px', top: '9px' }} />
            <input
              type="text"
              id="scans-table-filter-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter domain..."
              className="input-field"
              style={{ width: '165px', height: '32px', fontSize: '0.75rem', paddingLeft: '1.85rem' }}
            />
          </div>

          {/* Severity Pills */}
          <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.04)', borderRadius: '7px', padding: '2px', border: '1px solid var(--border-subtle)' }}>
            {(['all', 'high', 'medium', 'low'] as const).map((sev) => (
              <button
                key={sev}
                onClick={() => setFilterSeverity(sev)}
                style={{
                  padding: '0.2rem 0.6rem',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  borderRadius: '5px',
                  border: 'none',
                  cursor: 'pointer',
                  background: filterSeverity === sev ? 'rgba(2, 132, 199, 0.22)' : 'transparent',
                  color: filterSeverity === sev ? '#38bdf8' : 'var(--text-muted)',
                  textTransform: 'capitalize',
                  transition: 'all 160ms var(--ease-out-smooth)'
                }}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-dim)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <th style={{ padding: '0.65rem 0.85rem' }}>Domain & Target URL</th>
              <th style={{ padding: '0.65rem 0.85rem' }}>Trust Score</th>
              <th style={{ padding: '0.65rem 0.85rem' }}>Threat Category</th>
              <th style={{ padding: '0.65rem 0.85rem' }}>Verdict</th>
              <th style={{ padding: '0.65rem 0.85rem' }}>Scanned At</th>
              <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredScans.length > 0 ? (
              filteredScans.map((scan) => {
                const isSafe = scan.score >= 80;
                const isMedium = scan.score >= 50 && scan.score < 80;
                const badgeTheme = isSafe ? 'badge-emerald' : isMedium ? 'badge-amber' : 'badge-rose';
                const isNew = scan.id === newlyAddedId;

                return (
                  <tr 
                    key={scan.id} 
                    className={`table-row-hover ${isNew ? 'row-new' : ''}`}
                    style={{ 
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    }}
                  >
                    <td style={{ padding: '0.75rem 0.85rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)', fontFamily: 'var(--font-heading)', fontSize: '0.85rem' }}>
                        {scan.domain}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', maxWidth: '270px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>
                        {scan.url}
                      </div>
                    </td>

                    <td style={{ padding: '0.75rem 0.85rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span style={{ 
                          fontWeight: 800, 
                          fontFamily: 'var(--font-heading)',
                          fontSize: '0.95rem',
                          color: isSafe ? 'var(--emerald-400)' : isMedium ? 'var(--amber-400)' : 'var(--rose-400)'
                        }}>
                          {scan.score}
                        </span>
                        <span style={{ fontSize: '0.62rem', color: 'var(--text-dim)' }}>/100</span>
                      </div>
                    </td>

                    <td style={{ padding: '0.75rem 0.85rem' }}>
                      <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)' }}>
                        {scan.threat_category.replace('_', ' ')}
                      </span>
                    </td>

                    <td style={{ padding: '0.75rem 0.85rem' }}>
                      <span className={`badge ${badgeTheme}`}>
                        {scan.verdict.toUpperCase()}
                      </span>
                    </td>

                    <td style={{ padding: '0.75rem 0.85rem', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                      {new Date(scan.scanned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>

                    <td style={{ padding: '0.75rem 0.85rem', textAlign: 'right' }}>
                      <button
                        onClick={() => onSelectScan(scan)}
                        className="btn btn-secondary action-btn"
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.72rem', borderRadius: '6px' }}
                      >
                        <Eye size={12} /> Inspect
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
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
