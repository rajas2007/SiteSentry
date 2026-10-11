import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExtensionMessage, ExtensionMessageResponse, PageAnalysisResponse } from '@site-sentry/shared-types';
import { submitAnalysis } from '../api/analysisClient';

vi.mock('../api/analysisClient', () => ({
  submitAnalysis: vi.fn(),
}));

describe('Background Service Worker Persistence', () => {
  let messageListener: (
    message: ExtensionMessage,
    sender: { tab?: { id?: number } },
    sendResponse: (res: ExtensionMessageResponse) => void
  ) => boolean | void;

  let tabRemovedListener: (tabId: number) => void;
  let sessionStorageStore: Record<string, any>;
  let chromeMock: any;

  const sampleResponse: PageAnalysisResponse = {
    analysis_id: 'test-123',
    score: 95,
    severity: 'low',
    confidence: 0.9,
    threat_category: 'safe',
    recommendations: ['Safe to browse.'],
    factors: ['Connection is encrypted (HTTPS)'],
    decision: {
      action: 'allow',
      severity: 'low',
      ui: { color: 'emerald' },
    },
  };

  const sampleThreatResponse: PageAnalysisResponse = {
    analysis_id: 'threat-456',
    score: 20,
    severity: 'high',
    confidence: 0.95,
    threat_category: 'phishing',
    recommendations: ['Leave site immediately.'],
    factors: ['Actively blacklisted'],
    decision: {
      action: 'block',
      severity: 'high',
      ui: { color: 'rose' },
    },
  };

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    sessionStorageStore = {};

    chromeMock = {
      runtime: {
        onMessage: {
          addListener: vi.fn((fn) => {
            messageListener = fn;
          }),
        },
      },
      tabs: {
        query: vi.fn(),
        onRemoved: {
          addListener: vi.fn((fn) => {
            tabRemovedListener = fn;
          }),
        },
      },
      action: {
        setBadgeBackgroundColor: vi.fn(),
        setBadgeText: vi.fn(),
      },
      storage: {
        session: {
          get: vi.fn(async (key: string) => ({
            [key]: sessionStorageStore[key],
          })),
          set: vi.fn(async (items: Record<string, any>) => {
            Object.assign(sessionStorageStore, items);
          }),
          remove: vi.fn(async (key: string) => {
            delete sessionStorageStore[key];
          }),
        },
      },
    };

    Object.defineProperty(global, 'chrome', {
      value: chromeMock,
      writable: true,
      configurable: true,
    });

    // Import fresh background module with listeners registered
    await import('./index');
  });

  it('stores successful analysis in memory, persists to session storage, and updates badge', async () => {
    vi.mocked(submitAnalysis).mockResolvedValueOnce(sampleResponse);
    const sendResponse = vi.fn();

    const handled = messageListener(
      {
        type: 'ANALYZE_PAGE',
        payload: {
          url: 'https://example.com',
          title: 'Example',
          hostname: 'example.com',
          features: {} as any,
        },
      },
      { tab: { id: 101 } },
      sendResponse
    );

    expect(handled).toBe(true);

    // Allow promise chain to resolve
    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({
        status: 'SUCCESS',
        data: sampleResponse,
      });
    });

    // Verify session storage write
    expect(chromeMock.storage.session.set).toHaveBeenCalledWith({
      analysis_101: sampleResponse,
    });
    expect(sessionStorageStore['analysis_101']).toEqual(sampleResponse);

    // Verify badge updates
    expect(chromeMock.action.setBadgeBackgroundColor).toHaveBeenCalledWith({
      tabId: 101,
      color: '#10b981',
    });
    expect(chromeMock.action.setBadgeText).toHaveBeenCalledWith({
      tabId: 101,
      text: '95',
    });
  });

  it('restores stored result from session storage on cold-start GET_CURRENT_ANALYSIS', async () => {
    // Pre-populate session storage as if previous service worker ran
    sessionStorageStore['analysis_202'] = sampleResponse;

    // Simulate cold worker restart: re-import module with fresh memory
    vi.resetModules();
    await import('./index');

    chromeMock.tabs.query.mockImplementation((_opts: any, cb: (tabs: any[]) => void) => {
      cb([{ id: 202 }]);
    });

    const sendResponse = vi.fn();
    const handled = messageListener(
      { type: 'GET_CURRENT_ANALYSIS' },
      {},
      sendResponse
    );

    expect(handled).toBe(true);

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({
        status: 'SUCCESS',
        data: sampleResponse,
      });
    });

    expect(chromeMock.storage.session.get).toHaveBeenCalledWith('analysis_202');
  });

  it('returns PENDING when neither memory nor session storage contains an analysis', async () => {
    chromeMock.tabs.query.mockImplementation((_opts: any, cb: (tabs: any[]) => void) => {
      cb([{ id: 303 }]);
    });

    const sendResponse = vi.fn();
    messageListener({ type: 'GET_CURRENT_ANALYSIS' }, {}, sendResponse);

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({ status: 'PENDING' });
    });
  });

  it('clears memory and removes session storage entry when tab is closed', async () => {
    sessionStorageStore['analysis_404'] = sampleResponse;

    tabRemovedListener(404);

    expect(chromeMock.storage.session.remove).toHaveBeenCalledWith('analysis_404');
    expect(sessionStorageStore['analysis_404']).toBeUndefined();
  });

  it('prevents an older in-flight request from overwriting a newer analysis (stale request guard)', async () => {
    let resolveRequestA!: (res: PageAnalysisResponse) => void;
    let resolveRequestB!: (res: PageAnalysisResponse) => void;

    const promiseA = new Promise<PageAnalysisResponse>((res) => {
      resolveRequestA = res;
    });
    const promiseB = new Promise<PageAnalysisResponse>((res) => {
      resolveRequestB = res;
    });

    vi.mocked(submitAnalysis)
      .mockReturnValueOnce(promiseA)
      .mockReturnValueOnce(promiseB);

    const sendResponseA = vi.fn();
    const sendResponseB = vi.fn();

    // Request A starts for tab 505 (URL A)
    messageListener(
      {
        type: 'ANALYZE_PAGE',
        payload: {
          url: 'https://site-a.com',
          title: 'Site A',
          hostname: 'site-a.com',
          features: {} as any,
        },
      },
      { tab: { id: 505 } },
      sendResponseA
    );

    // Request B starts for same tab 505 (navigated to URL B)
    messageListener(
      {
        type: 'ANALYZE_PAGE',
        payload: {
          url: 'https://site-b.com',
          title: 'Site B',
          hostname: 'site-b.com',
          features: {} as any,
        },
      },
      { tab: { id: 505 } },
      sendResponseB
    );

    // Request B (newer) resolves first with threat response
    resolveRequestB(sampleThreatResponse);

    await vi.waitFor(() => {
      expect(sendResponseB).toHaveBeenCalledWith({
        status: 'SUCCESS',
        data: sampleThreatResponse,
      });
    });

    expect(sessionStorageStore['analysis_505']).toEqual(sampleThreatResponse);
    expect(chromeMock.action.setBadgeText).toHaveBeenCalledWith({
      tabId: 505,
      text: '20',
    });

    // Now Request A (older/stale) resolves
    resolveRequestA(sampleResponse);

    // Wait a tick
    await new Promise((r) => setTimeout(r, 10));

    // CRITICAL: Stored result must remain Request B's result, not overwritten by stale Request A
    expect(sessionStorageStore['analysis_505']).toEqual(sampleThreatResponse);
    // Badge should not have been updated to Request A
    expect(chromeMock.action.setBadgeText).not.toHaveBeenLastCalledWith({
      tabId: 505,
      text: '95',
    });
  });

  it('handles session storage write failures gracefully without unhandled rejection', async () => {
    chromeMock.storage.session.set.mockRejectedValueOnce(new Error('QuotaExceeded'));
    vi.mocked(submitAnalysis).mockResolvedValueOnce(sampleResponse);

    const sendResponse = vi.fn();
    messageListener(
      {
        type: 'ANALYZE_PAGE',
        payload: {
          url: 'https://example.com',
          title: 'Example',
          hostname: 'example.com',
          features: {} as any,
        },
      },
      { tab: { id: 606 } },
      sendResponse
    );

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({
        status: 'SUCCESS',
        data: sampleResponse,
      });
    });

    // Badge is still updated despite storage failure
    expect(chromeMock.action.setBadgeText).toHaveBeenCalledWith({
      tabId: 606,
      text: '95',
    });
  });

  it('returns ERROR when sender tab ID is missing', () => {
    const sendResponse = vi.fn();
    messageListener(
      {
        type: 'ANALYZE_PAGE',
        payload: {
          url: 'https://example.com',
          title: 'Example',
          hostname: 'example.com',
          features: {} as any,
        },
      },
      { tab: {} },
      sendResponse
    );

    expect(sendResponse).toHaveBeenCalledWith({
      status: 'ERROR',
      error: 'No tab ID',
    });
  });

  it('communicates ERROR and logs failure when analysis client fails', async () => {
    vi.mocked(submitAnalysis).mockRejectedValueOnce(new Error('Server unavailable'));
    const sendResponse = vi.fn();

    messageListener(
      {
        type: 'ANALYZE_PAGE',
        payload: {
          url: 'https://example.com',
          title: 'Example',
          hostname: 'example.com',
          features: {} as any,
        },
      },
      { tab: { id: 707 } },
      sendResponse
    );

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({
        status: 'ERROR',
        error: 'Server unavailable',
      });
    });
  });
});
