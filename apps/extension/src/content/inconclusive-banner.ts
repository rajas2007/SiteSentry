export class InconclusiveBanner {
  private bannerElement: HTMLElement | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private onDismissCallback: (() => void) | null = null;

  public show(
    message: string = "Site Sentry couldn't complete all threat-intelligence checks. Exercise caution.",
    onDismiss?: () => void
  ) {
    if (this.bannerElement) {
      return; // Already showing, prevent duplicate insertion
    }

    this.onDismissCallback = onDismiss || null;

    this.bannerElement = document.createElement('div');
    this.bannerElement.id = 'site-sentry-inconclusive-banner-host';
    // Top-docked, lightweight banner
    this.bannerElement.style.position = 'fixed';
    this.bannerElement.style.top = '0';
    this.bannerElement.style.left = '0';
    this.bannerElement.style.width = '100vw';
    this.bannerElement.style.zIndex = '2147483646'; // High z-index, but below full overlay
    this.bannerElement.style.pointerEvents = 'auto';

    // Isolate styles with closed shadow DOM
    this.shadowRoot = this.bannerElement.attachShadow({ mode: 'closed' });

    const bar = document.createElement('div');
    bar.setAttribute('role', 'status');
    bar.setAttribute('aria-live', 'polite');

    bar.style.display = 'flex';
    bar.style.alignItems = 'center';
    bar.style.justifyContent = 'space-between';
    bar.style.backgroundColor = '#fffbeb'; // Amber-50
    bar.style.borderBottom = '2px solid #f59e0b'; // Amber-500
    bar.style.color = '#92400e'; // Amber-800
    bar.style.padding = '8px 16px';
    bar.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    bar.style.fontSize = '13px';
    bar.style.lineHeight = '1.4';
    bar.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.08)';
    bar.style.boxSizing = 'border-box';

    const leftContainer = document.createElement('div');
    leftContainer.style.display = 'flex';
    leftContainer.style.alignItems = 'center';
    leftContainer.style.gap = '8px';
    leftContainer.style.flex = '1';
    leftContainer.style.minWidth = '0';

    const badge = document.createElement('span');
    badge.textContent = 'Site Sentry';
    badge.style.backgroundColor = '#fde68a'; // Amber-200
    badge.style.color = '#78350f'; // Amber-900
    badge.style.padding = '2px 6px';
    badge.style.borderRadius = '4px';
    badge.style.fontWeight = '700';
    badge.style.fontSize = '11px';
    badge.style.textTransform = 'uppercase';
    badge.style.letterSpacing = '0.5px';
    badge.style.flexShrink = '0';

    const text = document.createElement('span');
    text.id = 'sentry-banner-text';
    text.textContent = message;
    text.style.fontWeight = '500';

    leftContainer.appendChild(badge);
    leftContainer.appendChild(text);

    const dismissBtn = document.createElement('button');
    dismissBtn.id = 'sentry-banner-dismiss';
    dismissBtn.textContent = 'Dismiss';
    dismissBtn.style.backgroundColor = 'transparent';
    dismissBtn.style.color = '#92400e';
    dismissBtn.style.border = '1px solid #d97706';
    dismissBtn.style.padding = '3px 10px';
    dismissBtn.style.borderRadius = '4px';
    dismissBtn.style.fontWeight = '600';
    dismissBtn.style.fontSize = '12px';
    dismissBtn.style.cursor = 'pointer';
    dismissBtn.style.marginLeft = '12px';
    dismissBtn.style.flexShrink = '0';

    dismissBtn.onclick = () => this.dismiss();

    bar.appendChild(leftContainer);
    bar.appendChild(dismissBtn);

    this.shadowRoot.appendChild(bar);
    document.documentElement.appendChild(this.bannerElement);
  }

  public dismiss() {
    if (this.bannerElement) {
      if (this.bannerElement.parentNode) {
        this.bannerElement.parentNode.removeChild(this.bannerElement);
      }
      this.bannerElement = null;
      this.shadowRoot = null;
    }

    if (this.onDismissCallback) {
      this.onDismissCallback();
      this.onDismissCallback = null;
    }
  }

  public isShowing(): boolean {
    return this.bannerElement !== null;
  }
}
