export type Severity = "LOW" | "MEDIUM" | "HIGH";
export type DecisionAction = "allow" | "warn" | "block";

export const RISK_RANGES = {
  LOW: [80, 100],
  MEDIUM: [50, 79],
  HIGH: [0, 49],
} as const;

export function severityFromScore(score: number): Severity {
  if (score >= 80) return "LOW";
  if (score >= 50) return "MEDIUM";
  return "HIGH";
}

export const severityStyle: Record<
  Severity,
  { text: string; bg: string; border: string; dot: string; label: string }
> = {
  LOW: {
    text: "text-safe",
    bg: "bg-safe-soft",
    border: "border-safe/30",
    dot: "bg-safe",
    label: "Low risk",
  },
  MEDIUM: {
    text: "text-caution",
    bg: "bg-caution-soft",
    border: "border-caution/30",
    dot: "bg-caution",
    label: "Medium risk",
  },
  HIGH: {
    text: "text-danger",
    bg: "bg-danger-soft",
    border: "border-danger/30",
    dot: "bg-danger",
    label: "High risk",
  },
};

export function formatCategory(c: string | null) {
  return c ? c.replace(/_/g, " ") : "none";
}
