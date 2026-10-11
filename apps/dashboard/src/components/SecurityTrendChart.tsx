'use client';

import React, { useState, useEffect } from 'react';
import { Activity } from 'lucide-react';
import { DailyTimelinePoint } from '../lib/types';
import { cn } from '../lib/utils';

interface SecurityTrendChartProps {
  timeline?: DailyTimelinePoint[] | null;
  timeRange?: '7d' | '30d';
  onTimeRangeChange?: (range: '7d' | '30d') => void;
  isLoading?: boolean;
}

function formatDayLabel(dateStr: string, is7d: boolean): string {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const dateObj = new Date(Date.UTC(year, month - 1, day));
    if (is7d) {
      return dateObj.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
    }
    return `${month}/${day}`;
  } catch {
    return dateStr;
  }
}

export default function SecurityTrendChart({
  timeline = null,
  timeRange: controlledTimeRange,
  onTimeRangeChange,
  isLoading = false,
}: SecurityTrendChartProps) {
  const [internalTimeRange, setInternalTimeRange] = useState<'7d' | '30d'>('7d');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [isDrawn, setIsDrawn] = useState(false);

  const timeRange = controlledTimeRange ?? internalTimeRange;

  const handleRangeToggle = (newRange: '7d' | '30d') => {
    if (onTimeRangeChange) {
      onTimeRangeChange(newRange);
    } else {
      setInternalTimeRange(newRange);
    }
  };

  useEffect(() => {
    setIsDrawn(false);
    const timer = setTimeout(() => setIsDrawn(true), 40);
    return () => clearTimeout(timer);
  }, [timeRange, timeline]);

  // Derive slice for 7d vs 30d
  const rawData: DailyTimelinePoint[] = React.useMemo(() => {
    if (!timeline || timeline.length === 0) return [];
    if (timeRange === '7d') {
      return timeline.slice(-7);
    }
    return timeline;
  }, [timeline, timeRange]);

  const width = 500;
  const height = 180;
  const padding = 28;
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;

  const maxVal = Math.max(...rawData.map((d) => d.total), 1) * 1.15;

  const points = rawData.map((d, i) => {
    const x = padding + (rawData.length > 1 ? (i / (rawData.length - 1)) * usableWidth : usableWidth / 2);
    const y = padding + usableHeight - (d.total / maxVal) * usableHeight;
    return {
      x,
      y,
      data: d,
      dayLabel: formatDayLabel(d.date, timeRange === '7d'),
    };
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

  const areaPath =
    points.length > 1
      ? `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`
      : '';

  return (
    <div className="flex h-full flex-col rounded-md border border-border/60 bg-card p-5 scan-surface">
      {/* Header with Title & Range Switcher */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-heading">
            <Activity className="h-4 w-4 text-analysis" /> Real-Time Traffic & Interception Volume
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Daily inspect events vs threats neutralized</p>
        </div>

        <div className="flex rounded-md border border-border/80 bg-background/30 p-0.5">
          <button
            onClick={() => handleRangeToggle('7d')}
            className={cn(
              "rounded px-2.5 py-1 text-[10px] font-semibold transition-colors",
              timeRange === '7d' ? "bg-analysis/20 text-analysis" : "text-muted-foreground hover:bg-secondary/50 hover:text-heading"
            )}
          >
            7D
          </button>
          <button
            onClick={() => handleRangeToggle('30d')}
            className={cn(
              "rounded px-2.5 py-1 text-[10px] font-semibold transition-colors",
              timeRange === '30d' ? "bg-analysis/20 text-analysis" : "text-muted-foreground hover:bg-secondary/50 hover:text-heading"
            )}
          >
            30D
          </button>
        </div>
      </div>

      <div className="relative mt-2 flex-1 min-h-[180px]">
        {isLoading ? (
          <div className="flex h-full min-h-[180px] items-center justify-center text-xs text-muted-foreground animate-pulse">
            Loading timeline data...
          </div>
        ) : !timeline ? (
          <div className="flex h-full min-h-[180px] items-center justify-center text-xs text-muted-foreground">
            Timeline analytics unavailable (Backend offline)
          </div>
        ) : points.length === 0 ? (
          <div className="flex h-full min-h-[180px] items-center justify-center text-xs text-muted-foreground">
            No activity recorded in this period.
          </div>
        ) : (
          <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full overflow-visible" preserveAspectRatio="none">
            {/* Grid lines */}
            {[0, 1, 2, 3].map((i) => (
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
            {points.map((p, i) => {
              // For 30d, display label every 5 days or at the end to prevent overlap
              const shouldShowLabel = timeRange === '7d' || i % 5 === 0 || i === points.length - 1;
              if (!shouldShowLabel) return null;

              return (
                <text
                  key={i}
                  x={p.x}
                  y={height - 5}
                  fill="var(--color-muted-foreground)"
                  fontSize="10"
                  fontFamily="var(--font-mono)"
                  textAnchor="middle"
                >
                  {p.dayLabel}
                </text>
              );
            })}

            {/* Area & Line */}
            {isDrawn && areaPath && (
              <path
                d={areaPath}
                fill="url(#trend-gradient)"
                opacity={0.4}
                className="transition-all duration-1000 ease-out"
              />
            )}
            {isDrawn && linePath && (
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
                  x={p.x - usableWidth / (Math.max(1, points.length) * 2)}
                  y={0}
                  width={usableWidth / Math.max(1, points.length)}
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
        )}

        {hoveredIdx !== null && points[hoveredIdx] && (
          <div
            className="absolute z-10 pointer-events-none -translate-x-1/2 -translate-y-[120%] flex flex-col gap-1 rounded border border-border/80 bg-card p-2 text-xs shadow-lg backdrop-blur-md"
            style={{
              left: `${(points[hoveredIdx].x / width) * 100}%`,
              top: `${(points[hoveredIdx].y / height) * 100}%`,
            }}
          >
            <div className="font-semibold text-heading font-mono text-[10px]">{points[hoveredIdx].data.date}</div>
            <div className="flex items-center justify-between gap-3 text-[10px]">
              <span className="text-muted-foreground">Total Scans</span>
              <span className="font-bold text-heading">{points[hoveredIdx].data.total}</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-[10px]">
              <span className="text-safe font-semibold">Safe (Allow)</span>
              <span className="font-bold text-safe">{points[hoveredIdx].data.safe}</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-[10px]">
              <span className="text-danger font-semibold">Blocked / High</span>
              <span className="font-bold text-danger">{points[hoveredIdx].data.blocked}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
