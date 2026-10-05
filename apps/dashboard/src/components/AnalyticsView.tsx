'use client';

import React from 'react';
import { Server, CheckCircle2, ShieldAlert } from 'lucide-react';

export default function AnalyticsView() {
  const osintProviders = [
    { name: 'Google Safe Browsing v4', queries: 1248, detections: 34, coverage: '99.8%' },
    { name: 'VirusTotal v3 Multi-Vendor', queries: 1248, detections: 41, coverage: '99.2%' },
    { name: 'SiteSentry Structural Heuristics', queries: 1248, detections: 58, coverage: '100%' },
  ];

  const safeDomains = [
    { domain: 'github.com', score: 98, totalScans: 412, status: 'Verified High Trust' },
    { domain: 'developer.mozilla.org', score: 95, totalScans: 285, status: 'Educational Authority' },
    { domain: 'chat.openai.com', score: 96, totalScans: 190, status: 'Valid EV Transport' },
  ];

  const maliciousDomains = [
    { domain: 'verify-account.security-update.xyz', score: 12, reason: 'Credential Harvesting & Fake Login', blocked: 'Blocked 28 times' },
    { domain: 'crypto-airdrop-rewards-free.net', score: 25, reason: 'Deceptive Phishing Payload', blocked: 'Blocked 14 times' },
    { domain: 'shopping-deals-unlimited.biz', score: 48, reason: 'Excessive Privacy Exploitation', blocked: 'Blocked 9 times' },
  ];

  return (
    <div className="page-transition" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Threat Intelligence & OSINT Analytics</h2>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          Detailed visibility into external vendor detection consensus, privacy trackers, and domain reputation.
        </p>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Server size={18} color="#22d3ee" /> OSINT Engine Consensus & Coverage
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
          {osintProviders.map((prov, i) => (
            <div key={i} className="glass-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{prov.name}</span>
                <span className="badge badge-cyan">{prov.coverage}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <span>Total Queries:</span>
                <span style={{ color: '#ffffff', fontWeight: 600 }}>{prov.queries.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                <span>Threat Detections:</span>
                <span style={{ color: 'var(--rose-400)', fontWeight: 700 }}>{prov.detections} flagged</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--emerald-400)', marginBottom: '1rem' }}>
            <CheckCircle2 size={18} /> Most Trusted Domains
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {safeDomains.map((d, i) => (
              <div key={i} className="glass-card" style={{ padding: '0.85rem 1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{d.domain}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{d.status} • {d.totalScans} scans</div>
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--emerald-400)' }}>
                  {d.score}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--rose-400)', marginBottom: '1rem' }}>
            <ShieldAlert size={18} /> Persistent Intercepted Threats
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {maliciousDomains.map((d, i) => (
              <div key={i} className="glass-card" style={{ padding: '0.85rem 1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--rose-400)' }}>{d.domain}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{d.reason} • <span style={{ color: 'var(--rose-400)' }}>{d.blocked}</span></div>
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--rose-400)' }}>
                  {d.score}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
