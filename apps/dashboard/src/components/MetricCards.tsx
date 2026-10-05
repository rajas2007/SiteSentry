'use client';

import React from 'react';
import { ShieldAlert, Globe, Lock, EyeOff, TrendingUp } from 'lucide-react';
import { DashboardMetrics } from '../lib/types';
import AnimatedNumber from './AnimatedNumber';

interface MetricCardsProps {
  metrics: DashboardMetrics;
}

export default function MetricCards({ metrics }: MetricCardsProps) {
  return (
    <div className="grid-cols-4-responsive" style={{ marginBottom: '2rem' }}>
      
      {/* 1. Total Scans */}
      <div 
        className="glass-card"
        style={{ cursor: 'default' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Total Scans Conducted
          </span>
          <div style={{
            width: '34px',
            height: '34px',
            borderRadius: '9px',
            background: 'var(--cyan-bg)',
            border: '1px solid var(--cyan-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--cyan-400)',
            transition: 'background-color 200ms ease, transform 200ms ease'
          }}>
            <Globe size={17} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
          <span style={{ fontSize: '2rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: '#ffffff', letterSpacing: '-0.02em' }}>
            <AnimatedNumber value={metrics.totalScans} />
          </span>
          <span style={{ fontSize: '0.73rem', color: 'var(--cyan-400)', display: 'flex', alignItems: 'center', gap: '0.2rem', fontWeight: 500 }}>
            <TrendingUp size={12} /> {metrics.scansTrend}
          </span>
        </div>

        <p style={{ fontSize: '0.73rem', color: 'var(--text-dim)', marginTop: '0.5rem' }}>
          Inspected in real-time across active web sessions
        </p>
      </div>

      {/* 2. Threats Blocked */}
      <div 
        className="glass-card"
        style={{ cursor: 'default' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            High-Risk Threats Blocked
          </span>
          <div style={{
            width: '34px',
            height: '34px',
            borderRadius: '9px',
            background: 'var(--rose-bg)',
            border: '1px solid var(--rose-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--rose-400)',
            transition: 'background-color 200ms ease, transform 200ms ease'
          }}>
            <ShieldAlert size={17} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
          <span style={{ fontSize: '2rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: '#ffffff', letterSpacing: '-0.02em' }}>
            <AnimatedNumber value={metrics.threatsBlocked} />
          </span>
          <span className="badge badge-rose" style={{ fontSize: '0.68rem' }}>
            Active Interventions
          </span>
        </div>

        <p style={{ fontSize: '0.73rem', color: 'var(--text-dim)', marginTop: '0.5rem' }}>
          Phishing attempts, credential theft & malware blocked
        </p>
      </div>

      {/* 3. Average Trust Score */}
      <div 
        className="glass-card"
        style={{ cursor: 'default' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Average Web Trust Score
          </span>
          <div style={{
            width: '34px',
            height: '34px',
            borderRadius: '9px',
            background: 'var(--emerald-bg)',
            border: '1px solid var(--emerald-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--emerald-400)',
            transition: 'background-color 200ms ease, transform 200ms ease'
          }}>
            <Lock size={17} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.45rem' }}>
          <span style={{ fontSize: '2rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--emerald-400)', letterSpacing: '-0.02em' }}>
            <AnimatedNumber value={metrics.averageTrustScore} format={false} />
          </span>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)', fontWeight: 600 }}>/ 100</span>
          <span className="badge badge-emerald" style={{ marginLeft: 'auto', fontSize: '0.68rem' }}>
            Healthy
          </span>
        </div>

        <div style={{ width: '100%', height: '5px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '9999px', marginTop: '0.75rem', overflow: 'hidden' }}>
          <div 
            style={{ 
              width: `${metrics.averageTrustScore}%`, 
              height: '100%', 
              background: 'linear-gradient(90deg, var(--emerald-500), var(--emerald-400))', 
              borderRadius: '9999px',
              transition: 'width 800ms var(--ease-out-smooth)'
            }}
          />
        </div>
      </div>

      {/* 4. Privacy Violations */}
      <div 
        className="glass-card"
        style={{ cursor: 'default' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Privacy Violations Detected
          </span>
          <div style={{
            width: '34px',
            height: '34px',
            borderRadius: '9px',
            background: 'var(--purple-bg)',
            border: '1px solid var(--purple-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--purple-400)',
            transition: 'background-color 200ms ease, transform 200ms ease'
          }}>
            <EyeOff size={17} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
          <span style={{ fontSize: '2rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: '#ffffff', letterSpacing: '-0.02em' }}>
            <AnimatedNumber value={metrics.privacyViolations} />
          </span>
          <span className="badge badge-purple" style={{ fontSize: '0.68rem' }}>
            AI Verified
          </span>
        </div>

        <p style={{ fontSize: '0.73rem', color: 'var(--text-dim)', marginTop: '0.5rem' }}>
          Data selling clauses, tracking pixels & consent abuse
        </p>
      </div>

    </div>
  );
}
