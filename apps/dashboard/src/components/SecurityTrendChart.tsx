'use client';

import React, { useState, useEffect } from 'react';
import { Activity } from 'lucide-react';

interface DataPoint {
  day: string;
  total: number;
  safe: number;
  blocked: number;
}

const DATA_7D: DataPoint[] = [
  { day: 'Mon', total: 142, safe: 136, blocked: 6 },
  { day: 'Tue', total: 185, safe: 178, blocked: 7 },
  { day: 'Wed', total: 168, safe: 161, blocked: 7 },
  { day: 'Thu', total: 210, safe: 199, blocked: 11 },
  { day: 'Fri', total: 195, safe: 188, blocked: 7 },
  { day: 'Sat', total: 164, safe: 160, blocked: 4 },
  { day: 'Sun', total: 184, safe: 180, blocked: 4 },
];

const DATA_30D: DataPoint[] = [
  { day: 'W1', total: 980, safe: 948, blocked: 32 },
  { day: 'W2', total: 1120, safe: 1084, blocked: 36 },
  { day: 'W3', total: 1050, safe: 1018, blocked: 32 },
  { day: 'W4', total: 1248, safe: 1206, blocked: 42 },
];

export default function SecurityTrendChart() {
  const [timeRange, setTimeRange] = useState<'7d' | '30d'>('7d');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [isDrawn, setIsDrawn] = useState(false);

  useEffect(() => {
    setIsDrawn(false);
    const timer = setTimeout(() => setIsDrawn(true), 40);
    return () => clearTimeout(timer);
  }, [timeRange]);

  const rawData = timeRange === '7d' ? DATA_7D : DATA_30D;

  const width = 500;
  const height = 180;
  const padding = 28;

  const maxVal = Math.max(...rawData.map(d => d.total)) * 1.15;
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;

  const points = rawData.map((d, i) => {
    const x = padding + (i / (rawData.length - 1)) * usableWidth;
    const y = padding + usableHeight - (d.total / maxVal) * usableHeight;
    return { x, y, data: d };
  });

  const linePath = points.reduce((acc, p, i, arr) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = arr[i - 1];
    const cx1 = prev.x + (p.x - prev.x) / 2;
    const cy1 = prev.y;
    const cx2 = prev.x + (p.x - prev.x) / 2;
    const cy2 = p.y;
    return `${acc} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${p.x} ${p.y}`;
  }, '');

  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

  return (
    <div className="glass-card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header with Title & Range Switcher */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
        <div>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <Activity size={16} color="#38bdf8" /> Real-Time Traffic & Interception Volume
          </h3>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Daily inspect events vs threats neutralized</p>
        </div>

        {/* Range Switcher */}
        <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.04)', borderRadius: '7px', padding: '2px', border: '1px solid var(--border-subtle)' }}>
          <button
            onClick={() => setTimeRange('7d')}
            style={{
              padding: '0.2rem 0.6rem',
              fontSize: '0.7rem',
              fontWeight: 600,
              borderRadius: '5px',
              border: 'none',
              cursor: 'pointer',
              background: timeRange === '7d' ? 'rgba(2, 132, 199, 0.25)' : 'transparent',
              color: timeRange === '7d' ? '#38bdf8' : 'var(--text-muted)',
              transition: 'all 160ms var(--ease-out-smooth)'
            }}
          >
            7 Days
          </button>
          <button
            onClick={() => setTimeRange('30d')}
            style={{
              padding: '0.2rem 0.6rem',
              fontSize: '0.7rem',
              fontWeight: 600,
              borderRadius: '5px',
              border: 'none',
              cursor: 'pointer',
              background: timeRange === '30d' ? 'rgba(2, 132, 199, 0.25)' : 'transparent',
              color: timeRange === '30d' ? '#38bdf8' : 'var(--text-muted)',
              transition: 'all 160ms var(--ease-out-smooth)'
            }}
          >
            30 Days
          </button>
        </div>
      </div>

      {/* SVG Canvas */}
      <div style={{ position: 'relative', width: '100%', flex: 1, minHeight: '160px' }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', height: '100%', overflow: 'visible' }}
        >
          <defs>
            <linearGradient id="cyanTrendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0284c7" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.5, 1].map((ratio, idx) => {
            const y = padding + usableHeight * ratio;
            return (
              <line
                key={idx}
                x1={padding}
                y1={y}
                x2={width - padding}
                y2={y}
                stroke="rgba(255, 255, 255, 0.05)"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
            );
          })}

          {/* Area Fill */}
          <path
            d={areaPath}
            fill="url(#cyanTrendGradient)"
            style={{
              opacity: isDrawn ? 1 : 0,
              transition: 'opacity 400ms var(--ease-out-smooth)'
            }}
          />

          {/* Smooth Line */}
          <path
            d={linePath}
            fill="none"
            stroke="#38bdf8"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: isDrawn ? 'none' : '1000',
              strokeDashoffset: isDrawn ? '0' : '1000',
              transition: 'stroke-dashoffset 650ms cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          />

          {/* Points */}
          {points.map((p, i) => {
            const isHovered = hoveredIdx === i;
            return (
              <g 
                key={i} 
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Vertical hover line */}
                {isHovered && (
                  <line
                    x1={p.x}
                    y1={padding}
                    x2={p.x}
                    y2={height - padding}
                    stroke="rgba(56, 189, 248, 0.4)"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                )}

                {/* Point dot */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isHovered ? 6 : 3.5}
                  fill={isHovered ? '#ffffff' : '#0284c7'}
                  stroke="#090c13"
                  strokeWidth="2"
                  style={{
                    transition: 'r 160ms var(--ease-out-smooth), fill 160ms var(--ease-out-smooth)',
                    opacity: isDrawn ? 1 : 0,
                  }}
                />

                {/* Day label */}
                <text 
                  x={p.x} 
                  y={height - 6} 
                  fill={isHovered ? '#ffffff' : 'var(--text-muted)'} 
                  fontSize="9.5" 
                  textAnchor="middle" 
                  fontWeight={isHovered ? 700 : 500}
                  style={{ transition: 'fill 160ms ease' }}
                >
                  {p.data.day}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip */}
        {hoveredIdx !== null && (
          <div style={{
            position: 'absolute',
            top: `${Math.max(8, points[hoveredIdx].y - 75)}px`,
            left: `${points[hoveredIdx].x - 60}px`,
            background: 'rgba(15, 20, 32, 0.95)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: '7px',
            padding: '0.45rem 0.65rem',
            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.5)',
            pointerEvents: 'none',
            zIndex: 10,
            minWidth: '120px',
            animation: 'modalEnter 150ms var(--ease-out-smooth) forwards',
          }}>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.15rem' }}>
              {rawData[hoveredIdx].day}
            </p>
            <div style={{ fontSize: '0.68rem', display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
              <span style={{ color: '#38bdf8' }}>Total: {rawData[hoveredIdx].total} scans</span>
              <span style={{ color: 'var(--emerald-400)' }}>Safe: {rawData[hoveredIdx].safe}</span>
              <span style={{ color: 'var(--rose-400)' }}>Blocked: {rawData[hoveredIdx].blocked}</span>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
