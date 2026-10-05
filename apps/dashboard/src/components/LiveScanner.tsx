'use client';

import React, { useState, useRef } from 'react';
import { Sparkles, Loader2, Check, Server, Cpu, Layers, ExternalLink } from 'lucide-react';
import { DetailedScanResult } from '../lib/types';
import { performLiveScan } from '../lib/api';
import ScoreGauge from './ScoreGauge';

interface LiveScannerProps {
  onScanComplete: (result: DetailedScanResult) => void;
  onInspect: (result: DetailedScanResult) => void;
}

const PRESET_TARGETS = [
  { label: 'PayPal Phish (High Risk)', url: 'http://login.paypal.verify-account.security-update.xyz/auth' },
  { label: 'GitHub Official (Safe)', url: 'https://github.com/rajas2007/SiteSentry' },
  { label: 'Ad Tracker Site (Privacy)', url: 'https://shopping-deals-unlimited.biz/checkout' },
  { label: 'Free Crypto (Phishing)', url: 'https://crypto-airdrop-rewards-free.net/connect-wallet' },
];

export default function LiveScanner({ onScanComplete, onInspect }: LiveScannerProps) {
  const [targetUrl, setTargetUrl] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [lastResult, setLastResult] = useState<DetailedScanResult | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const steps = [
    { name: 'DNS & SSL Transport', desc: 'Validating certificate authority & nameserver records' },
    { name: 'OSINT Threat Consensus', desc: 'Querying Google Safe Browsing & VirusTotal feeds' },
    { name: 'Structural DOM Analysis', desc: 'Scanning forms, hidden fields & obfuscated scripts' },
    { name: 'Privacy Engine', desc: 'Evaluating tracking cookies & data sharing clauses' },
  ];

  const handleScan = async (urlToScan?: string) => {
    const target = urlToScan || targetUrl;
    if (!target.trim() || isScanning) return;

    setIsScanning(true);
    setIsComplete(false);
    setLastResult(null);
    setCurrentStep(0);

    const stepInterval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < 3) return prev + 1;
        clearInterval(stepInterval);
        return prev;
      });
    }, 450);

    try {
      const result = await performLiveScan(target.trim());
      clearInterval(stepInterval);
      setCurrentStep(4);
      setLastResult(result);
      setIsComplete(true);
      onScanComplete(result);

      setTimeout(() => {
        setIsComplete(false);
      }, 3000);
    } catch (err) {
      clearInterval(stepInterval);
      console.error('Scan error:', err);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '1.75rem', marginBottom: '2rem' }}>
      
      {/* Title & Preset Chips */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={18} color="#38bdf8" /> Real-Time Deep URL Inspection
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Execute multi-engine heuristic, OSINT consensus, and privacy scanning
          </p>
        </div>

        {/* Preset Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginRight: '0.2rem' }}>Try:</span>
          {PRESET_TARGETS.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setTargetUrl(preset.url);
                handleScan(preset.url);
              }}
              disabled={isScanning}
              className="btn btn-secondary"
              style={{
                fontSize: '0.72rem',
                padding: '0.2rem 0.55rem',
                borderRadius: '6px',
                height: '26px',
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input Row */}
      <form onSubmit={(e) => { e.preventDefault(); handleScan(); }} style={{ display: 'flex', gap: '0.65rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <input
          ref={inputRef}
          type="text"
          id="live-scanner-url-input"
          value={targetUrl}
          onChange={(e) => setTargetUrl(e.target.value)}
          placeholder="Enter website URL to analyze (e.g. https://paypal-security-alert.xyz)..."
          className="input-field"
          style={{ flex: '1', minWidth: '280px', height: '44px', fontSize: '0.88rem' }}
          disabled={isScanning}
        />
        <button
          type="submit"
          id="live-scanner-submit-btn"
          disabled={isScanning || !targetUrl.trim()}
          className="btn btn-primary"
          style={{ 
            height: '44px', 
            padding: '0 1.4rem',
            background: isComplete ? '#059669' : undefined,
          }}
        >
          {isScanning ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Analyzing...</span>
            </>
          ) : isComplete ? (
            <>
              <Check size={16} />
              <span>Analysis Complete</span>
            </>
          ) : (
            <>
              <Sparkles size={16} />
              <span>Analyze</span>
            </>
          )}
        </button>
      </form>

      {/* Step Progress Bar */}
      {isScanning && (
        <div style={{
          padding: '1.15rem 1.25rem',
          background: 'rgba(10, 14, 25, 0.5)',
          borderRadius: '12px',
          border: '1px solid var(--border-subtle)',
          marginBottom: '1.25rem',
          animation: 'pageEnter 200ms var(--ease-out-smooth) forwards'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
            {steps.map((step, idx) => {
              const isDone = currentStep > idx;
              const isCurrent = currentStep === idx;
              return (
                <div key={idx} style={{ opacity: isDone || isCurrent ? 1 : 0.45, transition: 'opacity 250ms ease' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.25rem' }}>
                    <div style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      background: isDone ? 'var(--emerald-500)' : isCurrent ? 'var(--cyan-500)' : 'rgba(255, 255, 255, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      color: '#ffffff',
                      transition: 'background 250ms ease'
                    }}>
                      {isDone ? '✓' : idx + 1}
                    </div>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: isCurrent ? '#38bdf8' : 'var(--text-main)' }}>
                      {step.name}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{step.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Scan Result Card */}
      {lastResult && !isScanning && (
        <div style={{
          padding: '1.35rem',
          borderRadius: '14px',
          background: lastResult.score >= 80 ? 'rgba(16, 185, 129, 0.05)' : lastResult.score >= 50 ? 'rgba(245, 158, 11, 0.05)' : 'rgba(244, 63, 94, 0.05)',
          border: `1px solid ${lastResult.score >= 80 ? 'rgba(16, 185, 129, 0.25)' : lastResult.score >= 50 ? 'rgba(245, 158, 11, 0.25)' : 'rgba(244, 63, 94, 0.25)'}`,
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1.25rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.15rem' }}>
              <div className="stagger-item stagger-1">
                <ScoreGauge score={lastResult.score} size={64} strokeWidth={5} />
              </div>

              <div>
                <div className="stagger-item stagger-2" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                    {lastResult.domain}
                  </span>
                  <span className={`badge badge-${lastResult.decision.ui.color}`}>
                    {lastResult.decision.action.toUpperCase()}
                  </span>
                  <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.06)', color: 'var(--text-muted)', fontSize: '0.68rem' }}>
                    {lastResult.threat_category.replace('_', ' ')}
                  </span>
                </div>

                <p className="stagger-item stagger-3" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {lastResult.recommendations[0] || 'Analysis successfully completed.'}
                </p>
              </div>
            </div>

            <div className="stagger-item stagger-4" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <button
                onClick={() => onInspect(lastResult)}
                className="btn btn-secondary"
                style={{ fontSize: '0.78rem', padding: '0.45rem 0.85rem' }}
              >
                <Layers size={13} /> Full Report
              </button>
              <a
                href={lastResult.url}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary"
                style={{ fontSize: '0.78rem', padding: '0.45rem 0.65rem', color: 'var(--text-dim)' }}
                title="Open in new tab"
              >
                <ExternalLink size={13} />
              </a>
            </div>
          </div>

          <div className="stagger-item stagger-5" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '0.75rem',
            paddingTop: '0.85rem',
            borderTop: '1px solid var(--border-subtle)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.73rem', color: 'var(--text-muted)' }}>
              <Server size={14} color="var(--cyan-400)" />
              <span>OSINT: {lastResult.threat_intelligence?.sources?.[0]?.summary || 'Safe browsing verified'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.73rem', color: 'var(--text-muted)' }}>
              <Cpu size={14} color="var(--purple-400)" />
              <span>Factors: {lastResult.factors?.[0] || 'Standard payload verified'}</span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
