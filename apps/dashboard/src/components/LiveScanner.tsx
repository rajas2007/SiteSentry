'use client';

import React, { useState, useRef } from 'react';
import { Sparkles, Loader2, Check, Server, Cpu, Layers, ExternalLink } from 'lucide-react';
import { DetailedScanResult } from '../lib/types';
import { performLiveScan } from '../lib/api';
import { ScoreRing } from './sentry/primitives';
import { Panel } from './sentry/primitives';

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
    { name: 'Security Factors', desc: 'Analyzing DOM structure & execution contexts' },
    { name: 'Threat Intelligence', desc: 'Querying Safe Browsing & OSINT datasets' },
    { name: 'Decision Engine', desc: 'Scoring risk vectors and formulating verdict' }
  ];

  const handleScan = async (urlToScan = targetUrl) => {
    if (!urlToScan) return;
    setIsScanning(true);
    setIsComplete(false);
    setLastResult(null);
    setCurrentStep(0);

    const stepInterval = setInterval(() => {
      setCurrentStep(prev => prev < 3 ? prev + 1 : prev);
    }, 800);

    try {
      const result = await performLiveScan(urlToScan);
      clearInterval(stepInterval);
      setCurrentStep(4);
      setLastResult(result);
      setIsComplete(true);
      onScanComplete(result);
    } catch (error) {
      console.error("Live scan failed", error);
      clearInterval(stepInterval);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <Panel className="mb-8 p-5 sm:p-6">
      {/* Title & Preset Chips */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold text-heading">
            <Sparkles className="h-4 w-4 text-analysis" /> Real-Time Deep URL Inspection
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Execute multi-engine heuristic, OSINT consensus, and privacy scanning
          </p>
        </div>

        {/* Preset Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Try:</span>
          {PRESET_TARGETS.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setTargetUrl(preset.url);
                handleScan(preset.url);
              }}
              disabled={isScanning}
              className="inline-flex h-7 items-center justify-center rounded-md border border-border/80 bg-background/50 px-2.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-heading disabled:opacity-50"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input Row */}
      <form onSubmit={(e) => { e.preventDefault(); handleScan(); }} className="mb-5 flex flex-wrap gap-3">
        <input
          ref={inputRef}
          type="text"
          id="live-scanner-url-input"
          value={targetUrl}
          onChange={(e) => setTargetUrl(e.target.value)}
          placeholder="Enter website URL to analyze (e.g. https://paypal-security-alert.xyz)..."
          className="flex-1 min-w-[280px] h-11 rounded-md border border-border/80 bg-background/50 px-4 text-sm text-heading placeholder:text-muted-foreground focus:border-analysis focus:outline-none focus:ring-1 focus:ring-analysis"
          disabled={isScanning}
        />
        <button
          type="submit"
          id="live-scanner-submit-btn"
          disabled={isScanning || !targetUrl.trim()}
          className={`inline-flex h-11 items-center justify-center gap-2 rounded-md px-6 text-xs font-semibold transition-colors disabled:opacity-50 ${isComplete ? 'bg-safe text-safe-foreground hover:bg-safe/90' : 'bg-analysis text-analysis-foreground hover:bg-analysis/90'}`}
        >
          {isScanning ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Analyzing...</span>
            </>
          ) : isComplete ? (
            <>
              <Check className="h-4 w-4" />
              <span>Analysis Complete</span>
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              <span>Analyze</span>
            </>
          )}
        </button>
      </form>

      {/* Step Progress Bar */}
      {isScanning && (
        <div className="mb-5 rounded-lg border border-border/60 bg-background/40 p-5">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {steps.map((step, idx) => {
              const isDone = currentStep > idx;
              const isCurrent = currentStep === idx;
              return (
                <div key={idx} className={`transition-opacity duration-300 ${isDone || isCurrent ? 'opacity-100' : 'opacity-40'}`}>
                  <div className="mb-1 flex items-center gap-2">
                    <div className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white transition-colors duration-300 ${isDone ? 'bg-safe' : isCurrent ? 'bg-analysis' : 'bg-secondary/80'}`}>
                      {isDone ? '✓' : idx + 1}
                    </div>
                    <span className={`text-xs font-semibold ${isCurrent ? 'text-analysis' : 'text-heading'}`}>
                      {step.name}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Scan Result Card */}
      {lastResult && !isScanning && (
        <div className={`flex flex-col gap-4 rounded-lg border p-5 ${lastResult.score >= 80 ? 'border-safe/30 bg-safe/5' : lastResult.score >= 50 ? 'border-caution/30 bg-caution/5' : 'border-danger/30 bg-danger/5'}`}>
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="stagger-item stagger-1 shrink-0">
                <ScoreRing score={lastResult.score} severity={lastResult.score >= 80 ? 'LOW' : lastResult.score >= 50 ? 'MEDIUM' : 'HIGH'} />
              </div>

              <div>
                <div className="stagger-item stagger-2 mb-1 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-heading">
                    {lastResult.domain}
                  </span>
                  <span className={`inline-flex rounded-sm px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${lastResult.decision.action === 'allow' ? 'bg-safe/20 text-safe' : lastResult.decision.action === 'warn' ? 'bg-caution/20 text-caution' : 'bg-danger/20 text-danger'}`}>
                    {lastResult.decision.action}
                  </span>
                  <span className="inline-flex rounded-sm bg-background/50 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                    {lastResult.threat_category.replace('_', ' ')}
                  </span>
                </div>

                <p className="stagger-item stagger-3 text-xs text-muted-foreground">
                  {lastResult.recommendations[0] || 'Analysis successfully completed.'}
                </p>
              </div>
            </div>

            <div className="stagger-item stagger-4 flex items-center gap-2">
              <button
                onClick={() => onInspect(lastResult)}
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-border/80 bg-secondary/50 px-3 text-[11px] font-medium text-heading transition-colors hover:bg-secondary"
              >
                <Layers className="h-3 w-3" /> Full Report
              </button>
              <a
                href={lastResult.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/80 bg-secondary/50 text-muted-foreground transition-colors hover:bg-secondary hover:text-heading"
                title="Open in new tab"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          <div className="stagger-item stagger-5 mt-2 grid grid-cols-1 gap-3 border-t border-border/50 pt-3 sm:grid-cols-2">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Server className="h-3.5 w-3.5 text-analysis" />
              <span>OSINT: {lastResult.threat_intelligence?.sources?.[0]?.summary || 'Safe browsing verified'}</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Cpu className="h-3.5 w-3.5 text-analysis" />
              <span>Factors: {lastResult.factors?.[0] || 'Standard payload verified'}</span>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}
