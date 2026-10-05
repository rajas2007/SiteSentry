'use client';

import React from 'react';

export function Skeleton({
  width = '100%',
  height = '20px',
  borderRadius = 'var(--radius-sm)',
  className = '',
  style = {},
}: {
  width?: string;
  height?: string;
  borderRadius?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`skeleton-shimmer ${className}`}
      style={{
        width,
        height,
        borderRadius,
        ...style,
      }}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="sentry-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Skeleton width="110px" height="14px" />
        <Skeleton width="34px" height="34px" borderRadius="8px" />
      </div>
      <Skeleton width="90px" height="32px" />
      <Skeleton width="180px" height="12px" />
    </div>
  );
}
