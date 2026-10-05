'use client';

import React from 'react';
import { ShieldCheck, AlertTriangle, ShieldAlert, Check, X, Shield, Lock, EyeOff } from 'lucide-react';

export function VerdictBadge({ verdict }: { verdict: 'allow' | 'warn' | 'block' | string }) {
  const v = verdict.toLowerCase();
  if (v === 'allow') {
    return (
      <span className="sentry-badge badge-safe">
        <Check size={12} strokeWidth={2.5} /> ALLOW
      </span>
    );
  }
  if (v === 'warn') {
    return (
      <span className="sentry-badge badge-warning">
        <AlertTriangle size={12} strokeWidth={2.5} /> WARN
      </span>
    );
  }
  return (
    <span className="sentry-badge badge-danger">
      <X size={12} strokeWidth={2.5} /> BLOCK
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: 'low' | 'medium' | 'high' | string }) {
  const s = severity.toLowerCase();
  if (s === 'low') {
    return (
      <span className="sentry-badge badge-safe" style={{ textTransform: 'capitalize' }}>
        Low Severity
      </span>
    );
  }
  if (s === 'medium') {
    return (
      <span className="sentry-badge badge-warning" style={{ textTransform: 'capitalize' }}>
        Medium Severity
      </span>
    );
  }
  return (
    <span className="sentry-badge badge-danger" style={{ textTransform: 'capitalize' }}>
      High Severity
    </span>
  );
}

export function ThreatCategoryBadge({ category }: { category: string }) {
  const c = category.toLowerCase().replace(/_/g, ' ');
  if (c.includes('safe')) {
    return (
      <span className="sentry-badge badge-safe">
        <ShieldCheck size={12} /> Safe & Verified
      </span>
    );
  }
  if (c.includes('credential') || c.includes('theft')) {
    return (
      <span className="sentry-badge badge-danger">
        <ShieldAlert size={12} /> Credential Theft
      </span>
    );
  }
  if (c.includes('privacy')) {
    return (
      <span className="sentry-badge badge-teal">
        <EyeOff size={12} /> Privacy Abuse
      </span>
    );
  }
  if (c.includes('elevated')) {
    return (
      <span className="sentry-badge badge-warning">
        <AlertTriangle size={12} /> Elevated Risk
      </span>
    );
  }
  return (
    <span className="sentry-badge badge-navy">
      <Shield size={12} /> {category.replace(/_/g, ' ')}
    </span>
  );
}

export function ScoreBadge({ score }: { score: number }) {
  const isSafe = score >= 80;
  const isMedium = score >= 50 && score < 80;
  const badgeClass = isSafe ? 'badge-safe' : isMedium ? 'badge-warning' : 'badge-danger';

  return (
    <span className={`sentry-badge ${badgeClass}`} style={{ fontFamily: 'var(--font-sans)', fontWeight: 700 }}>
      {score}/100
    </span>
  );
}

export function StatusDot({ status }: { status: 'online' | 'connected' | 'operational' | 'warning' | 'offline' | string }) {
  const s = status.toLowerCase();
  const isOnline = s === 'online' || s === 'connected' || s === 'operational';
  const isWarn = s === 'warning';

  return (
    <span
      className={`sentry-pulse-dot ${isOnline ? 'online' : isWarn ? 'warning' : 'danger'}`}
      style={{ marginRight: '6px' }}
    />
  );
}
