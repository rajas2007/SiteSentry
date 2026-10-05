'use client';

import React, { useEffect, useState } from 'react';
import AnimatedNumber from './AnimatedNumber';

interface ScoreGaugeProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  showSubtitle?: boolean;
}

export default function ScoreGauge({
  score,
  size = 80,
  strokeWidth = 6,
  showSubtitle = true,
}: ScoreGaugeProps) {
  const [offset, setOffset] = useState(0);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const isSafe = score >= 80;
  const isMedium = score >= 50 && score < 80;

  const strokeColor = isSafe ? '#34d399' : isMedium ? '#fbbf24' : '#fb7185';
  const trackColor = isSafe ? 'rgba(52, 211, 153, 0.15)' : isMedium ? 'rgba(251, 191, 36, 0.15)' : 'rgba(251, 113, 133, 0.15)';

  useEffect(() => {
    const targetOffset = circumference - (score / 100) * circumference;
    const timer = setTimeout(() => {
      setOffset(targetOffset);
    }, 50);
    return () => clearTimeout(timer);
  }, [score, circumference]);

  return (
    <div
      style={{
        position: 'relative',
        width: `${size}px`,
        height: `${size}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: 'rotate(-90deg)' }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{
            transition: 'stroke-dashoffset 800ms var(--ease-out-smooth), stroke 300ms ease',
          }}
        />
      </svg>

      <div
        style={{
          position: 'absolute',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1,
        }}
      >
        <span
          style={{
            fontSize: size >= 70 ? '1.5rem' : '1.25rem',
            fontWeight: 800,
            fontFamily: 'var(--font-heading)',
            color: '#ffffff',
            letterSpacing: '-0.02em',
          }}
        >
          <AnimatedNumber value={score} format={false} duration={750} />
        </span>
        {showSubtitle && (
          <span style={{ fontSize: '0.6rem', color: 'var(--text-dim)', marginTop: '2px' }}>
            /100
          </span>
        )}
      </div>
    </div>
  );
}
