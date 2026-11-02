import { describe, it, expect, beforeEach } from 'vitest';
import {
  extractPageFeatures,
  extractPrivacyPolicyText,
  getThirdPartyCookieCount,
  isCanonicalPrivacyPath,
} from './dom-extractor';

describe('DOM Extractor', () => {
  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '';
    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: {
        href: 'https://example.com',
        hostname: 'example.com',
        protocol: 'https:',
        pathname: '/',
      },
      writable: true,
    });
  });

  it('should extract basic metadata correctly', () => {
    document.body.innerHTML = '<p>Welcome to the safe page.</p>';
    const features = extractPageFeatures();

    expect(features.hasHttps).toBe(true);
    expect(features.hostnameLength).toBe(11); // example.com
    expect(features.subdomainCount).toBe(0);
    expect(features.suspiciousKeywords.length).toBe(0);
  });

  it('should detect password fields and forms', () => {
    document.body.innerHTML = `
      <form>
        <input type="text" name="username" />
        <input type="password" name="pwd" />
      </form>
    `;

    const features = extractPageFeatures();
    expect(features.formCount).toBe(1);
    expect(features.hasPasswordField).toBe(true);
    expect(features.hasLoginForm).toBe(true); // Because username text + password
  });

  it('should detect suspicious keywords', () => {
    document.body.innerHTML = '<p>Please verify your account password urgently.</p>';
    const features = extractPageFeatures();

    expect(features.suspiciousKeywords).toContain('verify');
    expect(features.suspiciousKeywords).toContain('account');
    expect(features.suspiciousKeywords).toContain('password');
    expect(features.suspiciousKeywords).toContain('urgent');
  });
});

describe('Privacy Extractor', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    Object.defineProperty(window, 'location', {
      value: {
        href: 'https://example.com',
        hostname: 'example.com',
        protocol: 'https:',
        pathname: '/',
        search: '',
      },
      writable: true,
    });
  });

  it('identifies canonical privacy policy paths correctly', () => {
    expect(isCanonicalPrivacyPath('/privacy')).toBe(true);
    expect(isCanonicalPrivacyPath('/privacy/')).toBe(true);
    expect(isCanonicalPrivacyPath('/privacy.html')).toBe(true);
    expect(isCanonicalPrivacyPath('/privacy-policy')).toBe(true);
    expect(isCanonicalPrivacyPath('/legal/privacy')).toBe(true);
    expect(isCanonicalPrivacyPath('/about/privacy-policy')).toBe(true);

    // Non-policy paths must return false
    expect(isCanonicalPrivacyPath('/account/settings')).toBe(false);
    expect(isCanonicalPrivacyPath('/user/profile')).toBe(false);
    expect(isCanonicalPrivacyPath('/portal/insurance-policy')).toBe(false);
    expect(isCanonicalPrivacyPath('/dashboard')).toBe(false);
    expect(isCanonicalPrivacyPath('/')).toBe(false);
  });

  it('should extract text if URL pathname matches canonical privacy policy', () => {
    window.location.href = 'https://example.com/privacy';
    window.location.pathname = '/privacy';
    document.body.textContent = 'This is a privacy policy. We respect your data.';
    const text = extractPrivacyPolicyText();
    expect(text).toContain('We respect your data');
  });

  it('never triggers extraction based on query parameters', () => {
    window.location.href = 'https://bank.com/account/settings?tab=privacy&view=policy';
    window.location.pathname = '/account/settings';
    document.body.textContent = 'Confidential user banking dashboard with balance $50,000.';

    const text = extractPrivacyPolicyText();
    expect(text).toBe('');
    expect(text).not.toContain('Confidential');
  });

  it('never extracts arbitrary body text on general non-policy pages', () => {
    window.location.href = 'https://app.com/dashboard';
    window.location.pathname = '/dashboard';
    document.body.textContent = 'Private user documents and messages.';

    const text = extractPrivacyPolicyText();
    expect(text).toBe('');
  });

  it('should extract text from designated static privacy container element', () => {
    const longText = 'A'.repeat(150);
    document.body.innerHTML = `<div id="privacy-policy">${longText}</div>`;
    const text = extractPrivacyPolicyText();
    expect(text).toBe(longText);
  });

  it('should bound the extracted text to 4000 characters', () => {
    window.location.href = 'https://example.com/privacy';
    window.location.pathname = '/privacy';
    const hugeText = 'B'.repeat(5000);
    document.body.textContent = hugeText;
    const text = extractPrivacyPolicyText();
    expect(text.length).toBe(4000);
  });

  it('should return empty string if no privacy policy is found', () => {
    document.body.innerHTML = '<div>Just a normal page</div>';
    const text = extractPrivacyPolicyText();
    expect(text).toBe('');
  });

  it('should return undefined for third party cookie count to avoid faking data', () => {
    expect(getThirdPartyCookieCount()).toBeUndefined();
  });
});
