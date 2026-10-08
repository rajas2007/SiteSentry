import { useEffect, useState, type ReactNode } from "react";
import { cn } from "./utils";
import { RISK_RANGES, severityFromScore, severityStyle, type Severity } from "./sentry";
const iconPrimary = "/Site-Sentry-assests/site-sentry-icon-primary.png";
const statusSafe = "/Site-Sentry-assests/site-sentry-status-safe.png";
const statusThreat = "/Site-Sentry-assests/site-sentry-status-threat.png";
const statusWarning = "/Site-Sentry-assests/site-sentry-status-warning.png";
const logoDark = "/Site-Sentry-assests/site-sentry-logo-dark.png";
const mascotSafe = "/Site-Sentry-assests/site-sentry-mascot-safe.png";
const mascotSafeSmall = "/Site-Sentry-assests/site-sentry-mascot-safe-small.png";
const mascotThreat = "/Site-Sentry-assests/site-sentry-mascot-threat.png";
const mascotThreatSmall = "/Site-Sentry-assests/site-sentry-mascot-threat-small.png";
const mascotWarning = "/Site-Sentry-assests/site-sentry-mascot-warning.png";
const mascotWarningSmall = "/Site-Sentry-assests/site-sentry-mascot-warning-small.png";

export function Logo({ className }: { className?: string }) {
  return (
    <img
      src={iconPrimary}
      alt=""
      aria-hidden="true"
      className={cn("h-8 w-8 object-contain", className)}
    />
  );
}

export function BrandWordmark({ className }: { className?: string }) {
  return (
    <img src={logoDark} alt="Site Sentry" className={cn("h-auto w-40 object-contain", className)} />
  );
}

const statusAsset: Record<Severity, string> = {
  LOW: statusSafe,
  MEDIUM: statusWarning,
  HIGH: statusThreat,
};

export function SeverityIcon({ severity, className }: { severity: Severity; className?: string }) {
  return (
    <img
      src={statusAsset[severity]}
      alt=""
      aria-hidden="true"
      className={cn("h-4 w-4 shrink-0 object-contain", className)}
    />
  );
}

type RiskMascotScale = "compact" | "supporting";

const riskMascotAsset: Record<Severity, Record<RiskMascotScale, string>> = {
  LOW: { compact: mascotSafeSmall, supporting: mascotSafe },
  MEDIUM: { compact: mascotWarningSmall, supporting: mascotWarning },
  HIGH: { compact: mascotThreatSmall, supporting: mascotThreat },
};

export function RiskMascot({
  severity,
  scale = "compact",
  className,
}: {
  severity: Severity;
  scale?: RiskMascotScale;
  className?: string;
}) {
  return (
    <img
      src={riskMascotAsset[severity][scale]}
      alt=""
      aria-hidden="true"
      className={cn(
        scale === "supporting"
          ? "h-10 w-10 shrink-0 object-contain sm:h-14 sm:w-14"
          : "h-8 w-8 shrink-0 object-contain",
        className,
      )}
    />
  );
}

export function RiskBadge({ severity, className }: { severity: Severity; className?: string }) {
  const tone = severityStyle[severity];
  return (
    <span
      className={cn(
        "risk-marker inline-flex items-center gap-2 border-y border-r border-l-2 px-2.5 py-1 font-sans text-xs font-semibold tracking-[0.01em]",
        tone.text,
        tone.bg,
        tone.border,
        className,
      )}
    >
      <SeverityIcon severity={severity} className="h-4 w-4" />
      {tone.label}
    </span>
  );
}

