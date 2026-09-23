import { extractPageFeatures, extractPrivacyPolicyText, getThirdPartyCookieCount } from './dom-extractor';
import { PageAnalysisRequest, ExtensionMessage, ExtensionMessageResponse } from '@site-sentry/shared-types';
import { WarningOverlay } from './warning-overlay';
import { applyCredentialIntervention } from './credential-intervention';

const overlay = new WarningOverlay();
let restoreCredFn: (() => void) | null = null;

async function analyzeCurrentPage() {
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
    
    if (response.status === 'SUCCESS' && response.data.severity === 'high') {
      overlay.show(response.data, () => {
        // Restore password inputs on continue
        if (restoreCredFn) restoreCredFn();
      });
    }
    
    // Credential Theft Intervention
    if (response.status === 'SUCCESS') {
      restoreCredFn = applyCredentialIntervention(response.data);
    }
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

// Simple SPA navigation handler
let currentUrl = window.location.href;
setInterval(() => {
  if (window.location.href !== currentUrl) {
    currentUrl = window.location.href;
    overlay.dismiss();
    analyzeCurrentPage();
  }
}, 1000);
