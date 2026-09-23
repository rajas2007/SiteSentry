import { PageAnalysisResponse } from '@site-sentry/shared-types';

export function applyCredentialIntervention(response: PageAnalysisResponse): (() => void) | null {
  if (response.threat_category === 'credential_theft') {
    const passwordInputs = document.querySelectorAll<HTMLInputElement>('input[type="password"]');
    
    passwordInputs.forEach(input => {
      // Store original values using data attributes for restoration
      if (!input.hasAttribute('data-sentry-original-disabled')) {
        input.setAttribute('data-sentry-original-disabled', input.disabled ? 'true' : 'false');
        input.setAttribute('data-sentry-original-placeholder', input.placeholder || '');
        input.setAttribute('data-sentry-original-title', input.title || '');
      }

      input.disabled = true;
      input.placeholder = 'Disabled by Site Sentry (High Risk)';
      input.style.backgroundColor = '#fee2e2';
      input.style.cursor = 'not-allowed';
      input.title = 'Site Sentry has blocked this input to prevent credential theft.';
    });

    // Return restore function
    return () => {
      passwordInputs.forEach(input => {
        const originalDisabled = input.getAttribute('data-sentry-original-disabled') === 'true';
        input.disabled = originalDisabled;
        input.placeholder = input.getAttribute('data-sentry-original-placeholder') || '';
        input.title = input.getAttribute('data-sentry-original-title') || '';
        input.style.backgroundColor = '';
        input.style.cursor = '';
      });
    };
  }
  return null;
}
