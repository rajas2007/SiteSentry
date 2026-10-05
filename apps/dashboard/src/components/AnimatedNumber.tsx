'use client';

import React, { useEffect, useState, useRef } from 'react';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  format?: boolean;
  suffix?: string;
  className?: string;
}

export default function AnimatedNumber({
  value,
  duration = 750,
  format = true,
  suffix = '',
  className = '',
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const prevValueRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setDisplayValue(value);
      prevValueRef.current = value;
      return;
    }

    const startValue = prevValueRef.current;
    const endValue = value;
    const change = endValue - startValue;

    if (change === 0) {
      setDisplayValue(endValue);
      return;
    }

    const animateCount = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic: 1 - (1 - t)^3
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startValue + change * easeOut);

      setDisplayValue(current);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animateCount);
      } else {
        setDisplayValue(endValue);
        prevValueRef.current = endValue;
        startTimeRef.current = null;
      }
    };

    startTimeRef.current = null;
    animationFrameRef.current = requestAnimationFrame(animateCount);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [value, duration]);

  const formatted = format ? displayValue.toLocaleString() : displayValue.toString();

  return (
    <span className={className}>
      {formatted}{suffix}
    </span>
  );
}
