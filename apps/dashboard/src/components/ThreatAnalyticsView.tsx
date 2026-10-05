'use client';

import React from 'react';
import { 
  BarChart3, 
  Server, 
  CheckCircle2, 
  ShieldAlert, 
  Globe, 
  EyeOff, 
  ShieldCheck, 
  Activity 
} from 'lucide-react';
import SecurityTrendChart from './SecurityTrendChart';
import ThreatDonutChart from './ThreatDonutChart';
import { StatusDot } from './Badges';

export default function ThreatAnalyticsView() {
  const osintProviders = [
    { name: 'Google Safe Browsing v4', queries: 1248, detections: 34, coverage: '99.8%', status: 'Operational' },
    { name: 'VirusTotal Multi-Vendor', queries: 1248, detections: 41, coverage: '99.4%', status: 'Operational' },
    { name: 'PhishTank Malicious DB', queries: 1248, detections: 29, coverage: '98.7%', status: 'Operational' },
    { name: 'SiteSentry Structural ML', queries: 1248, detections: 58, coverage: '100%', status: 'Active' },
  ];

  const trustedDomains = [
    { domain: 'github.com', score: 98, totalScans: 412, classification: 'Verified High Trust' },
    { domain: 'developer.mozilla.org', score: 95, totalScans: 285, classification: 'Educational Authority' },
    { domain: 'chat.openai.com', score: 96, totalScans: 190, classification: 'Enterprise Transport' },
    { domain: 'docs.stripe.com', score: 97, totalScans: 145, classification: 'Payment Infrastructure' },
  ];

  const highRiskDomains = [
    { domain: 'verify-account.security-update.xyz', score: 12, reason: 'Credential Harvesting & Fake Login', blockedCount: 28 },
    { domain: 'crypto-airdrop-rewards-free.net', score: 25, reason: 'Deceptive Phishing Payload', blockedCount: 14 },
    { domain: 'shopping-deals-unlimited.biz', score: 48, reason: 'Excessive Privacy Exploitation', blockedCount: 9 },
    { domain: 'banking-secure-portal-auth.online', score: 18, reason: 'Banking Phishing Simulation', blockedCount: 19 },
  ];

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--primary-navy)', letterSpacing: '-0.03em' }}>
          Threat Analytics & Intelligence
        </h1>
        <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
          Telemetry aggregation, multi-vendor OSINT coverage analysis, and domain reputation telemetry
        </p>
      </div>

      {/* 2-Column Analytics Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
        <SecurityTrendChart />
        <ThreatDonutChart />
      </div>

      {/* OSINT Multi-Vendor Consensus Section */}
      <div className="sentry-card" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--primary-navy)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <Server size={18} color="var(--primary-blue)" /> Multi-Vendor Threat Intelligence Coverage
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
          {osintProviders.map((prov, i) => (
            <div
              key={i}
              className="sentry-card sentry-card-hover"
              style={{ padding: '1.15rem', backgroundColor: 'var(--blue-soft-50)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--primary-navy)' }}>{prov.name}</span>
                <span className="sentry-badge badge-safe">{prov.coverage}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.76rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                  <span>Total Queries:</span>
                  <span style={{ fontWeight: 700, color: 'var(--primary-navy)' }}>{prov.queries.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                  <span>Detections:</span>
                  <span style={{ fontWeight: 700, color: 'var(--danger-red)' }}>{prov.detections} flagged</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', paddingTop: '0.35rem', borderTop: '1px solid var(--border-subtle)' }}>
                  <span>Status:</span>
                  <span style={{ display: 'flex', alignItems: 'center', color: 'var(--safe-green-dark)', fontWeight: 600 }}>
                    <StatusDot status="online" /> {prov.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Domain Reputation Comparison Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
        
        {/* Most Trusted Domains */}
        <div className="sentry-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--safe-green-dark)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.15rem' }}>
            <CheckCircle2 size={18} /> Most Trusted Domains
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {trustedDomains.map((d, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--safe-green-bg)',
                  border: '1px solid var(--safe-green-border)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--primary-navy)' }}>{d.domain}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{d.classification} • {d.totalScans} scans</div>
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--safe-green-dark)' }}>
                  {d.score}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* High-Risk Domains */}
        <div className="sentry-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--danger-red)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.15rem' }}>
            <ShieldAlert size={18} /> Persistent Intercepted Threats
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {highRiskDomains.map((d, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--danger-red-bg)',
                  border: '1px solid var(--danger-red-border)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--danger-red-dark)' }}>{d.domain}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{d.reason} • <span style={{ color: 'var(--danger-red)', fontWeight: 600 }}>Blocked {d.blockedCount}x</span></div>
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--danger-red)' }}>
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
