import { ScanHistoryItem, DetailedScanResult, DashboardMetrics, AnalyticsOverview } from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const INITIAL_METRICS: DashboardMetrics = {
  totalScans: 0,
  threatsBlocked: 0,
  averageTrustScore: 0,
  privacyViolations: 0,
};

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchScanHistory(
  limit = 20,
  offset = 0,
  domain?: string
): Promise<{ items: ScanHistoryItem[]; total: number } | null> {
  try {
    const url = new URL(`${API_BASE_URL}/api/v1/history`);
    url.searchParams.set('limit', limit.toString());
    url.searchParams.set('offset', offset.toString());
    if (domain) url.searchParams.set('domain', domain);

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(3000) });
    if (!res.ok) {
      return null;
    }
    const data = await res.json();
    if (data && Array.isArray(data.items)) {
      return {
        items: data.items,
        total: typeof data.total === 'number' ? data.total : data.items.length,
      };
    }
    return null;
  } catch (error) {
    console.warn('Backend unavailable or network error when fetching scan history:', error);
    return null;
  }
}

export async function performLiveScan(targetUrl: string): Promise<DetailedScanResult> {
  let hostname = '';
  try {
    hostname = new URL(targetUrl).hostname;
  } catch {
    hostname = targetUrl.replace(/^https?:\/\//, '').split('/')[0];
    targetUrl = `https://${targetUrl}`;
  }

  const isHttps = targetUrl.startsWith('https://');
  const isSuspicious = targetUrl.includes('verify') || targetUrl.includes('phish') || targetUrl.includes('security-update') || targetUrl.includes('claim') || targetUrl.includes('free-gift') || targetUrl.includes('banking') || !isHttps;
  const isPrivacyAbuse = targetUrl.includes('shopping') || targetUrl.includes('deals') || targetUrl.includes('track');

  const payload = {
    url: targetUrl,
    title: `Live Analysis of ${hostname}`,
    hostname,
    features: {
      hasPasswordField: targetUrl.toLowerCase().includes('login') || targetUrl.toLowerCase().includes('auth'),
      hasLoginForm: targetUrl.toLowerCase().includes('login') || targetUrl.toLowerCase().includes('auth'),
      formCount: targetUrl.toLowerCase().includes('login') ? 2 : 1,
      externalLinkCount: 4,
      iframeCount: 0,
      scriptCount: 12,
      imageCount: 8,
      suspiciousKeywords: targetUrl.toLowerCase().includes('verify') || targetUrl.toLowerCase().includes('update') ? ['verify', 'account'] : [],
      pageTextLength: 1540,
      hasHttps: isHttps,
      hostnameLength: hostname.length,
      subdomainCount: hostname.split('.').length > 2 ? hostname.split('.').length - 2 : 0,
    },
    privacy_policy_text: 'We may share information with marketing partners and third-party affiliates for advertising purposes.',
    third_party_cookie_count: isPrivacyAbuse ? 14 : 3,
  };

  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(4500),
    });

    if (!res.ok) {
      throw new Error(`Live scan failed: Backend returned HTTP status ${res.status}`);
    }

    const data = await res.json();
    if (!data || typeof data.score !== 'number' || !data.decision) {
      throw new Error('Live scan failed: Invalid response structure from backend analysis service');
    }

    return {
      analysis_id: data.analysis_id || `scan-${Date.now()}`,
      url: data.url || targetUrl,
      domain: hostname,
      score: data.score,
      security_score: data.security_score ?? Math.round(data.score * 0.95),
      privacy_score: data.privacy_score ?? Math.max(30, Math.round(data.score * 0.9)),
      domain_authority: data.domain_authority ?? Math.min(99, Math.round(data.score * 0.98)),
      severity: data.severity || (data.score < 50 ? 'high' : data.score < 80 ? 'medium' : 'low'),
      confidence: typeof data.confidence === 'number' ? data.confidence : 0.9,
      threat_category: data.threat_category || 'safe',
      recommendations: Array.isArray(data.recommendations) ? data.recommendations : [],
      factors: Array.isArray(data.factors) ? data.factors : [],
      decision: data.decision,
      threat_intelligence: data.threat_intelligence,
      features: payload.features,
      scanned_at: data.scanned_at || new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Analysis service is currently unreachable. Please check backend connection.');
  }
}

export async function fetchScanDetail(analysis_id: string): Promise<DetailedScanResult | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/history/${analysis_id}`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      return {
        analysis_id: data.id,
        url: data.url,
        domain: data.domain,
        score: data.score,
        severity: data.severity,
        verdict: data.verdict,
        threat_category: data.threat_category,
        scanned_at: data.scanned_at,
        confidence: data.confidence || 0,
        recommendations: data.recommendations || [],
        factors: data.factors || [],
        decision: data.decision || {
          action: data.verdict,
          severity: data.severity,
          ui: { color: 'slate' }
        },
        threat_intelligence: data.threat_intelligence,
      } as DetailedScanResult;
    }
  } catch (error) {
    console.error('Failed to fetch scan detail:', error);
  }
  return null;
}

export async function fetchAnalytics(days = 30): Promise<AnalyticsOverview | null> {
  try {
    const url = new URL(`${API_BASE_URL}/api/v1/analytics/overview`);
    url.searchParams.set('days', Math.max(1, Math.min(365, days)).toString());

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(4000) });
    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    if (
      typeof data.total_scans !== 'number' ||
      typeof data.threats_blocked !== 'number' ||
      typeof data.average_trust_score !== 'number' ||
      !Array.isArray(data.timeline) ||
      !Array.isArray(data.threat_categories)
    ) {
      return null;
    }

    return data as AnalyticsOverview;
  } catch (error) {
    console.warn('Backend unavailable or network error when fetching analytics:', error);
    return null;
  }
}
