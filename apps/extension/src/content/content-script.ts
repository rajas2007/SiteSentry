import { extractPageFeatures } from './dom-extractor';
import { PageAnalysisRequest, ExtensionMessage, ExtensionMessageResponse } from '@site-sentry/shared-types';

async function analyzeCurrentPage() {
  const request: PageAnalysisRequest = {
    url: window.location.href,
    title: document.title,
    hostname: window.location.hostname,
    features: extractPageFeatures(),
  };

  const message: ExtensionMessage = {
    type: 'ANALYZE_PAGE',
    payload: request,
  };

  try {
    const response = await chrome.runtime.sendMessage(message) as ExtensionMessageResponse;
    console.log('[Site Sentry] Analysis response:', response);
    // In a future MVP, we could trigger a DOM warning-overlay here if HIGH risk
  } catch (error) {
    console.error('[Site Sentry] Failed to send analysis message:', error);
  }
}

// Simple heuristic: wait until the DOM is sufficiently loaded to extract features
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', analyzeCurrentPage);
} else {
  analyzeCurrentPage();
}
