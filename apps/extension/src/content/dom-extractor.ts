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
  'confirm',
  'security',
  'wallet',
  'payment'
];

export function extractPageFeatures(): PageFeatures {
  // PRIVACY BOUNDARY: Do NOT collect entered text, passwords, or actual form data.
  // Extract structural metadata only.

  const forms = Array.from(document.querySelectorAll('form'));
  let hasPasswordField = false;
  let hasLoginForm = false;

  for (const form of forms) {
    const inputs = Array.from(form.querySelectorAll('input'));
    const hasPassword = inputs.some(i => i.type.toLowerCase() === 'password');
    if (hasPassword) hasPasswordField = true;
    
    // Simple heuristic for login form
    const hasUsername = inputs.some(i => 
      ['text', 'email'].includes(i.type.toLowerCase()) && 
      (i.name.toLowerCase().includes('user') || i.name.toLowerCase().includes('email') || i.id.toLowerCase().includes('user') || i.id.toLowerCase().includes('login'))
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
    subdomainCount
  };
}

export function extractPrivacyPolicyText(): string | null {
  // If the current URL is explicitly a privacy policy, extract the body
  if (
    window.location.href.toLowerCase().includes('privacy') ||
    window.location.pathname.toLowerCase().includes('policy')
  ) {
    const text = document.body.textContent || '';
    return text.substring(0, 4000);
  }

  // Otherwise, attempt to find a privacy policy section or link on the page
  const links = Array.from(document.querySelectorAll('a'));
  links.some(link => 
    link.textContent?.toLowerCase().includes('privacy') ||
    link.href.toLowerCase().includes('privacy')
  );

  // If there's a privacy policy section embedded in the page itself, find it
  // (e.g. some SPAs or modals have sections labeled 'privacy-policy')
  const privacyElement = document.querySelector('[id*="privacy" i], [class*="privacy" i]');
  if (privacyElement && privacyElement.textContent && privacyElement.textContent.length > 100) {
     return privacyElement.textContent.substring(0, 4000);
  }

  return null;
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
