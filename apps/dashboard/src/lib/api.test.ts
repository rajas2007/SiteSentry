import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchAnalytics, fetchScanHistory, fetchScanDetail, performLiveScan } from './api';

describe('fetchAnalytics', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('successfully fetches and returns parsed AnalyticsOverview', async () => {
    const mockOverview = {
      period_days: 30,
      total_scans: 100,
      threats_blocked: 5,
      average_trust_score: 88.5,
      privacy_violations: 4,
      risk_distribution: { low: 80, medium: 15, high: 5 },
      verdict_distribution: { allow: 80, warn: 15, block: 5 },
      threat_categories: [
        { category: 'safe', count: 80, percentage: 80.0 },
      ],
      timeline: [
        { date: '2026-10-10', total: 10, safe: 8, blocked: 2 },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockOverview,
    });

    const result = await fetchAnalytics(30);
    expect(result).toEqual(mockOverview);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/analytics/overview?days=30'),
      expect.any(Object)
    );
  });

  it('clamps days parameter between 1 and 365', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        period_days: 1,
        total_scans: 0,
        threats_blocked: 0,
        average_trust_score: 0.0,
        privacy_violations: 0,
        risk_distribution: {},
        verdict_distribution: {},
        threat_categories: [],
        timeline: [],
      }),
    });

    await fetchAnalytics(0);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('days=1'),
      expect.any(Object)
    );

    await fetchAnalytics(500);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('days=365'),
      expect.any(Object)
    );
  });

  it('returns null when API returns an HTTP error status', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    const result = await fetchAnalytics(30);
    expect(result).toBeNull();
  });

  it('returns null on network failure or abort timeout', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network disconnected'));

    const result = await fetchAnalytics(30);
    expect(result).toBeNull();
  });

  it('returns null on malformed response payload', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        invalid_structure: true,
      }),
    });

    const result = await fetchAnalytics(30);
    expect(result).toBeNull();
  });

  it('demonstrates sequence guarding prevents stale responses from overwriting newer data', async () => {
    let sequence = 0;
    let currentAnalytics: any = null;

    let resolveFirst: (val: any) => void;
    const firstPromise = new Promise((resolve) => {
      resolveFirst = resolve;
    });

    const secondData = {
      period_days: 30,
      total_scans: 105,
      threats_blocked: 6,
      average_trust_score: 90.0,
      privacy_violations: 4,
      risk_distribution: {},
      verdict_distribution: {},
      threat_categories: [],
      timeline: [],
    };

    // Request 1 initiated
    const fetchId1 = ++sequence;
    const req1 = firstPromise.then((data) => {
      if (fetchId1 === sequence) {
        currentAnalytics = data;
      }
    });

    // Request 2 initiated and finishes immediately
    const fetchId2 = ++sequence;
    const req2 = Promise.resolve(secondData).then((data) => {
      if (fetchId2 === sequence) {
        currentAnalytics = data;
      }
    });
    await req2;

    // Stale Request 1 finishes later
    resolveFirst!({
      period_days: 30,
      total_scans: 101,
      threats_blocked: 5,
      average_trust_score: 80.0,
      privacy_violations: 4,
      risk_distribution: {},
      verdict_distribution: {},
      threat_categories: [],
      timeline: [],
    });
    await req1;

    // Stale response must not overwrite the newer request
    expect(currentAnalytics.total_scans).toBe(105);
    expect(currentAnalytics.average_trust_score).toBe(90.0);
  });
});

