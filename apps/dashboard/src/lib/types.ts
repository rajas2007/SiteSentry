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

export interface DashboardMetrics {
  totalScans: number;
  threatsBlocked: number;
  averageTrustScore: number;
  privacyViolations: number;
  scansTrend: string;
  threatsTrend: string;
}
