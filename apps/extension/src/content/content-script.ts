import { extractPageFeatures, extractPrivacyPolicyText, getThirdPartyCookieCount } from './dom-extractor';
import { PageAnalysisRequest, ExtensionMessage } from '@site-sentry/shared-types';
import { sanitizeUrl } from './url-sanitizer';

export async function analyzeCurrentPage(): Promise<void> {
  // Scheme restriction: strictly restrict execution to HTTP and HTTPS protocols
  if (
    typeof window === 'undefined' ||
    (window.location.protocol !== 'http:' && window.location.protocol !== 'https:')
  ) {
    return;
  }

  // Client-side URL sanitization: strip credentials, fragments, and sensitive parameters
  const sanitizedUrl = sanitizeUrl(window.location.href);
  if (!sanitizedUrl) {
    return;
  }

  const request: PageAnalysisRequest = {
    url: sanitizedUrl,
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
    await chrome.runtime.sendMessage(message);
  } catch {
    // Sanitized error logging: do not expose raw URLs, tokens, or response payloads
    console.warn('[Site Sentry] Failed to dispatch page analysis message.');
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

// SPA navigation observer (read-only polling with sanitized URL tracking)
let currentUrl =
  typeof window !== 'undefined'
    ? sanitizeUrl(window.location.href) || ''
    : '';

if (typeof window !== 'undefined') {
  setInterval(() => {
    if (
      window.location.protocol !== 'http:' &&
      window.location.protocol !== 'https:'
    ) {
      return;
    }
    const newSanitizedUrl = sanitizeUrl(window.location.href) || '';
    if (newSanitizedUrl && newSanitizedUrl !== currentUrl) {
      currentUrl = newSanitizedUrl;
      analyzeCurrentPage();
    }
  }, 1000);
}
