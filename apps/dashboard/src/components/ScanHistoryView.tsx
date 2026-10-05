'use client';

import React, { useState } from 'react';
import { History, Search, Download, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { ScanHistoryItem } from '../lib/types';
import { ScoreBadge, ThreatCategoryBadge, VerdictBadge, SeverityBadge } from './Badges';

interface ScanHistoryViewProps {
  scans: ScanHistoryItem[];
  onSelectScan: (item: ScanHistoryItem) => void;
  newlyAddedId?: string | null;
}

export default function ScanHistoryView({ scans, onSelectScan, newlyAddedId }: ScanHistoryViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [verdictFilter, setVerdictFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const filtered = scans.filter((s) => {
    const matchesSearch =
      s.domain.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.url.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSeverity = severityFilter === 'all' || s.severity === severityFilter;
    const matchesCategory = categoryFilter === 'all' || s.threat_category === categoryFilter;
    const matchesVerdict = verdictFilter === 'all' || s.verdict === verdictFilter;
    return matchesSearch && matchesSeverity && matchesCategory && matchesVerdict;
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  const paginatedItems = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleExportCSV = () => {
    const headers = ['ID,Domain,URL,TrustScore,SecurityScore,PrivacyScore,Severity,Verdict,Category,ScannedAt'];
    const rows = filtered.map(s => `"${s.id}","${s.domain}","${s.url}",${s.score},${s.security_score ?? s.score},${s.privacy_score ?? s.score},"${s.severity}","${s.verdict}","${s.threat_category}","${s.scanned_at}"`);
    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent([headers, ...rows].join('\n'));
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', `sitesentry-audit-ledger-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(filtered, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', dataStr);
    link.setAttribute('download', `sitesentry-audit-ledger-${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--primary-navy)', letterSpacing: '-0.03em' }}>
            Scan History
          </h1>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Complete historical audit ledger of inspected domains, security factors, and AI decisions
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <button
            type="button"
            onClick={handleExportCSV}
            className="btn btn-secondary"
            style={{ fontSize: '0.78rem' }}
          >
            <Download size={14} /> Export CSV
          </button>
          <button
            type="button"
            onClick={handleExportJSON}
            className="btn btn-secondary"
            style={{ fontSize: '0.78rem' }}
          >
            <Download size={14} /> Export JSON
          </button>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="sentry-card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'center' }}>
          
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={14} color="var(--secondary-blue)" style={{ position: 'absolute', left: '10px', top: '10px' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              placeholder="Search domain or URL..."
              className="sentry-input"
              style={{ fontSize: '0.8rem', height: '36px', paddingLeft: '2.1rem' }}
            />
          </div>

          {/* Severity Dropdown */}
          <div>
            <select
              value={severityFilter}
              onChange={(e) => { setSeverityFilter(e.target.value); setCurrentPage(1); }}
              className="sentry-input"
              style={{ fontSize: '0.8rem', height: '36px', cursor: 'pointer' }}
            >
              <option value="all">All Severities</option>
              <option value="low">Low Severity</option>
              <option value="medium">Medium Severity</option>
              <option value="high">High Severity</option>
            </select>
          </div>

          {/* Category Dropdown */}
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
              className="sentry-input"
              style={{ fontSize: '0.8rem', height: '36px', cursor: 'pointer' }}
            >
              <option value="all">All Threat Categories</option>
              <option value="safe">Safe & Verified</option>
              <option value="credential_theft">Credential Theft</option>
              <option value="privacy_abuse">Privacy Abuse</option>
              <option value="elevated_risk">Elevated Risk</option>
              <option value="suspicious_content">Suspicious Content</option>
            </select>
          </div>

          {/* Verdict Dropdown */}
          <div>
            <select
              value={verdictFilter}
              onChange={(e) => { setVerdictFilter(e.target.value); setCurrentPage(1); }}
              className="sentry-input"
              style={{ fontSize: '0.8rem', height: '36px', cursor: 'pointer' }}
            >
              <option value="all">All Verdicts</option>
              <option value="allow">ALLOW</option>
              <option value="warn">WARN</option>
              <option value="block">BLOCK</option>
            </select>
          </div>

        </div>
      </div>

      {/* Main Table */}
      <div className="sentry-card" style={{ padding: '1.25rem' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="sentry-table">
            <thead>
              <tr>
                <th>Domain / URL</th>
                <th>Security Score</th>
                <th>Privacy Score</th>
                <th>Trust Score</th>
                <th>Threat Category</th>
                <th>Severity</th>
                <th>Verdict</th>
                <th>Scanned At</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.length > 0 ? (
                paginatedItems.map((scan) => {
                  const isNew = scan.id === newlyAddedId;

                  return (
                    <tr key={scan.id} className={isNew ? 'row-new' : ''}>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--primary-navy)', fontSize: '0.86rem' }}>
                          {scan.domain}
                        </div>
                        <div
                          style={{
                            fontSize: '0.72rem',
                            color: 'var(--text-dim)',
                            maxWidth: '240px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          {scan.url}
                        </div>
                      </td>

                      <td>
                        <span style={{ fontWeight: 700, color: 'var(--primary-blue)', fontSize: '0.85rem' }}>
                          {scan.security_score ?? scan.score}
                        </span>
                      </td>

                      <td>
                        <span style={{ fontWeight: 700, color: 'var(--teal-accent)', fontSize: '0.85rem' }}>
                          {scan.privacy_score ?? Math.max(30, Math.round(scan.score * 0.9))}
                        </span>
                      </td>

                      <td>
                        <ScoreBadge score={scan.score} />
                      </td>

                      <td>
                        <ThreatCategoryBadge category={scan.threat_category} />
                      </td>

                      <td>
                        <SeverityBadge severity={scan.severity} />
                      </td>

                      <td>
                        <VerdictBadge verdict={scan.verdict} />
                      </td>

                      <td style={{ color: 'var(--text-dark-muted)', fontSize: '0.75rem' }}>
                        {new Date(scan.scanned_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => onSelectScan(scan)}
                          className="btn btn-secondary"
                          style={{ padding: '0.3rem 0.75rem', fontSize: '0.74rem', height: '28px' }}
                        >
                          <Eye size={12} /> View
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                    No audit records match the applied filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          <span>
            Showing {filtered.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to {Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length} entries
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <button
              type="button"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="btn btn-secondary"
              style={{ width: '32px', height: '32px', padding: 0 }}
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontWeight: 700, color: 'var(--primary-navy)', padding: '0 0.5rem' }}>
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="btn btn-secondary"
              style={{ width: '32px', height: '32px', padding: 0 }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
