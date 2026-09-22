import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from './App';
import { ExtensionMessageResponse } from '@site-sentry/shared-types';

describe('App component', () => {
  beforeEach(() => {
    // Mock chrome.runtime.sendMessage
    const chromeMock = {
      runtime: {
        sendMessage: vi.fn() as unknown as typeof chrome.runtime.sendMessage,
      }
    };
    Object.defineProperty(global, 'chrome', {
      value: chromeMock,
      writable: true
    });
  });

  it('should render threat intelligence section when data exists', async () => {
    const mockResponse: ExtensionMessageResponse = {
      status: 'SUCCESS',
      data: {
        analysis_id: '123',
        score: 42,
        severity: 'high',
        confidence: 0.95,
        threat_category: 'phishing',
        recommendations: ['Leave immediately'],
        factors: ['Unencrypted connection'],
        decision: {
          action: 'block',
          severity: 'high',
          ui: { color: 'rose' }
        },
        threat_intelligence: {
          sources: [
            {
              provider: 'Google Safe Browsing',
              status: 'detected',
              categories: ['Phishing'],
              summary: 'Flagged as dangerous'
            },
            {
              provider: 'VirusTotal',
              status: 'clean',
              categories: [],
              summary: 'No security vendors flagged this domain'
            }
          ]
        }
      }
    };

    vi.mocked(global.chrome.runtime.sendMessage).mockImplementation((...args: unknown[]) => {
      const cb = args[args.length - 1] as (res: ExtensionMessageResponse) => void;
      cb(mockResponse);
      return Promise.resolve();
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Threat Intelligence')).toBeInTheDocument();
    });

    expect(screen.getByText('Google Safe Browsing')).toBeInTheDocument();
    expect(screen.getByText('Flagged as dangerous')).toBeInTheDocument();
    expect(screen.getByText('Phishing')).toBeInTheDocument();

    expect(screen.getByText('VirusTotal')).toBeInTheDocument();
    expect(screen.getByText('No security vendors flagged this domain')).toBeInTheDocument();
  });

  it('should render other security factors even without threat intelligence', async () => {
    const mockResponse: ExtensionMessageResponse = {
      status: 'SUCCESS',
      data: {
        analysis_id: '123',
        score: 90,
        severity: 'low',
        confidence: 0.9,
        threat_category: 'safe',
        recommendations: ['Safe to browse'],
        factors: ['Connection is encrypted'],
        decision: {
          action: 'allow',
          severity: 'low',
          ui: { color: 'emerald' }
        }
      }
    };

    vi.mocked(global.chrome.runtime.sendMessage).mockImplementation((...args: unknown[]) => {
      const cb = args[args.length - 1] as (res: ExtensionMessageResponse) => void;
      cb(mockResponse);
      return Promise.resolve();
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Other Security Factors')).toBeInTheDocument();
    });

    expect(screen.queryByText('Threat Intelligence')).not.toBeInTheDocument();
    expect(screen.getByText('Connection is encrypted')).toBeInTheDocument();
  });
});
