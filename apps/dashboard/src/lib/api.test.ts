import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchAnalytics, fetchScanHistory, fetchScanDetail, SAMPLE_SCANS } from './api';

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
    // Must NOT return SAMPLE_SCANS
    expect(result.items).toHaveLength(0);
  });

  it('falls back to demo/sample scans when backend is unavailable (network error)', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Failed to connect'));

    const result = await fetchScanHistory(10, 0);
    expect(result.items).toHaveLength(10);
    expect(result.items).toEqual(SAMPLE_SCANS.slice(0, 10));
    expect(result.total).toBe(SAMPLE_SCANS.length);
  });

  it('falls back to demo/sample scans when backend returns an HTTP error status', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    });

    const result = await fetchScanHistory(5, 0);
    expect(result.items).toHaveLength(5);
    expect(result.items).toEqual(SAMPLE_SCANS.slice(0, 5));
    expect(result.total).toBe(SAMPLE_SCANS.length);
  });

  it('preserves domain filtering and pagination in fallback mode', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Offline'));

    const result = await fetchScanHistory(5, 0, 'github.com');
    expect(result.items.every(s => s.domain.includes('github.com'))).toBe(true);
    expect(result.total).toBeGreaterThan(0);
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
