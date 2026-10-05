'use client';

import React from 'react';
import { ShieldAlert, ArrowRight, ExternalLink } from 'lucide-react';
import { ScanHistoryItem } from '../lib/types';
import { ScoreBadge, SeverityBadge, ThreatCategoryBadge } from './Badges';

interface HighRiskThreatsCardProps {
  threats: ScanHistoryItem[];
  onSelectThreat: (item: ScanHistoryItem) => void;
  onViewAllThreats: () => void;
}

export default function HighRiskThreatsCard({
  threats,
  onSelectThreat,
  onViewAllThreats,
}: HighRiskThreatsCardProps) {
  return (
    <div className="sentry-card" style={{ padding: '1.25rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <ShieldAlert size={17} color="var(--danger-red)" />
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--primary-navy)' }}>Recent High-Risk Threats</h3>
        </div>
        <span className="sentry-badge badge-danger">
          {threats.length} Flagged
        </span>
      </div>
      <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.85rem' }}>
        Recently intercepted credential theft, malware & deceptive phishing domains
      </p>

      {/* Threat Items List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', flex: 1 }}>
        {threats.length > 0 ? (
          threats.slice(0, 4).map((threat) => (
            <div
              key={threat.id}
              onClick={() => onSelectThreat(threat)}
              style={{
                padding: '0.65rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--danger-red-bg)',
                border: '1px solid var(--danger-red-border)',
                cursor: 'pointer',
                transition: 'all var(--duration-fast) ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--danger-red)', flexShrink: 0 }} />
                  <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--danger-red-dark)', maxWidth: '210px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {threat.domain}
                  </span>
                </div>
                <ScoreBadge score={threat.score} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-dark-muted)', marginTop: '0.2rem' }}>
                <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{threat.threat_category.replace(/_/g, ' ')}</span>
                <span>{new Date(threat.scanned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          ))
        ) : (
          <div style={{ fontSize: '0.76rem', color: 'var(--text-dim)', textAlign: 'center', padding: '2rem 0' }}>
            No high-risk threats detected in recent ledger.
          </div>
        )}
      </div>

      {/* View All Button */}
      <button
        type="button"
        onClick={onViewAllThreats}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.4rem',
          width: '100%',
          marginTop: '0.85rem',
          padding: '0.5rem',
          fontSize: '0.76rem',
          fontWeight: 700,
          color: 'var(--primary-blue)',
          backgroundColor: 'var(--blue-soft-50)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
          transition: 'all var(--duration-fast) ease',
        }}
      >
        <span>View all threats in ledger</span>
        <ArrowRight size={13} />
      </button>

    </div>
  );
}
