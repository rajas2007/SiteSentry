// Mirrors the Site Sentry analysis API response contract. Field names are kept
// identical to the backend (analysis_id, score, severity, decision.action, ...).
// The preview uses sample responses; replace `sampleAnalyses` with real API data.

export type Severity = "LOW" | "MEDIUM" | "HIGH";
export type DecisionAction = "allow" | "warn" | "block";

export interface Factor {
  name: string;
  value: string;
  impact: "positive" | "neutral" | "negative";
}

export interface AnalysisResponse {
  analysis_id: string;
  url: string;
  hostname: string;
  score: number;
  severity: Severity;
  confidence: number;
  threat_category: string | null;
  analyzed_at: string;
  threat_intelligence: {
    google_safe_browsing: string;
    virustotal: string;
  };
  factors: Factor[];
  privacy: { score: number; notes: string[] };
  security: { score: number };
  web3: { available: boolean; score: number | null };
  recommendations: string[];
  decision: {
    action: DecisionAction;
    message: string;
    ui: { color: string };
  };
}

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

export const sampleAnalyses: AnalysisResponse[] = [
  {
    analysis_id: "an_7f3c21e9",
    url: "https://docs.example.com/guide",
    hostname: "docs.example.com",
    score: 92,
    severity: "LOW",
    confidence: 0.94,
    threat_category: null,
    analyzed_at: "2026-10-05T21:42:10Z",
    threat_intelligence: { google_safe_browsing: "No match", virustotal: "0 / 92 engines flagged" },
    factors: [
      { name: "Connection", value: "HTTPS", impact: "positive" },
      { name: "Login form", value: "Not detected", impact: "positive" },
      { name: "Password field", value: "Not detected", impact: "positive" },
      { name: "Suspicious indicators", value: "None", impact: "positive" },
    ],
    privacy: { score: 88, notes: ["2 third-party trackers detected"] },
    security: { score: 94 },
    web3: { available: false, score: null },
    recommendations: ["No action needed. Continue browsing normally."],
    decision: { action: "allow", message: "Allow — safe browsing.", ui: { color: "#10B981" } },
  },
  {
    analysis_id: "an_b41d08aa",
    url: "http://deals-portal.net/account",
    hostname: "deals-portal.net",
    score: 64,
    severity: "MEDIUM",
    confidence: 0.81,
    threat_category: "suspicious_content",
    analyzed_at: "2026-10-05T21:18:44Z",
    threat_intelligence: { google_safe_browsing: "No match", virustotal: "2 / 92 engines flagged" },
    factors: [
      { name: "Connection", value: "HTTP (unencrypted)", impact: "negative" },
      { name: "Login form", value: "Detected", impact: "negative" },
      { name: "Password field", value: "Detected", impact: "neutral" },
      { name: "Suspicious indicators", value: "1 found", impact: "negative" },
    ],
    privacy: {
      score: 58,
      notes: ["9 third-party trackers detected", "No privacy policy link found"],
    },
    security: { score: 61 },
    web3: { available: false, score: null },
    recommendations: [
      "Be cautious before entering sensitive information.",
      "This page does not use an encrypted connection.",
    ],
    decision: {
      action: "warn",
      message: "Exercise caution before continuing.",
      ui: { color: "#D97706" },
    },
  },
  {
    analysis_id: "an_e90a5f13",
    url: "https://secure-login-verify.co/signin",
    hostname: "secure-login-verify.co",
    score: 18,
    severity: "HIGH",
    confidence: 0.97,
    threat_category: "credential_theft",
    analyzed_at: "2026-10-05T20:57:02Z",
    threat_intelligence: {
      google_safe_browsing: "Social engineering",
      virustotal: "14 / 92 engines flagged",
    },
    factors: [
      { name: "Connection", value: "HTTPS", impact: "neutral" },
      { name: "Login form", value: "Detected", impact: "negative" },
      { name: "Password field", value: "Detected", impact: "negative" },
      { name: "Suspicious indicators", value: "4 found", impact: "negative" },
    ],
    privacy: { score: 32, notes: ["Form posts to an external domain"] },
    security: { score: 15 },
    web3: { available: false, score: null },
    recommendations: [
      "Do not enter your password on this page.",
      "Leave this site and navigate to the official website directly.",
    ],
    decision: {
      action: "block",
      message: "Dangerous website — intervention required.",
      ui: { color: "#EF4444" },
    },
  },
  {
    analysis_id: "an_4c77d2b0",
    url: "https://download-codec.xyz/player",
    hostname: "download-codec.xyz",
    score: 34,
    severity: "HIGH",
    confidence: 0.9,
    threat_category: "malware",
    analyzed_at: "2026-10-05T20:31:40Z",
    threat_intelligence: { google_safe_browsing: "Malware", virustotal: "9 / 92 engines flagged" },
    factors: [
      { name: "Connection", value: "HTTPS", impact: "neutral" },
      { name: "Login form", value: "Not detected", impact: "positive" },
      { name: "Password field", value: "Not detected", impact: "positive" },
      { name: "Suspicious indicators", value: "3 found", impact: "negative" },
    ],
    privacy: { score: 40, notes: ["Forced download prompts detected"] },
    security: { score: 30 },
    web3: { available: false, score: null },
    recommendations: ["Do not download or run files from this site.", "Leave this site."],
    decision: {
      action: "block",
      message: "Dangerous website — intervention required.",
      ui: { color: "#EF4444" },
    },
  },
];

export interface HistoryEntry {
  analysis_id: string;
  hostname: string;
  score: number;
  severity: Severity;
  threat_category: string | null;
  analyzed_at: string;
  status: string;
}

const extra: [string, number, string | null, string][] = [
  ["github.com", 95, null, "2026-10-05T19:30:00Z"],
  ["free-gift-cards.biz", 31, "phishing", "2026-10-05T17:12:00Z"],
  ["news.ycombinator.com", 90, null, "2026-10-05T15:02:00Z"],
  ["coupon-hub.shop", 57, "suspicious_content", "2026-10-04T22:41:00Z"],
  ["wallet-connect-claim.io", 12, "credential_theft", "2026-10-04T18:09:00Z"],
  ["wikipedia.org", 97, null, "2026-10-04T11:20:00Z"],
  ["shop.example.org", 74, null, "2026-10-03T14:10:00Z"],
  ["mail.google.com", 96, null, "2026-10-03T09:00:00Z"],
];

const statusFor = (s: Severity) =>
  s === "LOW" ? "Allowed" : s === "MEDIUM" ? "Warned" : "Intervened";

export const sampleHistory: HistoryEntry[] = [
  ...sampleAnalyses.map((a) => ({
    analysis_id: a.analysis_id,
    hostname: a.hostname,
    score: a.score,
    severity: a.severity,
    threat_category: a.threat_category,
    analyzed_at: a.analyzed_at,
    status: statusFor(a.severity),
  })),
  ...extra.map(([hostname, score, cat, at], i) => {
    const severity = severityFromScore(score);
    return {
      analysis_id: `an_${(0x1a2b + i * 977).toString(16)}c0`,
      hostname,
      score,
      severity,
      threat_category: cat,
      analyzed_at: at,
      status: statusFor(severity),
    };
  }),
];

export function formatCategory(c: string | null) {
  return c ? c.replace(/_/g, " ") : "none";
}

export function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)} UTC`;
}
