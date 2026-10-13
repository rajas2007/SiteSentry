import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InconclusiveBanner } from './inconclusive-banner';

describe('InconclusiveBanner', () => {
  let banner: InconclusiveBanner;
  let mockShadowRoot: ShadowRoot;

  beforeEach(() => {
    document.body.innerHTML = '<div>Content</div>';
    const originalAttachShadow = window.HTMLElement.prototype.attachShadow;
    vi.spyOn(window.HTMLElement.prototype, 'attachShadow').mockImplementation(function (
      this: HTMLElement,
      init
    ) {
      mockShadowRoot = originalAttachShadow.call(this, { ...init, mode: 'open' });
      return mockShadowRoot;
    });

    banner = new InconclusiveBanner();
  });

  afterEach(() => {
    banner.dismiss();
    vi.restoreAllMocks();
  });

  it('displays the warning banner with expected message when show() is called', () => {
    banner.show();

    expect(banner.isShowing()).toBe(true);
    const hostElement = document.getElementById('site-sentry-inconclusive-banner-host');
    expect(hostElement).not.toBeNull();
    expect(document.documentElement.contains(hostElement)).toBe(true);

    expect(mockShadowRoot).toBeDefined();
    const textElement = mockShadowRoot.querySelector('#sentry-banner-text');
    expect(textElement?.textContent).toBe(
      "Site Sentry couldn't complete all threat-intelligence checks. Exercise caution."
    );
  });

  it('dismisses the banner when Dismiss button is clicked', () => {
    const onDismiss = vi.fn();
    banner.show("Site Sentry couldn't complete all threat-intelligence checks. Exercise caution.", onDismiss);

    expect(banner.isShowing()).toBe(true);

    const dismissBtn = mockShadowRoot.querySelector('#sentry-banner-dismiss') as HTMLButtonElement;
    expect(dismissBtn).not.toBeNull();

    dismissBtn.click();

    expect(banner.isShowing()).toBe(false);
    const hostElement = document.getElementById('site-sentry-inconclusive-banner-host');
    expect(hostElement).toBeNull();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not create duplicate banners when show() is called repeatedly', () => {
    banner.show();
    banner.show();
    banner.show();

    const bannerHosts = document.querySelectorAll('#site-sentry-inconclusive-banner-host');
    expect(bannerHosts.length).toBe(1);
  });

  it('does not prevent page interaction or set body overflow hidden', () => {
    document.body.style.overflow = '';
    banner.show();

    // Body overflow must remain interactive, unlike the blocking overlay
    expect(document.body.style.overflow).toBe('');
  });
});
