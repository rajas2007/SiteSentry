import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { PageAnalysisResponse } from '@site-sentry/shared-types';

interface ChromeMock {
  runtime: {
    sendMessage: Mock;
  };
}

describe('Content Script ADR-005 Compliance and Privacy', () => {
  let chromeMock: ChromeMock;

  const mockHighThreatResponse: PageAnalysisResponse = {
    analysis_id: 'threat-1',
    score: 10,
    severity: 'high',
    confidence: 0.98,
    threat_category: 'phishing',
    recommendations: ['Leave immediately'],
    factors: ['Credential harvesting detected'],
    decision: {
      action: 'block',
      severity: 'high',
      ui: { color: 'rose' },
    },
  };

  const mockInconclusiveResponse: PageAnalysisResponse = {
    analysis_id: 'inconclusive-1',
    score: 100,
    severity: 'medium',
    confidence: 0.5,
    threat_category: 'inconclusive',
    recommendations: ['Exercise caution'],
    factors: ['Incomplete provider data'],
    decision: {
      action: 'warn',
      severity: 'medium',
      ui: { color: 'amber' },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';

    chromeMock = {
      runtime: {
        sendMessage: vi.fn(),
      },
    };

    Object.defineProperty(global, 'chrome', {
      value: chromeMock,
      writable: true,
      configurable: true,
    });

    Object.defineProperty(window, 'location', {
      value: {
        href: 'https://example.com/login',
        hostname: 'example.com',
        protocol: 'https:',
        pathname: '/login',
      },
      writable: true,
      configurable: true,
    });
  });

  it('extracts features and sends ANALYZE_PAGE message without touching DOM', async () => {
    // Set up a mock login form with password field
    document.body.innerHTML = `
      <form id="login-form">
        <input type="text" name="username" id="username" value="testuser" />
        <input type="password" name="password" id="password" value="secret123" />
        <button type="submit">Log in</button>
      </form>
    `;

    chromeMock.runtime.sendMessage.mockResolvedValueOnce({
      status: 'SUCCESS',
      data: mockHighThreatResponse,
    });

    const { analyzeCurrentPage } = await import('./content-script');
    await analyzeCurrentPage();

    // Verify message sent
    expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ANALYZE_PAGE',
        payload: expect.objectContaining({
          url: 'https://example.com/login',
          features: expect.objectContaining({
            hasPasswordField: true,
            hasLoginForm: true,
          }),
        }),
      })
    );

    // CRITICAL: ADR-005 Verification
    // 1. Password input must NOT be disabled or mutated
    const passwordInput = document.getElementById('password') as HTMLInputElement;
    expect(passwordInput.disabled).toBe(false);
    expect(passwordInput.value).toBe('secret123');

    // 2. No overlay host elements injected into document
    expect(document.getElementById('site-sentry-warning-overlay-host')).toBeNull();
    expect(document.getElementById('site-sentry-inconclusive-banner-host')).toBeNull();
    expect(document.querySelector('.site-sentry-overlay')).toBeNull();

    // 3. Form elements remain undisturbed
    const form = document.getElementById('login-form');
    expect(form).not.toBeNull();
  });

  it('sanitizes URL in request payload stripping credentials, fragments, and sensitive query tokens', async () => {
    Object.defineProperty(window, 'location', {
      value: {
        href: 'https://user:password123@example.com/checkout?token=secret999&item=book#frag',
        hostname: 'example.com',
        protocol: 'https:',
        pathname: '/checkout',
      },
      writable: true,
      configurable: true,
    });

    chromeMock.runtime.sendMessage.mockResolvedValueOnce({
      status: 'SUCCESS',
      data: mockHighThreatResponse,
    });

    const { analyzeCurrentPage } = await import('./content-script');
    await analyzeCurrentPage();

    expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ANALYZE_PAGE',
        payload: expect.objectContaining({
          url: 'https://example.com/checkout?item=book',
        }),
      })
    );
  });

  it('immediately exits and does not send messages for unsupported schemes', async () => {
    Object.defineProperty(window, 'location', {
      value: {
        href: 'file:///C:/Users/test/secret.html',
        hostname: '',
        protocol: 'file:',
        pathname: '/C:/Users/test/secret.html',
      },
      writable: true,
      configurable: true,
    });

    const { analyzeCurrentPage } = await import('./content-script');
    await analyzeCurrentPage();

    expect(chromeMock.runtime.sendMessage).not.toHaveBeenCalled();
  });

  it('does not log analysis response payloads into console', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log');

    chromeMock.runtime.sendMessage.mockResolvedValueOnce({
      status: 'SUCCESS',
      data: mockHighThreatResponse,
    });

    const { analyzeCurrentPage } = await import('./content-script');
    await analyzeCurrentPage();

    expect(consoleLogSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('[Site Sentry] Analysis response:'),
      expect.anything()
    );
  });

  it('does NOT inject banners or tamper with DOM on inconclusive response', async () => {
    document.body.innerHTML = `
      <div id="content">
        <h1>Welcome</h1>
        <p>Some page content</p>
      </div>
    `;

    const initialChildCount = document.body.children.length;

    chromeMock.runtime.sendMessage.mockResolvedValueOnce({
      status: 'SUCCESS',
      data: mockInconclusiveResponse,
    });

    const { analyzeCurrentPage } = await import('./content-script');
    await analyzeCurrentPage();

    // DOM child count must remain identical (zero injected elements)
    expect(document.body.children.length).toBe(initialChildCount);
    expect(document.getElementById('site-sentry-inconclusive-banner-host')).toBeNull();
  });
});
