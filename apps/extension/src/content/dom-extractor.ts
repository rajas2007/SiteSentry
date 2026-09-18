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
