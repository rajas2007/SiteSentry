export interface PageFeatures {
  hasPasswordField: boolean;
  hasLoginForm: boolean;
  formCount: number;
  externalLinkCount: number;
  iframeCount: number;
  scriptCount: number;
  imageCount: number;
  suspiciousKeywords: string[];
  pageTextLength: number;
  hasHttps: boolean;
  hostnameLength: number;
  subdomainCount: number;
}

export interface PageAnalysisRequest {
  url: string;
  title: string;
  hostname: string;
  features: PageFeatures;
  privacy_policy_text?: string | null;
  third_party_cookie_count?: number;
}

export interface DecisionUI {
  color: 'emerald' | 'amber' | 'rose' | 'slate';
}

export interface Decision {
  action: 'allow' | 'warn' | 'block';
  severity: 'low' | 'medium' | 'high';
  ui: DecisionUI;
}

export interface ProviderStatusResponse {
  provider: string;
  status: 'clean' | 'detected' | 'unavailable';
  categories: string[];
  summary: string;
}

export interface ThreatIntelligenceResponse {
  sources: ProviderStatusResponse[];
}

export interface PageAnalysisResponse {
  analysis_id: string;
  score: number;
  severity: 'low' | 'medium' | 'high';
  confidence: number;
  threat_category: string;
  recommendations: string[];
  factors: string[];
  decision: Decision;
  threat_intelligence?: ThreatIntelligenceResponse;
}

export type ExtensionMessage =
  | {
      type: "ANALYZE_PAGE";
      payload: PageAnalysisRequest;
    }
  | {
      type: "GET_CURRENT_ANALYSIS";
    };

export type ExtensionMessageResponse =
  | {
      status: "SUCCESS";
      data: PageAnalysisResponse;
    }
  | {
      status: "ERROR";
      error: string;
    }
  | {
      status: "PENDING";
    };
