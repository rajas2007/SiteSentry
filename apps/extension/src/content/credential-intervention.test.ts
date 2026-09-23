import { describe, it, expect, beforeEach } from 'vitest';
import { applyCredentialIntervention } from './credential-intervention';

describe('Credential Intervention', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <form>
        <input type="text" name="username" />
        <input type="password" name="pwd" placeholder="Enter password" title="Password" />
      </form>
    `;
  });

  it('should not disable password fields if not credential theft', () => {
    const mockResponse = {
      status: 'SUCCESS',
      threat_category: 'phishing'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const restore = applyCredentialIntervention(mockResponse);
    expect(restore).toBeNull();
    
    const pwd = document.querySelector('input[type="password"]') as HTMLInputElement;
    expect(pwd.disabled).toBe(false);
  });

  it('should disable password fields and return a restore function for credential theft', () => {
    const mockResponse = {
      status: 'SUCCESS',
      threat_category: 'credential_theft'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const restore = applyCredentialIntervention(mockResponse);
    expect(restore).not.toBeNull();
    
    const pwd = document.querySelector('input[type="password"]') as HTMLInputElement;
    expect(pwd.disabled).toBe(true);
    expect(pwd.placeholder).toBe('Disabled by Site Sentry (High Risk)');
    expect(pwd.style.backgroundColor).toBe('rgb(254, 226, 226)'); // #fee2e2
    expect(pwd.title).toBe('Site Sentry has blocked this input to prevent credential theft.');

    // Password values are NEVER read, we just check styles/attributes.
    // Ensure normal inputs are not affected
    const username = document.querySelector('input[type="text"]') as HTMLInputElement;
    expect(username.disabled).toBe(false);

    // Call restore
    if (restore) restore();

    // Verify restored
    expect(pwd.disabled).toBe(false);
    expect(pwd.placeholder).toBe('Enter password');
    expect(pwd.style.backgroundColor).toBe('');
    expect(pwd.title).toBe('Password');
  });
});