export function Panel({
  title,
  meta,
  children,
  className,
}: {
  title?: string;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "relative overflow-hidden border border-border/80 bg-card/90 shadow-[0_1px_0_rgb(255_255_255/0.025)]",
        className,
      )}
    >
      {title && (
        <header className="flex min-h-11 items-center justify-between gap-3 border-b border-border/80 bg-secondary/25 px-4 py-2.5">
          <h2 className="text-xs font-semibold tracking-wide text-heading">{title}</h2>
          {meta && <div className="label-tech text-right">{meta}</div>}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

/** A 270-degree score instrument with a severity-colored signal arc. */
export function ScoreRing({
  score,
  severity,
  size = 120,
  showRanges = true,
}: {
  score: number;
  severity: Severity;
  size?: number;
  showRanges?: boolean;
}) {
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    setAnimatedScore(0);
    if (score === 0) return;

    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (reducedMotion || typeof window.requestAnimationFrame !== "function") {
      setAnimatedScore(score);
      return;
    }

    const duration = 820;
    let frame = 0;
    let startTime: number | undefined;
    const animate = (now: number) => {
      startTime ??= now;
      const progress = Math.min(Math.max((now - startTime) / duration, 0), 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(progress === 1 ? score : Math.round(score * eased));
      if (progress < 1) frame = window.requestAnimationFrame(animate);
    };

    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [score]);

  const radius = 41;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.75;
  const valueLength = (arcLength * animatedScore) / 100;
  const color =
    severity === "LOW" ? "var(--safe)" : severity === "MEDIUM" ? "var(--caution)" : "var(--danger)";
  const markerAngle = ((135 + animatedScore * 2.7) * Math.PI) / 180;
  const markerX = 50 + radius * Math.cos(markerAngle);
  const markerY = 50 + radius * Math.sin(markerAngle);
  const riskBands = [
    { start: RISK_RANGES.HIGH[0], end: RISK_RANGES.MEDIUM[0], severity: "HIGH" as const },
    { start: RISK_RANGES.MEDIUM[0], end: RISK_RANGES.LOW[0], severity: "MEDIUM" as const },
    { start: RISK_RANGES.LOW[0], end: RISK_RANGES.LOW[1], severity: "LOW" as const },
  ];
  const riskColors = { LOW: "var(--safe)", MEDIUM: "var(--caution)", HIGH: "var(--danger)" };
  const scaleLabels = [
    { label: "HIGH", range: `${RISK_RANGES.HIGH[0]}–${RISK_RANGES.HIGH[1]}`, severity: "HIGH" },
    {
      label: "MEDIUM",
      range: `${RISK_RANGES.MEDIUM[0]}–${RISK_RANGES.MEDIUM[1]}`,
      severity: "MEDIUM",
    },
    { label: "LOW", range: `${RISK_RANGES.LOW[0]}–${RISK_RANGES.LOW[1]}`, severity: "LOW" },
  ] as const;

  return (
    <div className="flex shrink-0 flex-col items-center" style={{ width: size }}>
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        role="img"
        aria-label={`Score ${score} of 100, ${severityStyle[severity].label}`}
        className="overflow-visible"
      >
        <circle
          cx="50"
          cy="50"
          r="47"
          fill="var(--background)"
          stroke="var(--border)"
          strokeWidth="0.6"
        />
        <circle
          cx="50"
          cy="50"
          r="44"
          fill="none"
          stroke="var(--border)"
          strokeWidth="0.35"
          opacity="0.8"
        />
        {Array.from({ length: 31 }).map((_, index) => {
          const tickScore = (index / 30) * 100;
          const tickSeverity = severityFromScore(tickScore);
          return (
            <line
              key={index}
              x1="50"
              y1="3.5"
              x2="50"
              y2={index % 5 === 0 ? 8 : 5.5}
              stroke={riskColors[tickSeverity]}
              strokeWidth={index % 5 === 0 ? "0.75" : "0.45"}
              opacity={index % 5 === 0 ? "0.72" : "0.4"}
              transform={`rotate(${-135 + index * 9} 50 50)`}
            />
          );
        })}
        <path
          d="M 21 79 A 41 41 0 1 1 79 79"
          fill="none"
          stroke="var(--secondary)"
          strokeWidth="4.5"
          strokeLinecap="butt"
        />
        {riskBands.map((band) => (
          <path
            key={band.severity}
            d="M 21 79 A 41 41 0 1 1 79 79"
            fill="none"
            stroke={riskColors[band.severity]}
            strokeWidth="2"
            strokeLinecap="butt"
            strokeDasharray={`${(arcLength * (band.end - band.start)) / 100} ${circumference}`}
            strokeDashoffset={`${(-arcLength * band.start) / 100}`}
            opacity="0.48"
          />
        ))}
        <path
          d="M 21 79 A 41 41 0 1 1 79 79"
          fill="none"
          stroke={color}
          strokeWidth="4.5"
          strokeLinecap="butt"
          strokeDasharray={`${valueLength} ${circumference}`}
          className="score-path"
          style={{ filter: `drop-shadow(0 0 4px ${color})` }}
        />
        <circle
          cx={markerX}
          cy={markerY}
          r="2.4"
          fill="var(--heading)"
          stroke={color}
          strokeWidth="1.5"
        />
        <text
          x="50"
          y="56"
          textAnchor="middle"
          className="fill-heading font-sans"
          fontSize="26"
          fontWeight="700"
        >
          {animatedScore}
        </text>
        <text
          x="50"
          y="67"
          textAnchor="middle"
          className="fill-muted-foreground font-mono"
          fontSize="7"
        >
          / 100
        </text>
      </svg>
      {showRanges && (
        <div className="grid w-full grid-cols-3 gap-0.5 border-t border-border/45 pt-1 text-center font-sans text-[9px] leading-tight">
          {scaleLabels.map((item) => (
            <span key={item.label} className={severityStyle[item.severity].text}>
              {item.label}
              <span className="block text-[8px] text-muted-foreground">{item.range}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function PendingScoreDial({ size = 96 }: { size?: number }) {
  const radius = 41;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.75;

  return (
    <div className="flex shrink-0 items-center justify-center" style={{ width: size }}>
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        role="img"
        aria-label="Risk score pending. No score has been produced."
      >
        <circle
          cx="50"
          cy="50"
          r="47"
          fill="var(--background)"
          stroke="var(--border)"
          strokeWidth="0.6"
        />
        <path
          d="M 21 79 A 41 41 0 1 1 79 79"
          fill="none"
          stroke="var(--secondary)"
          strokeWidth="4.5"
          strokeLinecap="butt"
          strokeDasharray={`${arcLength} ${circumference}`}
        />
        <text
          x="50"
          y="35"
          textAnchor="middle"
          className="fill-muted-foreground font-mono"
          fontSize="5.2"
          letterSpacing="1.1"
        >
          RISK SCORE
        </text>
        <text
          x="50"
          y="56"
          textAnchor="middle"
          className="fill-heading font-mono"
          fontSize="26"
          fontWeight="600"
        >
          —
        </text>
        <text
          x="50"
          y="67"
          textAnchor="middle"
          className="fill-muted-foreground font-mono"
          fontSize="6"
          letterSpacing="0.5"
        >
          PENDING
        </text>
      </svg>
    </div>
  );
}


