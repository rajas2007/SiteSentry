import { describe, it, expect, beforeEach } from 'vitest';
import { extractPageFeatures } from './dom-extractor';

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
      },
      writable: true
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
