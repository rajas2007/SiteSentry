'use client';

import React, { useEffect, useState } from 'react';
import { 
  X, 
  ExternalLink, 
  Clock, 
  ShieldCheck, 
  ShieldAlert, 
  Server, 
  Cpu, 
  Lock 
} from 'lucide-react';
import { DetailedScanResult } from '../lib/types';
import ScoreGauge from './ScoreGauge';

interface ScanDetailModalProps {
  scan: DetailedScanResult | null;
  onClose: () => void;
}

export default function ScanDetailModal({ scan, onClose }: ScanDetailModalProps) {
  const [isClosing, setIsClosing] = useState(false);

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
  }, [scan]);

  if (!scan) return null;

  const handleTriggerClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 180);
  };

  const isSafe = scan.score >= 80;
  const isMedium = scan.score >= 50 && scan.score < 80;

  const themeBg = isSafe ? 'rgba(16, 185, 129, 0.08)' : isMedium ? 'rgba(245, 158, 11, 0.08)' : 'rgba(244, 63, 94, 0.08)';
  const themeBorder = isSafe ? 'rgba(16, 185, 129, 0.3)' : isMedium ? 'rgba(245, 158, 11, 0.3)' : 'rgba(244, 63, 94, 0.3)';

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
        className={isClosing ? 'overlay-exit' : 'overlay-enter'}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(3, 5, 8, 0.7)',
          backdropFilter: 'blur(4px)',
        }}
      />

      {/* Slide-over Drawer */}
      <div
        className={isClosing ? 'drawer-exit' : 'drawer-enter'}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '520px',
          height: '100%',
          background: 'var(--bg-surface)',
          borderLeft: '1px solid var(--border-subtle)',
          boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 10,
          overflowY: 'auto',
        }}
      >
        {/* Drawer Header */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '1rem',
          padding: '1.5rem 1.75rem',
          borderBottom: '1px solid var(--border-subtle)',
          position: 'sticky',
          top: 0,
          background: 'rgba(13, 17, 28, 0.98)',
          zIndex: 2,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <span className={`badge badge-${scan.decision?.ui?.color || (isSafe ? 'emerald' : isMedium ? 'amber' : 'rose')}`}>
                {scan.decision?.action?.toUpperCase() || (isSafe ? 'ALLOW' : 'BLOCK')}
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Clock size={12} /> {new Date(scan.scanned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, wordBreak: 'break-all', fontFamily: 'var(--font-heading)' }}>
              {scan.domain}
            </h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', wordBreak: 'break-all', fontFamily: 'var(--font-mono)' }}>
              {scan.url}
            </p>
          </div>

          <button
            onClick={handleTriggerClose}
            className="btn btn-secondary"
            style={{
              width: '32px',
              height: '32px',
              padding: 0,
              borderRadius: '8px',
              color: 'var(--text-muted)'
            }}
            title="Close Drawer (Esc)"
          >
            <X size={16} />
          </button>
        </div>

        {/* Drawer Body */}
        <div style={{ padding: '1.5rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '1.35rem', flex: '1' }}>
          
          {/* Score & Verdict Banner */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1.25rem',
            padding: '1.15rem 1.25rem',
            borderRadius: '12px',
            background: themeBg,
            border: `1px solid ${themeBorder}`,
          }}>
            <ScoreGauge score={scan.score} size={64} strokeWidth={5} />

            <div style={{ flex: '1' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff' }}>
                  {isSafe ? 'Low Security Risk' : isMedium ? 'Suspicious / Elevated Risk' : 'High Threat Intercepted'}
                </span>
                <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.08)', color: '#ffffff', fontSize: '0.66rem' }}>
                  Confidence: {Math.round((scan.confidence || 0.95) * 100)}%
                </span>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-main)', lineHeight: 1.4 }}>
                {scan.recommendations && scan.recommendations[0] ? scan.recommendations[0] : 'Analysis completed successfully.'}
              </p>
            </div>
          </div>

          {/* OSINT Feeds Card */}
          <div className="glass-card" style={{ padding: '1.1rem' }}>
            <h4 style={{ fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--cyan-400)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <Server size={15} /> Global Threat Intelligence (OSINT)
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {scan.threat_intelligence?.sources && scan.threat_intelligence.sources.length > 0 ? (
                scan.threat_intelligence.sources.map((src, i) => (
                  <div key={i} style={{ padding: '0.6rem 0.75rem', background: 'rgba(255, 255, 255, 0.025)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.76rem', fontWeight: 600 }}>
                      <span>{src.provider}</span>
                      <span className={`badge badge-${src.status === 'detected' ? 'rose' : src.status === 'clean' ? 'emerald' : 'amber'}`}>
                        {src.status.toUpperCase()}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{src.summary}</p>
                  </div>
                ))
              ) : (
                <div style={{ padding: '0.6rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Threat feeds scanned clean. No malicious domain signatures reported.
                </div>
              )}
            </div>
          </div>

          {/* Structural Signals */}
          <div className="glass-card" style={{ padding: '1.1rem' }}>
            <h4 style={{ fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--purple-400)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <Cpu size={15} /> Structural & Behavioral Signals
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              {scan.factors && scan.factors.length > 0 ? (
                scan.factors.map((factor, i) => (
                  <li key={i} style={{ fontSize: '0.75rem', color: 'var(--text-main)', display: 'flex', alignItems: 'flex-start', gap: '0.45rem' }}>
                    <span style={{ color: isSafe ? 'var(--emerald-400)' : 'var(--rose-400)', marginTop: '1px' }}>•</span>
                    <span>{factor}</span>
                  </li>
                ))
              ) : (
                <li style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Standard web page characteristics verified.
                </li>
              )}
            </ul>
          </div>

          {/* Privacy Assessment */}
          <div className="glass-card" style={{ padding: '1.1rem' }}>
            <h4 style={{ fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--amber-400)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <Lock size={15} /> Privacy & Consent Evaluation
            </h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              {scan.threat_category === 'privacy_abuse'
                ? 'AI analysis identified potential data selling or third-party marketing sharing clauses in the site policy.'
                : 'No predatory data selling clauses or excessive tracker beacons detected.'}
            </p>
          </div>

        </div>

        {/* Drawer Footer */}
        <div style={{
          padding: '1.25rem 1.75rem',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(13, 17, 28, 0.98)',
          position: 'sticky',
          bottom: 0,
        }}>
          <a
            href={scan.url}
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary"
            style={{ fontSize: '0.78rem' }}
          >
            <ExternalLink size={13} /> Visit Site
          </a>
          <button
            onClick={handleTriggerClose}
            className="btn btn-primary"
            style={{ fontSize: '0.78rem', padding: '0.5rem 1.25rem' }}
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
}
