import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WarningOverlay } from './warning-overlay';
import { PageAnalysisResponse } from '@site-sentry/shared-types';

describe('Warning Overlay', () => {
  let overlay: WarningOverlay;
  let mockShadowRoot: ShadowRoot;

  beforeEach(() => {
    document.body.innerHTML = '';
    const originalAttachShadow = window.HTMLElement.prototype.attachShadow;
    vi.spyOn(window.HTMLElement.prototype, 'attachShadow').mockImplementation(function (this: HTMLElement, init) {
      mockShadowRoot = originalAttachShadow.call(this, { ...init, mode: 'open' });
      return mockShadowRoot;
    });

    overlay = new WarningOverlay();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render overlay for high severity', () => {
    const mockResponse = {
      analysis_id: '123',
      score: 10,
      severity: 'high',
      confidence: 0.9,
      threat_category: 'credential_theft',
      recommendations: [],
      factors: ['Test Factor'],
      decision: {
        action: 'block',
        severity: 'high',
        ui: { color: 'rose' }
      }
    } as PageAnalysisResponse;

    overlay.show(mockResponse);
    
    const overlayElement = document.documentElement.lastChild as HTMLElement;
    expect(overlayElement).toBeDefined();
    expect(overlayElement.tagName).toBe('DIV');
    
    expect(mockShadowRoot).toBeDefined();
    expect(mockShadowRoot.querySelector('#sentry-title')?.textContent).toBe('Site Sentry Warning');
    
    const listItems = mockShadowRoot.querySelectorAll('li');
    expect(listItems.length).toBe(1);
    expect(listItems[0].textContent).toBe('Test Factor');
  });

  it('should dismiss and trigger callback when Continue Anyway is clicked', () => {
    const mockResponse = {
      factors: []
    } as unknown as PageAnalysisResponse;

    const onDismissCallback = vi.fn();
    overlay.show(mockResponse, onDismissCallback);

    const overlayElement = document.documentElement.lastChild as HTMLElement;
    
    const continueButton = Array.from(mockShadowRoot.querySelectorAll('button') || []).find(b => b.textContent === 'Continue Anyway');
    expect(continueButton).toBeDefined();

    continueButton?.click();
    
    expect(document.documentElement.contains(overlayElement)).toBe(false);
    expect(onDismissCallback).toHaveBeenCalledTimes(1);
  });
});
