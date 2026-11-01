import { extractPageFeatures, extractPrivacyPolicyText, getThirdPartyCookieCount } from './dom-extractor';
import { PageAnalysisRequest, ExtensionMessage, ExtensionMessageResponse } from '@site-sentry/shared-types';

export async function analyzeCurrentPage(): Promise<void> {
  const request: PageAnalysisRequest = {
    url: window.location.href,
    title: document.title,
    hostname: window.location.hostname,
    features: extractPageFeatures(),
    privacy_policy_text: extractPrivacyPolicyText(),
    third_party_cookie_count: getThirdPartyCookieCount(),
  };

  const message: ExtensionMessage = {
    type: 'ANALYZE_PAGE',
    payload: request,
  };

  try {
    const response = await chrome.runtime.sendMessage(message) as ExtensionMessageResponse;
    console.log('[Site Sentry] Analysis response:', response);
  } catch (error) {
    console.error('[Site Sentry] Failed to send analysis message:', error);
  }
}

// Wait until the DOM is sufficiently loaded to extract features
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      analyzeCurrentPage();
    });
  } else {
    analyzeCurrentPage();
  }
}

// SPA navigation observer (read-only polling)
let currentUrl = typeof window !== 'undefined' ? window.location.href : '';
if (typeof window !== 'undefined') {
  setInterval(() => {
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href;
      analyzeCurrentPage();
    }
  }, 1000);
}
