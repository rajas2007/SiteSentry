import { PageFeatures } from '@site-sentry/shared-types';

const SUSPICIOUS_KEYWORDS = [
  'verify',
  'verification',
  'login',
  'sign in',
  'password',
  'account',
  'urgent',
  'suspended',
  'locked',
  'unauthorized',
  'compromised',
  'deactivation',
  'terminate',
  'action required',
  'immediate',
  'confirm',
  'security',
  'wallet',
  'payment',
];

/**
 * Regex matching canonical, dedicated privacy policy path structures.
 * Never inspects query strings or full hrefs to prevent query-parameter-based triggers.
 */
export const CANONICAL_PRIVACY_PATH_RE =
  /^\/(?:(?:legal|about|terms|policies|company)\/)?(?:privacy(?:[-_]policy)?|privacy-notice|data-privacy)(?:\.(?:html|php|htm|asp|aspx))?\/?$/i;

export function isCanonicalPrivacyPath(pathname: string): boolean {
  if (!pathname || typeof pathname !== 'string') return false;
  return CANONICAL_PRIVACY_PATH_RE.test(pathname.trim());
}

export function extractPageFeatures(): PageFeatures {
  // PRIVACY BOUNDARY: Do NOT collect entered text, passwords, or actual form data.
  // Extract structural metadata only.

  const forms = Array.from(document.querySelectorAll('form'));
  let hasPasswordField = false;
  let hasLoginForm = false;

  for (const form of forms) {
    const inputs = Array.from(form.querySelectorAll('input'));
    const hasPassword = inputs.some((i) => i.type.toLowerCase() === 'password');
    if (hasPassword) hasPasswordField = true;

    // Simple heuristic for login form
    const hasUsername = inputs.some(
      (i) =>
        ['text', 'email'].includes(i.type.toLowerCase()) &&
        (i.name.toLowerCase().includes('user') ||
          i.name.toLowerCase().includes('email') ||
          i.id.toLowerCase().includes('user') ||
          i.id.toLowerCase().includes('login'))
    );

    if (hasPassword && hasUsername) {
      hasLoginForm = true;
    }
  }

  // Count links
  const links = Array.from(document.querySelectorAll('a'));
  let externalLinkCount = 0;
  const currentHostname = window.location.hostname;
  for (const link of links) {
    try {
      const url = new URL(link.href);
      if (url.hostname && url.hostname !== currentHostname) {
        externalLinkCount++;
      }
    } catch {
      // Invalid URL
    }
  }

  // Count text indicators
  const pageText = (document.body.textContent || '').toLowerCase();
  const suspiciousKeywordsDetected: string[] = [];

  for (const keyword of SUSPICIOUS_KEYWORDS) {
    if (pageText.includes(keyword)) {
      suspiciousKeywordsDetected.push(keyword);
    }
  }

  // Hostname heuristics
  const parts = currentHostname.split('.');
  const subdomainCount = parts.length > 2 ? parts.length - 2 : 0; // Exclude domain.com

  return {
    hasPasswordField,
    hasLoginForm,
    formCount: forms.length,
    externalLinkCount,
    iframeCount: document.querySelectorAll('iframe').length,
    scriptCount: document.querySelectorAll('script').length,
    imageCount: document.querySelectorAll('img').length,
    suspiciousKeywords: suspiciousKeywordsDetected,
    pageTextLength: pageText.length,
    hasHttps: window.location.protocol === 'https:',
    hostnameLength: currentHostname.length,
    subdomainCount,
  };
}

export function extractPrivacyPolicyText(): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return '';
  }

  const pathname = window.location.pathname || '';
  const isPolicyPath = isCanonicalPrivacyPath(pathname);

  // 1. Prefer designated static privacy policy container elements
  const privacyElement = document.querySelector(
    '[id*="privacy-policy" i], [class*="privacy-policy" i], [id*="privacy-notice" i], [class*="privacy-notice" i], [id*="privacy" i], [class*="privacy" i]'
  );
  if (
    privacyElement &&
    privacyElement.textContent &&
    privacyElement.textContent.trim().length > 100
  ) {
    return privacyElement.textContent.trim().substring(0, 4000);
  }

  // 2. If on an explicit canonical privacy policy URL path, extract content
  if (isPolicyPath) {
    const mainElement = document.querySelector('main, article');
    if (mainElement && mainElement.textContent && mainElement.textContent.trim()) {
      return mainElement.textContent.trim().substring(0, 4000);
    }

    const bodyText = (document.body.textContent || '').trim();
    if (bodyText) {
      return bodyText.substring(0, 4000);
    }
  }

  // 3. Fallback: if no safe privacy policy element can be identified, return empty string
  return '';
}

export function getThirdPartyCookieCount(): number | undefined {
  // We cannot reliably determine third-party cookies from a content script
  // securely without extensive permissions (chrome.cookies) which would require
  // host permissions for all domains.
  //
  // Returning undefined to explicitly state we don't know, rather than fake 0.
  // The API contract only supports integer/null/undefined.
  return undefined;
}
