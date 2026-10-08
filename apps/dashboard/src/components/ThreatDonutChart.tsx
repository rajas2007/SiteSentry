'use client';

import React, { useState, useEffect } from 'react';
import { PieChart } from 'lucide-react';
import { cn } from '../lib/utils';

interface ThreatSlice {
  label: string;
  count: number;
  percentage: number;
  color: string;
}

const SLICES: ThreatSlice[] = [
  { label: 'Safe & Verified', count: 898, percentage: 72, color: 'var(--safe)' },
  { label: 'Privacy & Data Selling', count: 175, percentage: 14, color: '#8b5cf6' },
  { label: 'Credential Theft Forms', count: 100, percentage: 8, color: 'var(--danger)' },
  { label: 'Phishing & Malicious', count: 75, percentage: 6, color: 'var(--caution)' },
];

export default function ThreatDonutChart() {
  const [activeSlice, setActiveSlice] = useState<ThreatSlice | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 60);
    return () => clearTimeout(timer);
  }, []);

  const size = 160;
  const strokeWidth = 18;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercent = 0;

  return (
    <div className="flex h-full flex-col rounded-md border border-border/60 bg-card p-5 scan-surface">
      
      {/* Header */}
      <div className="mb-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-heading">
          <PieChart className="h-4 w-4 text-[#8b5cf6]" /> Threat Category Distribution
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Proportion of detected web risks</p>
      </div>

      <div className="flex flex-1 flex-wrap items-center justify-around gap-4">
        
        {/* SVG Donut */}
        <div className="relative" style={{ width: size, height: size }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 overflow-visible">
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
                  className="cursor-pointer transition-all duration-700 ease-out"
                  style={{
                    opacity: activeSlice && !isHovered ? 0.35 : 1,
                  }}
                  onMouseEnter={() => setActiveSlice(slice)}
                  onMouseLeave={() => setActiveSlice(null)}
                />
              );
            })}
          </svg>

          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="font-heading text-2xl font-bold text-heading leading-none">
              {activeSlice ? activeSlice.percentage : '100'}%
            </span>
            <span className="text-[10px] text-muted-foreground mt-1 max-w-[80px] leading-tight">
              {activeSlice ? activeSlice.label : 'Total Analyzed'}
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-3">
          {SLICES.map((slice, i) => (
            <div
              key={i}
              className={cn("flex cursor-pointer items-center gap-3 transition-opacity duration-200", (activeSlice && activeSlice.label !== slice.label) ? "opacity-40" : "opacity-100")}
              onMouseEnter={() => setActiveSlice(slice)}
              onMouseLeave={() => setActiveSlice(null)}
            >
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: slice.color }} />
              <div>
                <div className="text-[11px] font-medium text-heading leading-none">{slice.label}</div>
                <div className="text-[10px] text-muted-foreground mt-1 leading-none">{slice.count.toLocaleString()} occurrences</div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
