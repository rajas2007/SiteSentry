'use client';

import React, { useState, useEffect } from 'react';
import { PieChart } from 'lucide-react';

interface ThreatSlice {
  label: string;
  count: number;
  percentage: number;
  color: string;
}

const SLICES: ThreatSlice[] = [
  { label: 'Safe & Verified', count: 898, percentage: 72, color: '#10b981' },
  { label: 'Privacy & Data Selling', count: 175, percentage: 14, color: '#8b5cf6' },
  { label: 'Credential Theft Forms', count: 100, percentage: 8, color: '#f43f5e' },
  { label: 'Phishing & Malicious', count: 75, percentage: 6, color: '#f59e0b' },
];

export default function ThreatDonutChart() {
  const [activeSlice, setActiveSlice] = useState<ThreatSlice | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 60);
    return () => clearTimeout(timer);
  }, []);

  const size = 176;
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercent = 0;

  return (
    <div className="glass-card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header */}
      <div style={{ marginBottom: '0.85rem' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <PieChart size={16} color="#a78bfa" /> Threat Category Distribution
        </h3>
        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Proportion of detected web risks</p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: '1rem', flex: '1', flexWrap: 'wrap' }}>
        
        {/* SVG Donut */}
        <div style={{ position: 'relative', width: `${size}px`, height: `${size}px` }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}>
            {SLICES.map((slice, i) => {
              const segmentLength = (slice.percentage / 100) * circumference;
              const strokeDasharray = `${segmentLength} ${circumference}`;
              const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
              accumulatedPercent += slice.percentage;

              const isHovered = activeSlice?.label === slice.label;

              return (
                <circle
                  key={i}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="transparent"
                  stroke={slice.color}
                  strokeWidth={isHovered ? strokeWidth + 3 : strokeWidth}
                  strokeDasharray={isLoaded ? strokeDasharray : `0 ${circumference}`}
                  strokeDashoffset={isLoaded ? strokeDashoffset : 0}
                  style={{
                    cursor: 'pointer',
                    transition: 'stroke-dasharray 600ms cubic-bezier(0.16, 1, 0.3, 1), stroke-dashoffset 600ms cubic-bezier(0.16, 1, 0.3, 1), stroke-width 180ms ease, opacity 180ms ease',
                    opacity: activeSlice && !isHovered ? 0.45 : 1,
                  }}
                  onMouseEnter={() => setActiveSlice(slice)}
                  onMouseLeave={() => setActiveSlice(null)}
                />
              );
            })}
          </svg>

          {/* Center text */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            transition: 'opacity 150ms ease'
          }}>
            <span style={{ fontSize: '1.35rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: '#ffffff', letterSpacing: '-0.02em' }}>
              {activeSlice ? `${activeSlice.percentage}%` : '1,248'}
            </span>
            <span style={{ fontSize: '0.66rem', color: 'var(--text-dim)', textAlign: 'center', maxWidth: '85px', lineHeight: 1.1 }}>
              {activeSlice ? activeSlice.label.split(' ')[0] : 'Total Scans'}
            </span>
          </div>
        </div>

        {/* Legend pills */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', flex: '1', minWidth: '150px' }}>
          {SLICES.map((slice, i) => {
            const isHovered = activeSlice?.label === slice.label;
            return (
              <div
                key={i}
                onMouseEnter={() => setActiveSlice(slice)}
                onMouseLeave={() => setActiveSlice(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.35rem 0.55rem',
                  borderRadius: '6px',
                  background: isHovered ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'background 160ms var(--ease-out-smooth)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: slice.color, flexShrink: 0 }}></span>
                  <span style={{ fontSize: '0.75rem', color: isHovered ? '#ffffff' : 'var(--text-muted)', transition: 'color 160ms ease' }}>
                    {slice.label}
                  </span>
                </div>
                <span style={{ fontSize: '0.73rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: slice.color }}>
                  {slice.percentage}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
