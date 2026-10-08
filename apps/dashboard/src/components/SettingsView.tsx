'use client';

import React, { useState } from 'react';
import { Sliders, Key, Download, Check } from 'lucide-react';
import { SAMPLE_SCANS } from '../lib/api';

export default function SettingsView() {
  const [strictMode, setStrictMode] = useState(false);
  const [blockTrackers, setBlockTrackers] = useState(true);
  const [highRiskThreshold, setHighRiskThreshold] = useState(50);
  const [openaiKey, setOpenaiKey] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(SAMPLE_SCANS, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `sitesentry-audit-ledger-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="page-transition flex flex-col gap-8 max-w-[850px]">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-heading sm:text-2xl">Platform Configuration & Sensitivity</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Manage detection engine thresholds, third-party API credentials, and audit logging export. (Note: These settings are read-only UI states in this prototype and do not affect the live engine.)
        </p>
      </div>

      <form onSubmit={handleSave} className="flex flex-col gap-6">
        
        <div className="rounded-md border border-border/60 bg-card p-6 scan-surface">
          <h3 className="mb-6 flex items-center gap-2 text-sm font-semibold text-heading">
            <Sliders className="h-4 w-4 text-analysis" /> Detection Engine Sensitivity
          </h3>

          <div className="flex flex-col gap-6">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <label className="text-sm font-semibold text-heading">High-Severity Block Threshold (Score &lt; {highRiskThreshold})</label>
                <span className="inline-flex rounded-sm bg-danger/20 px-2 py-0.5 text-xs font-semibold text-danger">
                  {highRiskThreshold}
                </span>
              </div>
              <input
                type="range"
                min="30"
                max="70"
                value={highRiskThreshold}
                onChange={(e) => setHighRiskThreshold(Number(e.target.value))}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-secondary outline-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-analysis [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(140,184,208,0.5)]"
              />
              <p className="mt-2 text-[11px] text-muted-foreground">
                Pages scoring below this threshold will immediately trigger the full-screen warning overlay and lock password inputs.
              </p>
            </div>

            <div className="flex items-center justify-between border-t border-border/40 pt-5">
              <div>
                <div className="text-sm font-semibold text-heading">Strict Intervention Mode</div>
                <div className="text-xs text-muted-foreground mt-0.5">Block unencrypted HTTP login forms immediately regardless of domain age.</div>
              </div>
              <input
                type="checkbox"
                checked={strictMode}
                onChange={(e) => setStrictMode(e.target.checked)}
                className="h-4 w-4 cursor-pointer rounded border-border/80 bg-background/50 accent-analysis"
              />
            </div>

            <div className="flex items-center justify-between border-t border-border/40 pt-5">
              <div>
                <div className="text-sm font-semibold text-heading">Aggressive Tracker Defense</div>
                <div className="text-xs text-muted-foreground mt-0.5">Penalize websites containing more than 10 third-party tracking cookies.</div>
              </div>
              <input
                type="checkbox"
                checked={blockTrackers}
                onChange={(e) => setBlockTrackers(e.target.checked)}
                className="h-4 w-4 cursor-pointer rounded border-border/80 bg-background/50 accent-analysis"
              />
            </div>
          </div>
        </div>

        <div className="rounded-md border border-border/60 bg-card p-6">
          <h3 className="mb-5 flex items-center gap-2 text-sm font-semibold text-heading">
            <Key className="h-4 w-4 text-[#8b5cf6]" /> External Intelligence Credentials
          </h3>

          <div>
            <label className="mb-2 block text-sm font-semibold text-heading">
              OpenAI API Key (For Privacy Policy AI Parsing)
            </label>
            <input
              type="password"
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              placeholder="sk-proj-..."
              className="w-full rounded-md border border-border/80 bg-background/50 px-3 py-2 text-sm text-heading placeholder:text-muted-foreground focus:border-analysis focus:outline-none focus:ring-1 focus:ring-analysis"
            />
            <p className="mt-2 text-[11px] text-muted-foreground">
              Used by PrivacyIntelligenceEngine to extract data-selling and third-party sharing clauses.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 mt-2">
          <button
            type="button"
            onClick={handleExportJSON}
            className="inline-flex items-center gap-2 rounded-md border border-border/80 bg-secondary/30 px-4 py-2 text-sm font-medium text-heading transition-colors hover:bg-secondary/60"
          >
            <Download className="h-4 w-4" /> Export Scan Ledger (JSON)
          </button>

          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-md bg-analysis px-6 py-2 text-sm font-semibold text-[#0f172a] shadow-sm transition-all hover:bg-analysis/90 hover:shadow-[0_0_15px_rgba(140,184,208,0.3)]"
          >
            {saved ? (
              <>
                <Check className="h-4 w-4" /> Preferences Saved
              </>
            ) : (
              'Save Preferences'
            )}
          </button>
        </div>

      </form>
    </div>
  );
}
