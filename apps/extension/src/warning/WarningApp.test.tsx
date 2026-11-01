import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import WarningApp, { isValidHttpUrl, isWarningExpired } from './WarningApp';
import { WarningData } from '../types/warning';

interface ChromeMock {
  storage: {
    session: {
      get: Mock;
      remove: Mock;
    };
  };
  tabs: {
    getCurrent: Mock;
    update: Mock;
  };
}

describe('WarningApp Component', () => {
  let chromeMock: ChromeMock;
  let sessionStorageStore: Record<string, unknown>;

  const sampleWarning: WarningData = {
    warningId: 'test-warning-uuid',
    targetUrl: 'https://deceptive-login.example.com/auth?session=xyz',
    hostname: 'deceptive-login.example.com',
    score: 15,
    severity: 'high',
    threatCategory: 'phishing',
    factors: ['Known credential harvesting signature', 'Domain spoofing detected'],
    recommendations: ['Do not enter personal or financial details', 'Close this browser tab immediately'],
    timestamp: Date.now(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorageStore = {};

    chromeMock = {
      storage: {
        session: {
          get: vi.fn((key: string, callback?: (items: Record<string, unknown>) => void) => {
            const result = { [key]: sessionStorageStore[key] };
            if (callback) callback(result);
            return Promise.resolve(result);
          }),
          remove: vi.fn((key: string, callback?: () => void) => {
            delete sessionStorageStore[key];
            if (callback) callback();
            return Promise.resolve();
          }),
        },
      },
      tabs: {
        getCurrent: vi.fn((cb: (tab: { id: number }) => void) => cb({ id: 999 })),
        update: vi.fn(),
      },
    };

    Object.defineProperty(global, 'chrome', {
      value: chromeMock,
      writable: true,
      configurable: true,
    });

    // Reset location search using history
    window.history.replaceState({}, '', '/pages/warning.html');
  });

  describe('Protocol Validator', () => {
    it('validates http and https correctly and rejects unsafe schemes', () => {
      expect(isValidHttpUrl('http://example.com')).toBe(true);
      expect(isValidHttpUrl('https://example.com/path?foo=bar')).toBe(true);
      expect(isValidHttpUrl('javascript:alert(1)')).toBe(false);
      expect(isValidHttpUrl('data:text/html,<h1>bad</h1>')).toBe(false);
      expect(isValidHttpUrl('file:///etc/passwd')).toBe(false);
      expect(isValidHttpUrl('not-a-valid-url')).toBe(false);
    });
  });

  describe('Bounded Expiry Policy', () => {
    it('correctly evaluates expired vs non-expired timestamps and rejects future timestamps', () => {
      const now = Date.now();
      expect(isWarningExpired(now)).toBe(false);
      expect(isWarningExpired(now - 14 * 60 * 1000)).toBe(false); // 14 mins ago: still valid
      expect(isWarningExpired(now - 16 * 60 * 1000)).toBe(true);  // 16 mins ago: expired (> 15 mins)
      expect(isWarningExpired(now + 60 * 1000)).toBe(true);       // Future timestamp: invalid/rejected
      expect(isWarningExpired(NaN)).toBe(true);
      expect(isWarningExpired(undefined as unknown as number)).toBe(true);
    });

    it('renders safe fallback and removes storage entry if warning record is expired', async () => {
      window.history.replaceState({}, '', '/pages/warning.html?id=expired-uuid');
      sessionStorageStore['warning_expired-uuid'] = {
        ...sampleWarning,
        warningId: 'expired-uuid',
        timestamp: Date.now() - 20 * 60 * 1000, // 20 minutes ago
      };

      render(<WarningApp />);

      await waitFor(() => {
        expect(screen.getByText('Security Advisory Unavailable')).toBeInTheDocument();
      });

      // Storage record should have been cleaned up
      expect(chromeMock.storage.session.remove).toHaveBeenCalledWith('warning_expired-uuid');
      expect(sessionStorageStore['warning_expired-uuid']).toBeUndefined();
    });
  });

  describe('Safe Fallback UI', () => {
    it('renders safe fallback when no id parameter is in query string', async () => {
      window.history.replaceState({}, '', '/pages/warning.html');

      render(<WarningApp />);

      await waitFor(() => {
        expect(screen.getByText('Security Advisory Unavailable')).toBeInTheDocument();
      });

      expect(screen.getByText(/No active threat report was found for this session/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Return to Safety/i })).toBeInTheDocument();
    });

    it('renders safe fallback when session storage does not contain warning data', async () => {
      window.history.replaceState({}, '', '/pages/warning.html?id=missing-id');

      render(<WarningApp />);

      await waitFor(() => {
        expect(screen.getByText('Security Advisory Unavailable')).toBeInTheDocument();
      });
    });

    it('returns to safety on button click in fallback state', async () => {
      window.history.replaceState({}, '', '/pages/warning.html');

      render(<WarningApp />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Return to Safety/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Return to Safety/i }));
      expect(chromeMock.tabs.update).toHaveBeenCalledWith(999, { url: 'chrome://newtab' });
    });

    it('closes window safely when chrome.tabs.getCurrent provides no valid tab ID without calling history.back', async () => {
      const windowCloseSpy = vi.spyOn(window, 'close').mockImplementation(() => {});
      const historyBackSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {});
      chromeMock.tabs.getCurrent.mockImplementationOnce((cb: (tab?: { id?: number }) => void) => cb(undefined));

      render(<WarningApp />);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Return to Safety/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Return to Safety/i }));
      expect(windowCloseSpy).toHaveBeenCalled();
      expect(historyBackSpy).not.toHaveBeenCalled();
      expect(chromeMock.tabs.update).not.toHaveBeenCalled();

      windowCloseSpy.mockRestore();
      historyBackSpy.mockRestore();
    });
  });

  describe('Warning Interstitial with Valid WarningData and Cleanup', () => {
    beforeEach(() => {
      window.history.replaceState({}, '', '/pages/warning.html?id=test-warning-uuid');
      sessionStorageStore['warning_test-warning-uuid'] = sampleWarning;
      // Pre-populate another tab's record to verify isolation
      sessionStorageStore['warning_other-tab-uuid'] = {
        ...sampleWarning,
        warningId: 'other-tab-uuid',
        hostname: 'other-threat.com',
      };
    });

    it('renders blocked site details, factors, and plain text URL', async () => {
      render(<WarningApp />);

      await waitFor(() => {
        expect(screen.getByText('Deceptive or Malicious Site Ahead')).toBeInTheDocument();
      });

      // Hostname displayed
      expect(screen.getByText('deceptive-login.example.com')).toBeInTheDocument();

      // Plain-text target URL check (NO innerHTML or link element)
      const targetUrlElement = screen.getByTestId('blocked-target-url');
      expect(targetUrlElement.textContent).toBe('https://deceptive-login.example.com/auth?session=xyz');
      expect(targetUrlElement.tagName.toLowerCase()).toBe('span');

      // Threat score and category
      expect(screen.getByText(/Threat Score: 15\/100/i)).toBeInTheDocument();
      expect(screen.getByText(/Category: phishing/i)).toBeInTheDocument();

      // Detection factors
      expect(screen.getByText('Known credential harvesting signature')).toBeInTheDocument();
      expect(screen.getByText('Domain spoofing detected')).toBeInTheDocument();

      // Guidance
      expect(screen.getByText('Do not enter personal or financial details')).toBeInTheDocument();
    });

    it('navigates to safety and cleans up warning record without deleting other records', async () => {
      render(<WarningApp />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Take Me Back to Safety/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Take Me Back to Safety/i }));
      expect(chromeMock.tabs.update).toHaveBeenCalledWith(999, { url: 'chrome://newtab' });

      // Cleaned up current tab's record
      expect(chromeMock.storage.session.remove).toHaveBeenCalledWith('warning_test-warning-uuid');
      expect(sessionStorageStore['warning_test-warning-uuid']).toBeUndefined();

      // Other tab's record remains completely intact
      expect(sessionStorageStore['warning_other-tab-uuid']).toBeDefined();
    });

    it('requires explicit confirmation, cleans up warning record on proceed, and preserves other records', async () => {
      render(<WarningApp />);

      await waitFor(() => {
        expect(screen.getByText(/Advanced: Proceed to unsafe site/i)).toBeInTheDocument();
      });

      // Expand advanced section
      fireEvent.click(screen.getByText(/Advanced: Proceed to unsafe site/i));

      // Initially proceed button is disabled
      const proceedButton = screen.getByRole('button', { name: /Proceed to deceptive-login.example.com \(Unsafe\)/i });
      expect(proceedButton).toBeDisabled();

      // Check confirmation checkbox
      const checkbox = screen.getByLabelText(/I understand the risks and wish to proceed anyway/i);
      fireEvent.click(checkbox);

      // Now enabled
      expect(proceedButton).not.toBeDisabled();

      // Click proceed
      fireEvent.click(proceedButton);
      expect(chromeMock.tabs.update).toHaveBeenCalledWith(999, { url: sampleWarning.targetUrl });

      // Cleaned up this tab's record
      expect(chromeMock.storage.session.remove).toHaveBeenCalledWith('warning_test-warning-uuid');
      expect(sessionStorageStore['warning_test-warning-uuid']).toBeUndefined();

      // Other tab's record remains intact
      expect(sessionStorageStore['warning_other-tab-uuid']).toBeDefined();
    });

    it('blocks navigation if target URL protocol is not http/https', async () => {
      const maliciousScriptWarning: WarningData = {
        ...sampleWarning,
        targetUrl: 'javascript:alert(document.cookie)',
      };
      sessionStorageStore['warning_test-warning-uuid'] = maliciousScriptWarning;

      render(<WarningApp />);

      await waitFor(() => {
        expect(screen.getByText(/Advanced: Proceed to unsafe site/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(/Advanced: Proceed to unsafe site/i));

      const checkbox = screen.getByLabelText(/I understand the risks and wish to proceed anyway/i);
      fireEvent.click(checkbox);

      const proceedButton = screen.getByRole('button', { name: /Proceed to deceptive-login.example.com \(Unsafe\)/i });
      fireEvent.click(proceedButton);

      // Navigation was blocked
      expect(chromeMock.tabs.update).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toHaveTextContent(/Navigation blocked: The target URL does not use a supported HTTP or HTTPS protocol/i);

      // Record was not removed on failed attempt
      expect(sessionStorageStore['warning_test-warning-uuid']).toBeDefined();
    });

    it('enforces expiry inside handleProceedAnyway, prevents navigation, removes record, and displays safe fallback', async () => {
      render(<WarningApp />);

      await waitFor(() => {
        expect(screen.getByText('Deceptive or Malicious Site Ahead')).toBeInTheDocument();
      });

      // Expand advanced section and confirm
      fireEvent.click(screen.getByText(/Advanced: Proceed to unsafe site/i));
      const checkbox = screen.getByLabelText(/I understand the risks and wish to proceed anyway/i);
      fireEvent.click(checkbox);

      const proceedButton = screen.getByRole('button', { name: /Proceed to deceptive-login.example.com \(Unsafe\)/i });

      // Advance mock time past the 15-minute window
      const originalNow = Date.now;
      Date.now = vi.fn(() => originalNow() + 16 * 60 * 1000);

      fireEvent.click(proceedButton);

      // Navigation was prevented
      expect(chromeMock.tabs.update).not.toHaveBeenCalled();

      // Storage record was cleaned up
      expect(chromeMock.storage.session.remove).toHaveBeenCalledWith('warning_test-warning-uuid');
      expect(sessionStorageStore['warning_test-warning-uuid']).toBeUndefined();

      // Safe fallback UI is now displayed
      await waitFor(() => {
        expect(screen.getByText('Security Advisory Unavailable')).toBeInTheDocument();
      });

      Date.now = originalNow;
    });
  });
});
