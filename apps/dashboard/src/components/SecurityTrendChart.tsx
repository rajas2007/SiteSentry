'use client';

import React, { useState, useEffect } from 'react';
import { Activity } from 'lucide-react';
import { cn } from '../lib/utils';

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
    <div className="flex h-full flex-col rounded-md border border-border/60 bg-card p-5 scan-surface">
      
      {/* Header with Title & Range Switcher */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-heading">
            <Activity className="h-4 w-4 text-analysis" /> Real-Time Traffic & Interception Volume
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Daily inspect events vs threats neutralized (Sample Data)</p>
        </div>

        <div className="flex rounded-md border border-border/80 bg-background/30 p-0.5">
          <button
            onClick={() => setTimeRange('7d')}
            className={cn("rounded px-2.5 py-1 text-[10px] font-semibold transition-colors", timeRange === '7d' ? "bg-analysis/20 text-analysis" : "text-muted-foreground hover:bg-secondary/50 hover:text-heading")}
          >
            7D
          </button>
          <button
            onClick={() => setTimeRange('30d')}
            className={cn("rounded px-2.5 py-1 text-[10px] font-semibold transition-colors", timeRange === '30d' ? "bg-analysis/20 text-analysis" : "text-muted-foreground hover:bg-secondary/50 hover:text-heading")}
          >
            30D
          </button>
        </div>
      </div>

      <div className="relative mt-2 flex-1 min-h-[180px]">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full overflow-visible" preserveAspectRatio="none">
          {/* Grid lines */}
          {[0, 1, 2, 3].map(i => (
            <line
              key={i}
              x1={padding}
              y1={padding + (usableHeight / 3) * i}
              x2={width - padding}
              y2={padding + (usableHeight / 3) * i}
              stroke="var(--color-border)"
              strokeDasharray="4 4"
              strokeOpacity="0.4"
              strokeWidth={1}
            />
          ))}

          {/* X Axis Labels */}
          {points.map((p, i) => (
            <text
              key={i}
              x={p.x}
              y={height - 5}
              fill="var(--color-muted-foreground)"
              fontSize="10"
              fontFamily="var(--font-mono)"
              textAnchor="middle"
            >
              {p.data.day}
            </text>
          ))}

          {/* Area & Line */}
          {isDrawn && (
            <>
              <path
                d={areaPath}
                fill="url(#trend-gradient)"
                opacity={0.4}
                className="transition-all duration-1000 ease-out"
              />
              <path
                d={linePath}
                fill="none"
                stroke="var(--color-analysis)"
                strokeWidth={3}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
                strokeDasharray="1000"
                strokeDashoffset={isDrawn ? 0 : 1000}
              />
            </>
          )}

          {/* Interaction Points */}
          {points.map((p, i) => (
            <g
              key={i}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="cursor-crosshair outline-none"
            >
              <circle
                cx={p.x}
                cy={p.y}
                r={hoveredIdx === i ? 6 : 4}
                fill="var(--color-card)"
                stroke="var(--color-analysis)"
                strokeWidth={2}
                className="transition-all duration-200"
                opacity={isDrawn ? 1 : 0}
              />
              <rect
                x={p.x - usableWidth / (points.length * 2)}
                y={0}
                width={usableWidth / points.length}
                height={height}
                fill="transparent"
              />
            </g>
          ))}

          <defs>
            <linearGradient id="trend-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-analysis)" stopOpacity={0.6} />
              <stop offset="100%" stopColor="var(--color-analysis)" stopOpacity={0} />
            </linearGradient>
          </defs>
        </svg>

        {hoveredIdx !== null && (
          <div
            className="absolute z-10 pointer-events-none -translate-x-1/2 -translate-y-[120%] flex flex-col gap-1 rounded border border-border/80 bg-card p-2 text-xs shadow-lg backdrop-blur-md"
            style={{
              left: `${(points[hoveredIdx].x / width) * 100}%`,
              top: `${(points[hoveredIdx].y / height) * 100}%`,
            }}
          >
            <div className="font-semibold text-heading font-mono text-[10px]">{points[hoveredIdx].data.day}</div>
            <div className="flex items-center justify-between gap-3 text-[10px]">
              <span className="text-muted-foreground">Scans</span>
              <span className="font-bold text-heading">{points[hoveredIdx].data.total}</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-[10px]">
              <span className="text-danger font-semibold">Blocked</span>
              <span className="font-bold text-danger">{points[hoveredIdx].data.blocked}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
