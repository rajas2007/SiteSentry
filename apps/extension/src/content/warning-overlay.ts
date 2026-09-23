import { PageAnalysisResponse } from '@site-sentry/shared-types';

export class WarningOverlay {
  private overlayElement: HTMLElement | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private onDismissCallback: (() => void) | null = null;

  public show(response: PageAnalysisResponse, onDismiss?: () => void) {
    if (this.overlayElement) {
      return; // Already showing
    }
    
    this.onDismissCallback = onDismiss || null;

    this.overlayElement = document.createElement('div');
    // Isolate from host page CSS
    this.overlayElement.style.position = 'fixed';
    this.overlayElement.style.top = '0';
    this.overlayElement.style.left = '0';
    this.overlayElement.style.width = '100vw';
    this.overlayElement.style.height = '100vh';
    this.overlayElement.style.zIndex = '2147483647'; // Max z-index
    this.overlayElement.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
    this.overlayElement.style.display = 'flex';
    this.overlayElement.style.alignItems = 'center';
    this.overlayElement.style.justifyContent = 'center';
    this.overlayElement.style.backdropFilter = 'blur(5px)';

    this.shadowRoot = this.overlayElement.attachShadow({ mode: 'closed' });

    const container = document.createElement('div');
    container.setAttribute('role', 'alertdialog');
    container.setAttribute('aria-modal', 'true');
    container.setAttribute('aria-labelledby', 'sentry-title');
    container.setAttribute('aria-describedby', 'sentry-desc');

    container.style.backgroundColor = '#ffffff';
    container.style.color = '#1e293b';
    container.style.padding = '2rem';
    container.style.borderRadius = '12px';
    container.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
    container.style.maxWidth = '32rem';
    container.style.width = '90%';
    container.style.fontFamily = 'system-ui, -apple-system, sans-serif';

    const header = document.createElement('h1');
    header.id = 'sentry-title';
    header.textContent = 'Site Sentry Warning';
    header.style.color = '#e11d48';
    header.style.fontSize = '1.5rem';
    header.style.fontWeight = '700';
    header.style.marginTop = '0';
    header.style.marginBottom = '1rem';

    const desc = document.createElement('p');
    desc.id = 'sentry-desc';
    desc.textContent = 'Site Sentry detected significant security risks on this page.';
    desc.style.fontSize = '1rem';
    desc.style.marginBottom = '1.5rem';
    desc.style.lineHeight = '1.5';

    const reasonsTitle = document.createElement('strong');
    reasonsTitle.textContent = 'Why?';
    reasonsTitle.style.display = 'block';
    reasonsTitle.style.marginBottom = '0.5rem';

    const list = document.createElement('ul');
    list.style.margin = '0 0 2rem 0';
    list.style.paddingLeft = '1.5rem';

    const reasons = response.factors.length > 0 
      ? response.factors 
      : ['High risk identified based on analysis'];

    reasons.forEach(reason => {
      const li = document.createElement('li');
      li.textContent = reason;
      li.style.marginBottom = '0.5rem';
      list.appendChild(li);
    });

    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '1rem';
    buttonContainer.style.justifyContent = 'flex-end';

    const leaveButton = document.createElement('button');
    leaveButton.textContent = 'Leave Site';
    leaveButton.style.backgroundColor = '#e11d48';
    leaveButton.style.color = 'white';
    leaveButton.style.border = 'none';
    leaveButton.style.padding = '0.75rem 1.5rem';
    leaveButton.style.borderRadius = '6px';
    leaveButton.style.fontWeight = '600';
    leaveButton.style.cursor = 'pointer';
    leaveButton.style.fontSize = '1rem';
    leaveButton.onclick = () => this.leaveSite();

    const continueButton = document.createElement('button');
    continueButton.textContent = 'Continue Anyway';
    continueButton.style.backgroundColor = 'transparent';
    continueButton.style.color = '#64748b';
    continueButton.style.border = '1px solid #cbd5e1';
    continueButton.style.padding = '0.75rem 1.5rem';
    continueButton.style.borderRadius = '6px';
    continueButton.style.fontWeight = '600';
    continueButton.style.cursor = 'pointer';
    continueButton.style.fontSize = '1rem';
    continueButton.onclick = () => this.dismiss();

    buttonContainer.appendChild(continueButton);
    buttonContainer.appendChild(leaveButton);

    container.appendChild(header);
    container.appendChild(desc);
    container.appendChild(reasonsTitle);
    container.appendChild(list);
    container.appendChild(buttonContainer);

    this.shadowRoot.appendChild(container);
    document.documentElement.appendChild(this.overlayElement);

    // Trap focus and prevent scrolling
    document.body.style.overflow = 'hidden';
    leaveButton.focus();

    // Prevent interactions
    this.preventPageInteraction();
  }

  public dismiss() {
    if (this.overlayElement) {
      document.documentElement.removeChild(this.overlayElement);
      this.overlayElement = null;
      this.shadowRoot = null;
    }
    document.body.style.overflow = '';
    this.restorePageInteraction();
    
    if (this.onDismissCallback) {
      this.onDismissCallback();
      this.onDismissCallback = null;
    }
  }

  private leaveSite() {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = 'about:blank';
    }
  }

  // Prevent keyboard interaction with underlying page
  private handleKeyDown = (e: KeyboardEvent) => {
    // Only allow Tab navigation inside overlay, and Enter/Space on buttons
    // Actually, handling focus trap thoroughly is complex for an MVP, 
    // but we can block basic interactions.
    if (e.key === 'Escape') {
      e.preventDefault();
      // Block escape from dismissing, must click button
    }
  };

  private preventPageInteraction() {
    document.addEventListener('keydown', this.handleKeyDown, true);
  }

  private restorePageInteraction() {
    document.removeEventListener('keydown', this.handleKeyDown, true);
  }
}
