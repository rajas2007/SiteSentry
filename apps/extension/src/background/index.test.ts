import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import {
  ExtensionMessage,
  ExtensionMessageResponse,
  PageAnalysisResponse,
  PageFeatures,
} from '@site-sentry/shared-types';
import { submitAnalysis } from '../api/analysisClient';
import { WarningData } from '../types/warning';

vi.mock('../api/analysisClient', () => ({
  submitAnalysis: vi.fn(),
}));

interface ChromeMock {
  runtime: {
    onMessage: {
      addListener: Mock;
    };
    getURL: Mock;
  };
  tabs: {
    query: Mock;
    get: Mock;
    update: Mock;
    onRemoved: {
      addListener: Mock;
    };
  };
  action: {
    setBadgeBackgroundColor: Mock;
    setBadgeText: Mock;
  };
  storage: {
    session: {
      get: Mock;
      set: Mock;
      remove: Mock;
    };
  };
}

const dummyFeatures: PageFeatures = {
  hasPasswordField: false,
  hasLoginForm: false,
  formCount: 0,
  externalLinkCount: 0,
  iframeCount: 0,
  scriptCount: 0,
  imageCount: 0,
  suspiciousKeywords: [],
  pageTextLength: 0,
  hasHttps: true,
  hostnameLength: 10,
  subdomainCount: 0,
};

