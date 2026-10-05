'use client';

import React from 'react';
import { 
  LayoutDashboard, 
  History, 
  BarChart3, 
  Settings, 
  ShieldCheck, 
  Server, 
  Database, 
  Zap 
} from 'lucide-react';
import { StatusDot } from './Badges';

interface SidebarProps {
  activeTab: 'overview' | 'history' | 'analytics' | 'settings';
  setActiveTab: (tab: 'overview' | 'history' | 'analytics' | 'settings') => void;
  isBackendConnected: boolean;
}

export default function Sidebar({ activeTab, setActiveTab, isBackendConnected }: SidebarProps) {
  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'history', label: 'Scan History', icon: History },
    { id: 'analytics', label: 'Threat Analytics', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ] as const;

  return (
    <aside
      style={{
        width: '260px',
        backgroundColor: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        zIndex: 40,
        padding: '1.25rem 1rem',
        userSelect: 'none',
      }}
    >
      {/* Top Brand & Navigation */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
        
        {/* Brand Header */}
        <div 
          onClick={() => setActiveTab('overview')}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.75rem', 
            padding: '0.5rem 0.5rem', 
            cursor: 'pointer',
            borderRadius: 'var(--radius-md)',
            transition: 'background-color var(--duration-fast) ease',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, var(--primary-blue) 0%, var(--primary-navy) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              boxShadow: '0 2px 8px rgba(10, 65, 116, 0.25)',
              flexShrink: 0,
            }}
          >
            <ShieldCheck size={22} strokeWidth={2.2} />
          </div>
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary-navy)', lineHeight: 1.15 }}>
              SiteSentry
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.01em' }}>
              Web Security Intelligence
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-dim)', padding: '0 0.6rem 0.35rem' }}>
            Navigation
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.65rem 0.85rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid',
                  borderColor: isActive ? 'var(--very-light-blue)' : 'transparent',
                  background: isActive ? 'var(--blue-soft-100)' : 'transparent',
                  color: isActive ? 'var(--primary-blue)' : 'var(--text-body)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all var(--duration-fast) var(--ease-smooth)',
                  width: '100%',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'var(--blue-soft-50)';
                    e.currentTarget.style.color = 'var(--primary-blue)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-body)';
                  }
                }}
              >
                <Icon 
                  size={18} 
                  strokeWidth={isActive ? 2.3 : 1.9}
                  color={isActive ? 'var(--primary-blue)' : 'var(--secondary-blue)'}
                />
                <span>{item.label}</span>
                {isActive && (
                  <div 
                    style={{ 
                      marginLeft: 'auto', 
                      width: '5px', 
                      height: '14px', 
                      borderRadius: '9999px', 
                      backgroundColor: 'var(--primary-blue)' 
                    }} 
                  />
                )}
              </button>
            );
          })}
        </nav>

      </div>

      {/* Bottom Status & Version Card */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        
        {/* System Status Card */}
        <div
          className="sentry-card"
          style={{
            padding: '0.85rem 1rem',
            backgroundColor: 'var(--blue-soft-50)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--primary-navy)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.6rem' }}>
            System Status
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.73rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-body)', display: 'flex', alignItems: 'center' }}>
                <StatusDot status={isBackendConnected ? 'online' : 'offline'} /> API Server
              </span>
              <span style={{ fontWeight: 600, color: isBackendConnected ? 'var(--safe-green-dark)' : 'var(--warn-amber-dark)' }}>
                {isBackendConnected ? 'Online' : 'Standalone'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-body)', display: 'flex', alignItems: 'center' }}>
                <StatusDot status="connected" /> Redis Cache
              </span>
              <span style={{ fontWeight: 600, color: 'var(--safe-green-dark)' }}>Connected</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-body)', display: 'flex', alignItems: 'center' }}>
                <StatusDot status="operational" /> External APIs
              </span>
              <span style={{ fontWeight: 600, color: 'var(--safe-green-dark)' }}>Operational</span>
            </div>
          </div>
        </div>

        {/* Version Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 0.35rem', fontSize: '0.68rem', color: 'var(--text-dim)' }}>
          <span>SiteSentry Platform</span>
          <span style={{ fontWeight: 600, color: 'var(--secondary-blue)' }}>v0.1.0</span>
        </div>

      </div>

    </aside>
  );
}
