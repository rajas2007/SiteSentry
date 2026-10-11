import { ExtensionMessage, ExtensionMessageResponse, PageAnalysisResponse } from '@site-sentry/shared-types';
import { submitAnalysis } from '../api/analysisClient';

export const storageKey = (tabId: number) => `analysis_${tabId}`;

// L1 in-memory cache
export const analysisState = new Map<number, PageAnalysisResponse>();

// Request generation counter per tab to guard against out-of-order stale requests
export const tabGenerations = new Map<number, number>();

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
        chrome.action.setBadgeText({ tabId, text: data.score.toString() });
      })
      .catch((error) => {
        if (tabGenerations.get(tabId) !== requestGen) {
          return;
        }
        console.error('Analysis failed:', error);
        sendResponse({ status: 'ERROR', error: error.message } as ExtensionMessageResponse);
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
  chrome.storage.session.remove(storageKey(tabId)).catch((error) => {
    console.warn(`[Site Sentry] Failed to clean up session storage for tab ${tabId}:`, error);
  });
});