describe('Background Service Worker Persistence and ADR-005 Warnings', () => {
  let messageListener: (
    message: ExtensionMessage,
    sender: { tab?: { id?: number } },
    sendResponse: (res: ExtensionMessageResponse) => void
  ) => boolean | void;

  let tabRemovedListener: (tabId: number) => void;
  let sessionStorageStore: Record<string, unknown>;
  let chromeMock: ChromeMock;

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

  const sampleWarnResponse: PageAnalysisResponse = {
    analysis_id: 'warn-123',
    score: 65,
    severity: 'medium',
    confidence: 0.7,
    threat_category: 'suspicious',
    recommendations: ['Exercise caution.'],
    factors: ['Suspicious domain patterns'],
    decision: {
      action: 'warn',
      severity: 'medium',
      ui: { color: 'amber' },
    },
  };

  const sampleThreatResponse: PageAnalysisResponse = {
    analysis_id: 'threat-456',
    score: 20,
    severity: 'high',
    confidence: 0.95,
    threat_category: 'phishing',
    recommendations: ['Leave site immediately.'],
    factors: ['Actively blacklisted domain'],
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
        getURL: vi.fn((path: string) => `chrome-extension://test-extension-id/${path}`),
      },
      tabs: {
        query: vi.fn(),
        get: vi.fn(async (tabId: number) => ({ id: tabId, url: 'https://threat-site.com/login' })),
        update: vi.fn(async () => ({})),
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
          set: vi.fn(async (items: Record<string, unknown>) => {
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
          features: dummyFeatures,
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

    // Non-blocking verdict must NOT redirect tab
    expect(chromeMock.tabs.update).not.toHaveBeenCalled();
  });

  it('restores stored result from session storage on cold-start GET_CURRENT_ANALYSIS', async () => {
    sessionStorageStore['analysis_202'] = sampleResponse;

    vi.resetModules();
    await import('./index');

    chromeMock.tabs.query.mockImplementation((_opts: unknown, cb: (tabs: Array<{ id?: number }>) => void) => {
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
    chromeMock.tabs.query.mockImplementation((_opts: unknown, cb: (tabs: Array<{ id?: number }>) => void) => {
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
          features: dummyFeatures,
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
          features: dummyFeatures,
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

    await new Promise((r) => setTimeout(r, 10));

    // Stored result must remain Request B's result, not overwritten by stale Request A
    expect(sessionStorageStore['analysis_505']).toEqual(sampleThreatResponse);
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
          features: dummyFeatures,
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
          features: dummyFeatures,
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

  it('sets error badge and communicates ERROR when analysis client fails', async () => {
    vi.mocked(submitAnalysis).mockRejectedValueOnce(new Error('Server unavailable'));
    const sendResponse = vi.fn();

    messageListener(
      {
        type: 'ANALYZE_PAGE',
        payload: {
          url: 'https://example.com',
          title: 'Example',
          hostname: 'example.com',
          features: dummyFeatures,
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

    // Badge indicates backend error
    expect(chromeMock.action.setBadgeBackgroundColor).toHaveBeenCalledWith({
      tabId: 707,
      color: '#94a3b8',
    });
    expect(chromeMock.action.setBadgeText).toHaveBeenCalledWith({
      tabId: 707,
      text: '!',
    });

    // Backend error must NOT redirect tab
    expect(chromeMock.tabs.update).not.toHaveBeenCalled();
  });

  it('sets amber badge and ? text for inconclusive verdicts without redirecting', async () => {
    const inconclusiveResponse: PageAnalysisResponse = {
      analysis_id: 'inconclusive-123',
      score: 100,
      severity: 'medium',
      confidence: 0.5,
      threat_category: 'inconclusive',
      recommendations: ['Threat intelligence checks could not be completed; exercise caution on this site.'],
      factors: ['Threat intelligence data is incomplete or unavailable'],
      decision: {
        action: 'warn',
        severity: 'medium',
        ui: { color: 'amber' },
      },
    };

    vi.mocked(submitAnalysis).mockResolvedValueOnce(inconclusiveResponse);
    const sendResponse = vi.fn();

    messageListener(
      {
        type: 'ANALYZE_PAGE',
        payload: {
          url: 'https://inconclusive.example.com',
          title: 'Inconclusive',
          hostname: 'inconclusive.example.com',
          features: dummyFeatures,
        },
      },
      { tab: { id: 808 } },
      sendResponse
    );

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({
        status: 'SUCCESS',
        data: inconclusiveResponse,
      });
    });

    expect(chromeMock.action.setBadgeBackgroundColor).toHaveBeenCalledWith({
      tabId: 808,
      color: '#d97706',
    });
    expect(chromeMock.action.setBadgeText).toHaveBeenCalledWith({
      tabId: 808,
      text: '?',
    });

    // Inconclusive must NOT redirect tab
    expect(chromeMock.tabs.update).not.toHaveBeenCalled();
  });

  it('does NOT redirect tab for action === "warn"', async () => {
    vi.mocked(submitAnalysis).mockResolvedValueOnce(sampleWarnResponse);
    const sendResponse = vi.fn();

    messageListener(
      {
        type: 'ANALYZE_PAGE',
        payload: {
          url: 'https://suspicious.example.com',
          title: 'Suspicious',
          hostname: 'suspicious.example.com',
          features: dummyFeatures,
        },
      },
      { tab: { id: 909 } },
      sendResponse
    );

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({
        status: 'SUCCESS',
        data: sampleWarnResponse,
      });
    });

    expect(chromeMock.tabs.update).not.toHaveBeenCalled();
  });

  describe('ADR-005 Action === "block" Redirection and Safe Transport', () => {
    it('redirects to warning page with opaque ID only and stores WarningData in session storage', async () => {
      vi.mocked(submitAnalysis).mockResolvedValueOnce(sampleThreatResponse);
      chromeMock.tabs.get.mockResolvedValue({
        id: 1001,
        url: 'https://threat-site.com/login?token=secret123',
      });

      const sendResponse = vi.fn();
      messageListener(
        {
          type: 'ANALYZE_PAGE',
          payload: {
            url: 'https://threat-site.com/login?token=secret123',
            title: 'Malicious Login',
            hostname: 'threat-site.com',
            features: dummyFeatures,
          },
        },
        { tab: { id: 1001 } },
        sendResponse
      );

      await vi.waitFor(() => {
        expect(chromeMock.tabs.update).toHaveBeenCalled();
      });

      // Verify update call arguments
      const updateCall = chromeMock.tabs.update.mock.calls[0];
      expect(updateCall[0]).toBe(1001);
      const redirectUrl: string = updateCall[1].url;

      // CRITICAL: URL must NOT contain original destination URL or sensitive tokens
      expect(redirectUrl).toContain('pages/warning.html?id=');
      expect(redirectUrl).not.toContain('https://threat-site.com');
      expect(redirectUrl).not.toContain('secret123');

      // Extract opaque ID from query string
      const warningId = new URL(redirectUrl).searchParams.get('id');
      expect(warningId).toBeTruthy();

      // Verify WarningData is stored in session storage under warning_<opaqueId>
      const storedWarning = sessionStorageStore[`warning_${warningId}`] as WarningData;
      expect(storedWarning).toBeDefined();
      expect(storedWarning.warningId).toBe(warningId);
      expect(storedWarning.targetUrl).toBe('https://threat-site.com/login?token=secret123');
      expect(storedWarning.hostname).toBe('threat-site.com');
      expect(storedWarning.score).toBe(20);
      expect(storedWarning.severity).toBe('high');
      expect(storedWarning.threatCategory).toBe('phishing');
      expect(storedWarning.factors).toEqual(['Actively blacklisted domain']);
    });

    it('aborts redirect if tab navigated to a different URL before block verdict completes', async () => {
      vi.mocked(submitAnalysis).mockResolvedValueOnce(sampleThreatResponse);
      // Simulate that user already navigated to a different URL
      chromeMock.tabs.get.mockResolvedValueOnce({
        id: 1002,
        url: 'https://different-site.com',
      });

      const sendResponse = vi.fn();
      messageListener(
        {
          type: 'ANALYZE_PAGE',
          payload: {
            url: 'https://original-threat-site.com',
            title: 'Threat',
            hostname: 'original-threat-site.com',
            features: dummyFeatures,
          },
        },
        { tab: { id: 1002 } },
        sendResponse
      );

      await vi.waitFor(() => {
        expect(sendResponse).toHaveBeenCalled();
      });

      // Redirection should have been aborted due to URL mismatch
      expect(chromeMock.tabs.update).not.toHaveBeenCalled();
    });

    it('aborts redirect if a newer analysis request started for the tab before block verdict completes', async () => {
      let resolveFirst!: (res: PageAnalysisResponse) => void;
      const promiseFirst = new Promise<PageAnalysisResponse>((res) => {
        resolveFirst = res;
      });

      vi.mocked(submitAnalysis).mockReturnValueOnce(promiseFirst);

      const sendResponse1 = vi.fn();
      const sendResponse2 = vi.fn();

      // First request (Threat) starts
      messageListener(
        {
          type: 'ANALYZE_PAGE',
          payload: {
            url: 'https://first-threat.com',
            title: 'First Threat',
            hostname: 'first-threat.com',
            features: dummyFeatures,
          },
        },
        { tab: { id: 1003 } },
        sendResponse1
      );

      // User navigates and a second request starts on same tab before first finishes
      vi.mocked(submitAnalysis).mockResolvedValueOnce(sampleResponse);
      messageListener(
        {
          type: 'ANALYZE_PAGE',
          payload: {
            url: 'https://safe-next-site.com',
            title: 'Safe Site',
            hostname: 'safe-next-site.com',
            features: dummyFeatures,
          },
        },
        { tab: { id: 1003 } },
        sendResponse2
      );

      // Now first request resolves with BLOCK
      resolveFirst(sampleThreatResponse);

      await vi.waitFor(() => {
        expect(sendResponse2).toHaveBeenCalled();
      });

      // Redirection must NOT occur because tab generation advanced
      expect(chromeMock.tabs.update).not.toHaveBeenCalled();
    });

    it('aborts redirect and cleans up warning record if tab URL cannot be verified', async () => {
      vi.mocked(submitAnalysis).mockResolvedValueOnce(sampleThreatResponse);
      // Simulate tab with undefined/missing URL (cannot be verified)
      chromeMock.tabs.get.mockResolvedValueOnce({
        id: 1004,
        url: undefined,
      });

      const sendResponse = vi.fn();
      messageListener(
        {
          type: 'ANALYZE_PAGE',
          payload: {
            url: 'https://threat-site.com/unverifiable',
            title: 'Threat',
            hostname: 'threat-site.com',
            features: dummyFeatures,
          },
        },
        { tab: { id: 1004 } },
        sendResponse
      );

      await vi.waitFor(() => {
        expect(sendResponse).toHaveBeenCalled();
      });

      // Must abort redirect
      expect(chromeMock.tabs.update).not.toHaveBeenCalled();
      // Must not leave orphaned warning record in session storage
      const warningKeys = Object.keys(sessionStorageStore).filter((k) => k.startsWith('warning_'));
      expect(warningKeys.length).toBe(0);
    });

    it('aborts redirect and cleans up warning record if tab URL changes immediately before redirection (after storage write)', async () => {
      vi.mocked(submitAnalysis).mockResolvedValueOnce(sampleThreatResponse);
      // First lookup succeeds with matching URL, but second lookup (right before redirection) detects navigation to a different URL
      chromeMock.tabs.get
        .mockResolvedValueOnce({
          id: 1005,
          url: 'https://threat-site.com/initial',
        })
        .mockResolvedValueOnce({
          id: 1005,
          url: 'https://safe-search-engine.com',
        });

      const sendResponse = vi.fn();
      messageListener(
        {
          type: 'ANALYZE_PAGE',
          payload: {
            url: 'https://threat-site.com/initial',
            title: 'Threat',
            hostname: 'threat-site.com',
            features: dummyFeatures,
          },
        },
        { tab: { id: 1005 } },
        sendResponse
      );

      await vi.waitFor(() => {
        expect(sendResponse).toHaveBeenCalled();
      });

      // Redirection must be aborted
      expect(chromeMock.tabs.update).not.toHaveBeenCalled();
      // Storage entry must be cleaned up
      const warningKeys = Object.keys(sessionStorageStore).filter((k) => k.startsWith('warning_'));
      expect(warningKeys.length).toBe(0);
    });

    it('handles tab lookup/update failures safely without unhandled exceptions', async () => {
      vi.mocked(submitAnalysis).mockResolvedValueOnce(sampleThreatResponse);
      // Simulate tab closed during async processing, causing chrome.tabs.get to throw
      chromeMock.tabs.get.mockRejectedValueOnce(new Error('No tab with id: 1006'));

      const sendResponse = vi.fn();
      messageListener(
        {
          type: 'ANALYZE_PAGE',
          payload: {
            url: 'https://threat-site.com/closed',
            title: 'Threat',
            hostname: 'threat-site.com',
            features: dummyFeatures,
          },
        },
        { tab: { id: 1006 } },
        sendResponse
      );

      await vi.waitFor(() => {
        expect(sendResponse).toHaveBeenCalled();
      });

      // No redirection attempted, handled safely
      expect(chromeMock.tabs.update).not.toHaveBeenCalled();
    });

    it('aborts redirect and cleans up warning record when tab closes before second lookup (second lookup rejects)', async () => {
      vi.mocked(submitAnalysis).mockResolvedValueOnce(sampleThreatResponse);

      // Exact sequence:
      // 1. First chrome.tabs.get() succeeds with original blocked URL
      // 2. Session storage write succeeds
      // 3. Tab closes before second chrome.tabs.get()
      // 4. Second lookup rejects
      chromeMock.tabs.get
        .mockResolvedValueOnce({
          id: 1007,
          url: 'https://threat-site.com/closing-reject',
        })
        .mockRejectedValueOnce(new Error('No tab with id: 1007'));

      const sendResponse = vi.fn();
      messageListener(
        {
          type: 'ANALYZE_PAGE',
          payload: {
            url: 'https://threat-site.com/closing-reject',
            title: 'Threat Closing',
            hostname: 'threat-site.com',
            features: dummyFeatures,
          },
        },
        { tab: { id: 1007 } },
        sendResponse
      );

      await vi.waitFor(() => {
        expect(sendResponse).toHaveBeenCalled();
      });

      // No redirect occurs
      expect(chromeMock.tabs.update).not.toHaveBeenCalled();

      // Warning storage record is cleaned up
      const warningKeys = Object.keys(sessionStorageStore).filter((k) => k.startsWith('warning_'));
      expect(warningKeys.length).toBe(0);
    });

    it('aborts redirect and cleans up warning record when tab closes before second lookup (second lookup returns no tab)', async () => {
      vi.mocked(submitAnalysis).mockResolvedValueOnce(sampleThreatResponse);

      // Exact sequence:
      // 1. First chrome.tabs.get() succeeds with original blocked URL
      // 2. Session storage write succeeds
      // 3. Tab closes before second chrome.tabs.get()
      // 4. Second lookup returns undefined (no tab)
      chromeMock.tabs.get
        .mockResolvedValueOnce({
          id: 1008,
          url: 'https://threat-site.com/closing-notab',
        })
        .mockResolvedValueOnce(undefined);

      const sendResponse = vi.fn();
      messageListener(
        {
          type: 'ANALYZE_PAGE',
          payload: {
            url: 'https://threat-site.com/closing-notab',
            title: 'Threat No Tab',
            hostname: 'threat-site.com',
            features: dummyFeatures,
          },
        },
        { tab: { id: 1008 } },
        sendResponse
      );

      await vi.waitFor(() => {
        expect(sendResponse).toHaveBeenCalled();
      });

      // No redirect occurs
      expect(chromeMock.tabs.update).not.toHaveBeenCalled();

      // Warning storage record is cleaned up
      const warningKeys = Object.keys(sessionStorageStore).filter((k) => k.startsWith('warning_'));
      expect(warningKeys.length).toBe(0);
    });
  });
});
