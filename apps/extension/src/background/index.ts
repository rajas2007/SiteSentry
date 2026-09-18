import { ExtensionMessage, ExtensionMessageResponse, PageAnalysisResponse } from '@site-sentry/shared-types';
import { submitAnalysis } from '../api/analysisClient';

// Minimal in-memory store for the MVP
const analysisState = new Map<number, PageAnalysisResponse>();

chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  if (message.type === 'ANALYZE_PAGE') {
    const tabId = sender.tab?.id;
    if (!tabId) {
      sendResponse({ status: 'ERROR', error: 'No tab ID' } as ExtensionMessageResponse);
      return;
    }

    // Process asynchronously
    submitAnalysis(message.payload)
      .then((data) => {
        analysisState.set(tabId, data);
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
        console.error('Analysis failed:', error);
        sendResponse({ status: 'ERROR', error: error.message } as ExtensionMessageResponse);
      });

    return true; // Keep message channel open for async response
  }

  if (message.type === 'GET_CURRENT_ANALYSIS') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (tabId && analysisState.has(tabId)) {
        sendResponse({ status: 'SUCCESS', data: analysisState.get(tabId) } as ExtensionMessageResponse);
      } else {
        sendResponse({ status: 'PENDING' } as ExtensionMessageResponse);
      }
    });
    return true; // Keep channel open
  }
});

// Clean up state when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  analysisState.delete(tabId);
});
