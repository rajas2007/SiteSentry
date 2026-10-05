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
    <div className="page-transition" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '850px' }}>
      <div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Platform Configuration & Sensitivity</h2>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          Manage detection engine thresholds, third-party API credentials, and audit logging export.
        </p>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
        
        <div className="glass-panel" style={{ padding: '1.75rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <Sliders size={18} color="#22d3ee" /> Detection Engine Sensitivity
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>High-Severity Block Threshold (Score &lt; {highRiskThreshold})</label>
                <span className="badge badge-rose">{highRiskThreshold}</span>
              </div>
              <input
                type="range"
                min="30"
                max="70"
                value={highRiskThreshold}
                onChange={(e) => setHighRiskThreshold(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--cyan-400)' }}
              />
              <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '0.35rem' }}>
                Pages scoring below this threshold will immediately trigger the full-screen warning overlay and lock password inputs.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 0', borderTop: '1px solid var(--border-subtle)' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Strict Intervention Mode</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Block unencrypted HTTP login forms immediately regardless of domain age.</div>
              </div>
              <input
                type="checkbox"
                checked={strictMode}
                onChange={(e) => setStrictMode(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: 'var(--cyan-400)', cursor: 'pointer' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 0', borderTop: '1px solid var(--border-subtle)' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Aggressive Tracker Defense</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Penalize websites containing more than 10 third-party tracking cookies.</div>
              </div>
              <input
                type="checkbox"
                checked={blockTrackers}
                onChange={(e) => setBlockTrackers(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: 'var(--cyan-400)', cursor: 'pointer' }}
              />
            </div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.75rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <Key size={18} color="#a78bfa" /> External Intelligence Credentials
          </h3>

          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>
              OpenAI API Key (For Privacy Policy AI Parsing)
            </label>
            <input
              type="password"
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              placeholder="sk-proj-..."
              className="input-field"
              style={{ fontSize: '0.85rem' }}
            />
            <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '0.35rem' }}>
              Used by PrivacyIntelligenceEngine to extract data-selling and third-party sharing clauses.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <button
            type="button"
            onClick={handleExportJSON}
            className="btn btn-secondary"
            style={{ fontSize: '0.82rem' }}
          >
            <Download size={14} /> Export Scan Ledger (JSON)
          </button>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ fontSize: '0.85rem', padding: '0.65rem 1.75rem' }}
          >
            {saved ? (
              <>
                <Check size={16} /> Preferences Saved
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