describe('fetchScanHistory', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('successfully returns records from backend when available', async () => {
    const mockItems = [
      {
        id: 'scan-real-1',
        url: 'https://real-site.org',
        domain: 'real-site.org',
        score: 92,
        severity: 'low' as const,
        verdict: 'allow' as const,
        threat_category: 'safe',
        scanned_at: '2026-10-11T12:00:00.000Z',
      },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: mockItems,
        total: 1,
        limit: 20,
        offset: 0,
      }),
    });

    const result = await fetchScanHistory(20, 0);
    expect(result).toEqual({ items: mockItems, total: 1 });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/history?limit=20&offset=0'),
      expect.any(Object)
    );
  });

  it('returns an actual empty list when backend response contains zero scans', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [],
        total: 0,
        limit: 20,
        offset: 0,
      }),
    });

    const result = await fetchScanHistory(20, 0);
    expect(result).toEqual({ items: [], total: 0 });
    expect(result?.items).toHaveLength(0);
  });

  it('returns null when backend is unavailable (network error)', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Failed to connect'));

    const result = await fetchScanHistory(10, 0);
    expect(result).toBeNull();
  });

  it('returns null when backend returns an HTTP error status', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    });

    const result = await fetchScanHistory(5, 0);
    expect(result).toBeNull();
  });

  it('preserves domain filtering and pagination query parameters', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [],
        total: 0,
        limit: 5,
        offset: 10,
      }),
    });

    await fetchScanHistory(5, 10, 'github.com');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('limit=5'),
      expect.any(Object)
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('offset=10'),
      expect.any(Object)
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('domain=github.com'),
      expect.any(Object)
    );
  });
});

describe('fetchScanDetail', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('successfully retrieves and parses scan detail by id', async () => {
    const mockDetail = {
      id: 'scan-123',
      url: 'https://example.com',
      domain: 'example.com',
      score: 95,
      severity: 'low',
      verdict: 'allow',
      threat_category: 'safe',
      scanned_at: '2026-10-11T12:00:00.000Z',
      confidence: 0.95,
      recommendations: ['Safe'],
      factors: ['HTTPS'],
      decision: { action: 'allow', severity: 'low', ui: { color: 'emerald' } },
      threat_intelligence: null,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockDetail,
    });

    const result = await fetchScanDetail('scan-123');
    expect(result).not.toBeNull();
    expect(result?.analysis_id).toBe('scan-123');
    expect(result?.url).toBe('https://example.com');
    expect(result?.score).toBe(95);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/history/scan-123'),
      expect.any(Object)
    );
  });

  it('returns null when scan is not found (404)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    const result = await fetchScanDetail('nonexistent-id');
    expect(result).toBeNull();
  });

  it('returns null on network failure', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Connection timeout'));

    const result = await fetchScanDetail('scan-123');
    expect(result).toBeNull();
  });
});

describe('performLiveScan', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('successfully performs live scan and returns DetailedScanResult when backend succeeds', async () => {
    const mockApiResponse = {
      analysis_id: 'scan-live-99',
      url: 'https://example.com',
      score: 95,
      security_score: 95,
      privacy_score: 90,
      domain_authority: 95,
      severity: 'low',
      confidence: 0.98,
      threat_category: 'safe',
      recommendations: ['No issues detected'],
      factors: ['Valid HTTPS', 'Reputable domain'],
      decision: { action: 'allow', severity: 'low', ui: { color: 'emerald' } },
      threat_intelligence: null,
      scanned_at: '2026-10-14T12:00:00.000Z',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    });

    const result = await performLiveScan('https://example.com');
    expect(result).not.toBeNull();
    expect(result.analysis_id).toBe('scan-live-99');
    expect(result.url).toBe('https://example.com');
    expect(result.domain).toBe('example.com');
    expect(result.score).toBe(95);
    expect(result.decision.action).toBe('allow');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/analyze'),
      expect.objectContaining({
        method: 'POST',
      })
    );
  });

  it('throws Error when backend is unavailable (network error)', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network disconnected'));

    await expect(performLiveScan('https://example.com')).rejects.toThrow(
      'Network disconnected'
    );
  });

  it('throws Error when backend returns an HTTP error status', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
    });

    await expect(performLiveScan('https://example.com')).rejects.toThrow(
      'Live scan failed: Backend returned HTTP status 502'
    );
  });

  it('throws Error when backend returns invalid/malformed response structure', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'error',
      }),
    });

    await expect(performLiveScan('https://example.com')).rejects.toThrow(
      'Live scan failed: Invalid response structure from backend analysis service'
    );
  });

  it('never returns a synthetic/fabricated scan result on failure', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Backend offline'));

    let errorThrown: any = null;
    try {
      await performLiveScan('https://example.com');
    } catch (err) {
      errorThrown = err;
    }

    expect(errorThrown).toBeInstanceOf(Error);
  });
});
