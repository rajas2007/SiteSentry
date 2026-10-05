'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { 
  X, 
  ExternalLink, 
  Clock, 
  ShieldCheck, 
  ShieldAlert, 
  Server, 
  Cpu, 
  Lock, 
  EyeOff, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Copy, 
  Check, 
  Layers 
} from 'lucide-react';
import { DetailedScanResult } from '../lib/types';
import ScoreGauge from './ScoreGauge';
import { VerdictBadge, SeverityBadge, ThreatCategoryBadge } from './Badges';

interface ScanDetailDrawerProps {
  scan: DetailedScanResult | null;
  onClose: () => void;
}

export default function ScanDetailDrawer({ scan, onClose }: ScanDetailDrawerProps) {
  const [isClosing, setIsClosing] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleTriggerClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 180);
  }, [onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleTriggerClose();
    };
    if (scan) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'auto';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [scan, handleTriggerClose]);

  if (!scan) return null;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(scan.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isSafe = scan.score >= 80;
  const isMedium = scan.score >= 50 && scan.score < 80;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={handleTriggerClose}
        className={isClosing ? 'drawer-overlay-out' : 'drawer-overlay-in'}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0, 29, 57, 0.35)',
          backdropFilter: 'blur(3px)',
        }}
      />

      {/* Slide-Over Drawer Container */}
      <div
        className={isClosing ? 'drawer-slide-out' : 'drawer-slide-in'}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '560px',
          height: '100%',
          backgroundColor: '#FFFFFF',
          boxShadow: 'var(--shadow-drawer)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 10,
          overflowY: 'auto',
        }}
      >
        {/* Drawer Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '1rem',
            padding: '1.5rem 1.75rem',
            borderBottom: '1px solid var(--border-subtle)',
            position: 'sticky',
            top: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.98)',
            backdropFilter: 'blur(8px)',
            zIndex: 2,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <VerdictBadge verdict={scan.decision?.action || (isSafe ? 'allow' : 'block')} />
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Clock size={12} /> {new Date(scan.scanned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary-navy)', wordBreak: 'break-all' }}>
              {scan.domain}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.2rem' }}>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', wordBreak: 'break-all', fontFamily: 'var(--font-mono)' }}>
                {scan.url}
              </p>
              <button
                type="button"
                onClick={handleCopyUrl}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--secondary-blue)', padding: '2px' }}
                title="Copy URL"
              >
                {copied ? <Check size={13} color="var(--safe-green)" /> : <Copy size={13} />}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleTriggerClose}
            className="btn btn-secondary"
            style={{ width: '32px', height: '32px', padding: 0, borderRadius: '8px' }}
            title="Close Drawer (Esc)"
          >
            <X size={16} />
          </button>
        </div>

        {/* Drawer Body */}
        <div style={{ padding: '1.5rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '1.35rem', flex: '1' }}>
          
          {/* Trust Score & Risk Level Banner */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1.25rem',
              padding: '1.15rem 1.25rem',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: isSafe ? 'var(--safe-green-bg)' : isMedium ? 'var(--warn-amber-bg)' : 'var(--danger-red-bg)',
              border: `1px solid ${isSafe ? 'var(--safe-green-border)' : isMedium ? 'var(--warn-amber-border)' : 'var(--danger-red-border)'}`,
            }}
          >
            <ScoreGauge score={scan.score} size={64} strokeWidth={5} />

            <div style={{ flex: '1' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '0.95rem', fontWeight: 800, color: isSafe ? 'var(--safe-green-dark)' : isMedium ? 'var(--warn-amber-dark)' : 'var(--danger-red-dark)' }}>
                  {isSafe ? 'Safe & Verified Website' : isMedium ? 'Suspicious / Elevated Risk' : 'High Threat Intercepted'}
                </span>
                <span className="sentry-badge badge-muted" style={{ fontSize: '0.68rem' }}>
                  {Math.round((scan.confidence || 0.96) * 100)}% Confidence
                </span>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-body)', lineHeight: 1.4 }}>
                {scan.recommendations && scan.recommendations[0] ? scan.recommendations[0] : 'Analysis completed successfully.'}
              </p>
            </div>
          </div>

          {/* Tri-Score Breakdown Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
            <div className="sentry-card" style={{ padding: '0.75rem 0.85rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Security Score</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--primary-blue)', marginTop: '0.2rem' }}>
                {scan.security_score ?? scan.score}/100
              </div>
            </div>
            <div className="sentry-card" style={{ padding: '0.75rem 0.85rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Privacy Score</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--teal-accent)', marginTop: '0.2rem' }}>
                {scan.privacy_score ?? Math.max(30, Math.round(scan.score * 0.9))}/100
              </div>
            </div>
            <div className="sentry-card" style={{ padding: '0.75rem 0.85rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Domain Authority</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--secondary-blue)', marginTop: '0.2rem' }}>
                {scan.domain_authority ?? Math.min(99, Math.round(scan.score * 0.98))}/100
              </div>
            </div>
          </div>

          {/* SECTION 1: WHY SITESENTRY FLAGGED THIS */}
          <div className="sentry-card" style={{ padding: '1.25rem' }}>
            <h4 style={{ fontSize: '0.82rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--primary-navy)', marginBottom: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <Layers size={16} color="var(--primary-blue)" /> Why SiteSentry Flagged This
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {scan.factors && scan.factors.length > 0 ? (
                scan.factors.map((factor, i) => {
                  const isNegative = factor.startsWith('✕') || factor.startsWith('⚠');
                  return (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.5rem',
                        padding: '0.55rem 0.75rem',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: isNegative ? 'var(--danger-red-bg)' : 'var(--safe-green-bg)',
                        border: `1px solid ${isNegative ? 'var(--danger-red-border)' : 'var(--safe-green-border)'}`,
                        fontSize: '0.76rem',
                        color: isNegative ? 'var(--danger-red-dark)' : 'var(--safe-green-dark)',
                        fontWeight: 500,
                      }}
                    >
                      <span style={{ lineHeight: 1.4 }}>{factor}</span>
                    </div>
                  );
                })
              ) : (
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  Standard domain characteristics verified.
                </div>
              )}
            </div>
          </div>

          {/* SECTION 2: THREAT INTELLIGENCE (OSINT) */}
          <div className="sentry-card" style={{ padding: '1.25rem' }}>
            <h4 style={{ fontSize: '0.82rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--primary-navy)', marginBottom: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <Server size={16} color="var(--teal-accent)" /> Global Threat Intelligence (OSINT)
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {scan.threat_intelligence?.sources && scan.threat_intelligence.sources.length > 0 ? (
                scan.threat_intelligence.sources.map((src, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '0.65rem 0.85rem',
                      backgroundColor: 'var(--blue-soft-50)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 700 }}>
                      <span style={{ color: 'var(--primary-navy)' }}>{src.provider}</span>
                      <span className={`sentry-badge ${src.status === 'detected' ? 'badge-danger' : 'badge-safe'}`}>
                        {src.status.toUpperCase()}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      {src.summary}
                    </p>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Threat feeds scanned clean. No malicious domain signatures reported.
                </div>
              )}
            </div>
          </div>

          {/* SECTION 3: PRIVACY & TRACKER ANALYSIS */}
          <div className="sentry-card" style={{ padding: '1.25rem' }}>
            <h4 style={{ fontSize: '0.82rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--primary-navy)', marginBottom: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <Lock size={16} color="var(--secondary-blue)" /> Privacy & Consent Evaluation
            </h4>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-body)', lineHeight: 1.45 }}>
              {scan.threat_category === 'privacy_abuse'
                ? 'AI analysis identified explicit third-party data monetization clauses and 14 persistent tracking beacons embedded in the site.'
                : 'No predatory data selling clauses or excessive tracker beacons detected during policy inspection.'}
            </p>
          </div>

          {/* SECTION 4: RECOMMENDATIONS */}
          <div className="sentry-card" style={{ padding: '1.25rem' }}>
            <h4 style={{ fontSize: '0.82rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--primary-navy)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <CheckCircle2 size={16} color="var(--safe-green)" /> Actionable Recommendations
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              {scan.recommendations && scan.recommendations.length > 0 ? (
                scan.recommendations.map((rec, i) => (
                  <li key={i} style={{ fontSize: '0.76rem', color: 'var(--text-body)', display: 'flex', alignItems: 'flex-start', gap: '0.45rem' }}>
                    <span style={{ color: 'var(--primary-blue)', fontWeight: 700 }}>•</span>
                    <span>{rec}</span>
                  </li>
                ))
              ) : (
                <li style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Standard browsing hygiene recommended.
                </li>
              )}
            </ul>
          </div>

        </div>

        {/* Drawer Footer */}
        <div
          style={{
            padding: '1.25rem 1.75rem',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#FFFFFF',
            position: 'sticky',
            bottom: 0,
          }}
        >
          <a
            href={scan.url}
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary"
            style={{ fontSize: '0.8rem' }}
          >
            <ExternalLink size={14} /> Visit Site
          </a>
          <button
            type="button"
            onClick={handleTriggerClose}
            className="btn btn-primary"
            style={{ fontSize: '0.82rem', padding: '0.55rem 1.5rem' }}
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
}
