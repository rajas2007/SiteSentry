'use client';

import React, { useState, useEffect } from 'react';
import { PieChart } from 'lucide-react';
import { ThreatCategoryStat } from '../lib/types';
import { cn } from '../lib/utils';

interface ThreatDonutChartProps {
  categories?: ThreatCategoryStat[] | null;
  totalScans?: number | null;
  isLoading?: boolean;
}

interface DisplaySlice {
  category: string;
  label: string;
  count: number;
  percentage: number;
  color: string;
}

const CATEGORY_MAP: Record<string, { label: string; color: string }> = {
  safe: { label: 'Safe & Verified', color: 'var(--safe)' },
  privacy_abuse: { label: 'Privacy & Data Selling', color: '#8b5cf6' },
  credential_theft: { label: 'Credential Theft Forms', color: 'var(--danger)' },
  elevated_risk: { label: 'Elevated Risk', color: 'var(--caution)' },
  suspicious_content: { label: 'Suspicious Content', color: 'var(--caution)' },
};

function getCategoryConfig(cat: string): { label: string; color: string } {
  if (CATEGORY_MAP[cat]) return CATEGORY_MAP[cat];
  const formatted = cat
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  return { label: formatted, color: '#38bdf8' };
}

export default function ThreatDonutChart({
  categories = null,
  totalScans = null,
  isLoading = false,
}: ThreatDonutChartProps) {
  const [activeSlice, setActiveSlice] = useState<DisplaySlice | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 60);
    return () => clearTimeout(timer);
  }, [categories]);

  const slices: DisplaySlice[] = React.useMemo(() => {
    if (!categories || categories.length === 0) return [];
    return categories.map((cat) => {
      const config = getCategoryConfig(cat.category);
      return {
        category: cat.category,
        label: config.label,
        count: cat.count,
        percentage: cat.percentage,
        color: config.color,
      };
    });
  }, [categories]);

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
        <p className="mt-0.5 text-xs text-muted-foreground">Proportion of detected web risks across records</p>
      </div>

      <div className="flex flex-1 flex-wrap items-center justify-around gap-4">
        {isLoading ? (
          <div className="flex h-[160px] w-full items-center justify-center text-xs text-muted-foreground animate-pulse">
            Loading threat distribution...
          </div>
        ) : !categories ? (
          <div className="flex h-[160px] w-full items-center justify-center text-xs text-muted-foreground">
            Threat analytics unavailable (Backend offline)
          </div>
        ) : slices.length === 0 || totalScans === 0 ? (
          <div className="flex h-[160px] w-full items-center justify-center text-xs text-muted-foreground">
            No threat detections recorded for this period.
          </div>
        ) : (
          <>
            {/* SVG Donut */}
            <div className="relative" style={{ width: size, height: size }}>
              <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 overflow-visible">
                {slices.map((slice, i) => {
                  const segmentLength = (slice.percentage / 100) * circumference;
                  const strokeDasharray = `${segmentLength} ${circumference}`;
                  const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
                  accumulatedPercent += slice.percentage;

                  const isHovered = activeSlice?.category === slice.category;

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
                  {activeSlice ? `${activeSlice.percentage}%` : `${totalScans ?? 0}`}
                </span>
                <span className="text-[10px] text-muted-foreground mt-1 max-w-[80px] leading-tight">
                  {activeSlice ? activeSlice.label : 'Total Scans'}
                </span>
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-col gap-3">
              {slices.map((slice, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 transition-opacity duration-200",
                    activeSlice && activeSlice.category !== slice.category ? "opacity-40" : "opacity-100"
                  )}
                  onMouseEnter={() => setActiveSlice(slice)}
                  onMouseLeave={() => setActiveSlice(null)}
                >
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: slice.color }} />
                  <div>
                    <div className="text-[11px] font-medium text-heading leading-none">
                      {slice.label} ({slice.percentage}%)
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1 leading-none">
                      {slice.count.toLocaleString()} {slice.count === 1 ? 'occurrence' : 'occurrences'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
