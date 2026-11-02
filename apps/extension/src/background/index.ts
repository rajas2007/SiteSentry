import { ExtensionMessage, ExtensionMessageResponse, PageAnalysisResponse, PageAnalysisRequest } from '@site-sentry/shared-types';
import { submitAnalysis } from '../api/analysisClient';
import { WarningData } from '../types/warning';
import { sanitizeUrl } from '../utils/url';

export const storageKey = (tabId: number) => `analysis_${tabId}`;
export const warningKey = (id: string) => `warning_${id}`;

// L1 in-memory cache
export const analysisState = new Map<number, PageAnalysisResponse>();

// Request generation counter per tab to guard against out-of-order stale requests
export const tabGenerations = new Map<number, number>();

// Active warning IDs associated with tabs for prompt cleanup on tab close
export const tabWarnings = new Map<number, Set<string>>();

export function generateWarningId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'warn_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 11);
}

export async function handleBlockVerdict(
  tabId: number,
  payload: PageAnalysisRequest,
  data: PageAnalysisResponse,
  requestGen: number
): Promise<void> {
  // Navigation Race Protection: verify tab generation has not changed
  if (tabGenerations.get(tabId) !== requestGen) {
    return;
  }

  let createdWarningId: string | null = null;

  try {
    // Verify tab still exists, API is available, and URL can be verified
    if (!chrome.tabs?.get || !chrome.tabs?.update) {
      return;
    }

    const tab = await chrome.tabs.get(tabId);
    if (
      !tab ||
      !tab.url ||
      (tab.url !== payload.url && sanitizeUrl(tab.url) !== sanitizeUrl(payload.url))
    ) {
      // Tab closed, URL cannot be verified, or navigated away before analysis completed
      return;
    }

    const warningId = generateWarningId();
    createdWarningId = warningId;

    // Associate warning with tab for prompt cleanup on tab close
    if (!tabWarnings.has(tabId)) {
      tabWarnings.set(tabId, new Set());
    }
    tabWarnings.get(tabId)!.add(warningId);

    // Sanitize destination URL before persisting in warning session storage
    const sanitizedTarget = sanitizeUrl(payload.url) || payload.url;

    const warningData: WarningData = {
      warningId,
      targetUrl: sanitizedTarget,
      hostname: payload.hostname,
      score: data.score,
      severity: data.decision.severity,
      threatCategory: data.threat_category,
      factors: data.factors,
      recommendations: data.recommendations,
      timestamp: Date.now(),
    };

    // Transport analysis securely via session storage under opaque ID
    await chrome.storage.session.set({ [warningKey(warningId)]: warningData });

    // Final navigation race protection immediately before redirecting:
    // 1. Recheck generation
    if (tabGenerations.get(tabId) !== requestGen) {
      tabWarnings.get(tabId)?.delete(warningId);
      await chrome.storage.session.remove(warningKey(warningId)).catch(() => {});
      return;
    }

    // 2. Recheck tab existence and exact URL match
    const currentTab = await chrome.tabs.get(tabId);
    if (
      !currentTab ||
      !currentTab.url ||
      (currentTab.url !== payload.url && sanitizeUrl(currentTab.url) !== sanitizeUrl(payload.url))
    ) {
      tabWarnings.get(tabId)?.delete(warningId);
      await chrome.storage.session.remove(warningKey(warningId)).catch(() => {});
      return;
    }

    // 3. Final generation recheck
    if (tabGenerations.get(tabId) !== requestGen) {
      tabWarnings.get(tabId)?.delete(warningId);
      await chrome.storage.session.remove(warningKey(warningId)).catch(() => {});
      return;
    }

    const warningUrl = chrome.runtime.getURL(`pages/warning.html?id=${encodeURIComponent(warningId)}`);
    await chrome.tabs.update(tabId, { url: warningUrl });
  } catch (error) {
    if (createdWarningId) {
      tabWarnings.get(tabId)?.delete(createdWarningId);
      chrome.storage.session.remove(warningKey(createdWarningId)).catch(() => {});
    }
    console.warn(`[Site Sentry] Failed to redirect tab ${tabId} to warning page:`, error);
  }
}

chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  if (message.type === 'ANALYZE_PAGE') {
    const tabId = sender.tab?.id;
    if (!tabId) {
      sendResponse({ status: 'ERROR', error: 'No tab ID' } as ExtensionMessageResponse);
      return;
    }

    const requestGen = (tabGenerations.get(tabId) || 0) + 1;
    tabGenerations.set(tabId, requestGen);

    // Process asynchronously
    submitAnalysis(message.payload)
      .then(async (data) => {
        // Stale request guard: if a newer analysis request started for this tab, discard
        if (tabGenerations.get(tabId) !== requestGen) {
          sendResponse({ status: 'SUCCESS', data } as ExtensionMessageResponse);
          return;
        }

        analysisState.set(tabId, data);

        try {
          await chrome.storage.session.set({ [storageKey(tabId)]: data });
        } catch (storageError) {
          console.warn(`[Site Sentry] Failed to persist analysis to session storage for tab ${tabId}:`, storageError);
        }

        sendResponse({ status: 'SUCCESS', data } as ExtensionMessageResponse);

        // Update badge based on severity
        let color = '#94a3b8'; // slate
        if (data.decision.severity === 'high') color = '#e11d48'; // rose
        else if (data.decision.severity === 'medium') color = '#d97706'; // amber
        else if (data.decision.severity === 'low') color = '#10b981'; // emerald

        chrome.action.setBadgeBackgroundColor({ tabId, color });
        const badgeText = data.threat_category === 'inconclusive' ? '?' : data.score.toString();
        chrome.action.setBadgeText({ tabId, text: badgeText });

        // ADR-005: Redirect to extension-origin warning page ONLY on action === 'block'
        if (data.decision?.action === 'block') {
          await handleBlockVerdict(tabId, message.payload, data, requestGen);
        }
      })
      .catch((error) => {
        if (tabGenerations.get(tabId) !== requestGen) {
          return;
        }
        // Sanitized warning log without dumping error object containing raw URLs or secrets
        console.warn(`[Site Sentry] Analysis request failed for tab ${tabId}`);

        // On backend error: set badge background slate and text '!'
        try {
          chrome.action.setBadgeBackgroundColor({ tabId, color: '#94a3b8' });
          chrome.action.setBadgeText({ tabId, text: '!' });
        } catch (badgeErr) {
          console.warn(`[Site Sentry] Failed to set error badge for tab ${tabId}:`, badgeErr);
        }

        sendResponse({ status: 'ERROR', error: error?.message || 'Unknown error' } as ExtensionMessageResponse);
      });

    return true; // Keep message channel open for async response
  }

  if (message.type === 'GET_CURRENT_ANALYSIS') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tabId = tabs[0]?.id;
      if (!tabId) {
        sendResponse({ status: 'PENDING' } as ExtensionMessageResponse);
        return;
      }

      // Check L1 in-memory cache first
      if (analysisState.has(tabId)) {
        sendResponse({ status: 'SUCCESS', data: analysisState.get(tabId) } as ExtensionMessageResponse);
        return;
      }

      // Fallback to L2 session storage (survives service worker suspension)
      try {
        const key = storageKey(tabId);
        const stored = await chrome.storage.session.get(key);
        const data = stored?.[key] as PageAnalysisResponse | undefined;
        if (data) {
          analysisState.set(tabId, data);
          sendResponse({ status: 'SUCCESS', data } as ExtensionMessageResponse);
          return;
        }
      } catch (storageError) {
        console.warn(`[Site Sentry] Failed to read analysis from session storage for tab ${tabId}:`, storageError);
      }

      sendResponse({ status: 'PENDING' } as ExtensionMessageResponse);
    });
    return true; // Keep channel open
  }
});

// Clean up state when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  tabGenerations.delete(tabId);
  analysisState.delete(tabId);

  // 1. Remove analysis_${tabId}
  chrome.storage.session.remove(storageKey(tabId)).catch((error) => {
    console.warn(`[Site Sentry] Failed to clean up session storage for tab ${tabId}:`, error);
  });

  // 2. Remove associated warning_${warningId} entries
  const associatedWarnings = tabWarnings.get(tabId);
  if (associatedWarnings) {
    for (const wId of associatedWarnings) {
      chrome.storage.session.remove(warningKey(wId)).catch(() => {});
    }
    tabWarnings.delete(tabId);
  }
});
