export interface ScanHistoryItem {
  id: string;
  url: string;
  domain: string;
  score: number;
  security_score?: number;
  privacy_score?: number;
  severity: 'low' | 'medium' | 'high';
  verdict: 'allow' | 'warn' | 'block';
  threat_category: string;
  scanned_at: string;
}

export interface ProviderStatus {
  provider: string;
  status: 'clean' | 'detected' | 'unavailable';
  categories: string[];
  summary: string;
}

export interface DetailedScanResult {
  analysis_id: string;
  url: string;
  domain: string;
  score: number;
  security_score?: number;
  privacy_score?: number;
  domain_authority?: number;
  severity: 'low' | 'medium' | 'high';
  confidence: number;
  threat_category: string;
  recommendations: string[];
  factors: string[];
  decision: {
    action: 'allow' | 'warn' | 'block';
    severity: 'low' | 'medium' | 'high';
    ui: {
      color: 'emerald' | 'amber' | 'rose' | 'slate';
    };
  };
  threat_intelligence?: {
    sources: ProviderStatus[];
  };
  privacy_assessment?: {
    status: string;
    findings: Array<{
      category: string;
      severity: string;
      feature_trigger: string;
      internal_code: string;
    }>;
  };
  features?: {
    hasHttps?: boolean;
    hasPasswordField?: boolean;
    hasLoginForm?: boolean;
    formCount?: number;
    externalLinkCount?: number;
    iframeCount?: number;
    scriptCount?: number;
    imageCount?: number;
    suspiciousKeywords?: string[];
    hostnameLength?: number;
    subdomainCount?: number;
    thirdPartyCookieCount?: number;
  };
  scanned_at: string;
}

export interface ThreatCategoryStat {
  category: string;
  count: number;
  percentage: number;
}

export interface DailyTimelinePoint {
  date: string;
  total: number;
  safe: number;
  blocked: number;
}

export interface AnalyticsOverview {
  period_days: number;
  total_scans: number;
  threats_blocked: number;
  average_trust_score: number;
  privacy_violations: number;
  risk_distribution: Record<string, number>;
  verdict_distribution: Record<string, number>;
  threat_categories: ThreatCategoryStat[];
  timeline: DailyTimelinePoint[];
}

export interface DashboardMetrics {
  totalScans: number;
  threatsBlocked: number;
  averageTrustScore: number;
  privacyViolations: number;
}
