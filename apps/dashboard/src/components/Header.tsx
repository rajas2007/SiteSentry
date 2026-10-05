'use client';

import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Search, 
  Activity, 
  History, 
  PieChart, 
  Settings, 
  Sparkles
} from 'lucide-react';

interface HeaderProps {
  activeTab: 'overview' | 'history' | 'analytics' | 'settings';
  setActiveTab: (tab: 'overview' | 'history' | 'analytics' | 'settings') => void;
  onQuickScan: (url: string) => void;
  isBackendConnected: boolean;
}

export default function Header({ 
  activeTab, 
  setActiveTab, 
  onQuickScan, 
  isBackendConnected 
}: HeaderProps) {
  const [searchInput, setSearchInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      onQuickScan(searchInput.trim());
      setSearchInput('');
    }
  };

  return (
    <header className="glass-panel" style={{ borderRadius: '0 0 16px 16px', borderTop: 'none', borderLeft: 'none', borderRight: 'none', padding: '0.85rem 2rem', position: 'sticky', top: 0, zIndex: 50 }}>
      <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1.25rem', flexWrap: 'wrap' }}>
        
        {/* Brand Logo */}
        <div 
          style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', cursor: 'pointer', userSelect: 'none' }} 
          onClick={() => setActiveTab('overview')}
        >
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'rgba(2, 132, 199, 0.12)',
            border: '1px solid rgba(2, 132, 199, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#38bdf8',
            transition: 'border-color 180ms ease, transform 180ms ease'
          }}>
            <ShieldCheck size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#ffffff' }}>
                SiteSentry
              </span>
              <span className="badge badge-cyan" style={{ fontSize: '0.62rem', padding: '0.1rem 0.35rem' }}>
                v0.1.0
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              <span className={`pulse-dot ${isBackendConnected ? 'pulse-emerald' : ''}`} style={{ backgroundColor: isBackendConnected ? 'var(--emerald-400)' : 'var(--amber-400)' }} />
              <span>{isBackendConnected ? 'API & Redis Online' : 'Standalone Mode'}</span>
            </div>
          </div>
        </div>

        {/* Global Quick URL Scanner Bar */}
        <form onSubmit={handleSubmit} style={{ flex: '1', maxWidth: '440px', minWidth: '240px' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', pointerEvents: 'none' }} />
            <input
              type="text"
              id="header-quick-scan-input"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Analyze any URL or domain..."
              className="input-field"
              style={{
                paddingLeft: '2.2rem',
                paddingRight: '5.2rem',
                height: '38px',
                fontSize: '0.8rem',
                borderRadius: '9999px',
                background: 'rgba(15, 23, 42, 0.6)'
              }}
            />
            <button
              type="submit"
              className="btn btn-primary"
              style={{
                position: 'absolute',
                right: '3px',
                height: '32px',
                padding: '0 0.8rem',
                fontSize: '0.73rem',
                borderRadius: '9999px',
              }}
            >
              <Sparkles size={11} /> Scan
            </button>
          </div>
        </form>

        {/* Navigation Tabs */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <button
            id="nav-overview-btn"
            onClick={() => setActiveTab('overview')}
            className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`}
          >
            <Activity size={14} className="nav-icon" /> Overview
          </button>
          
          <button
            id="nav-history-btn"
            onClick={() => setActiveTab('history')}
            className={`nav-item ${activeTab === 'history' ? 'active' : ''}`}
          >
            <History size={14} className="nav-icon" /> Scan History
          </button>

          <button
            id="nav-analytics-btn"
            onClick={() => setActiveTab('analytics')}
            className={`nav-item ${activeTab === 'analytics' ? 'active' : ''}`}
          >
            <PieChart size={14} className="nav-icon" /> Threat Analytics
          </button>

          <button
            id="nav-settings-btn"
            onClick={() => setActiveTab('settings')}
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
          >
            <Settings size={14} className="nav-icon" /> Settings
          </button>
        </nav>

      </div>
    </header>
  );
}
