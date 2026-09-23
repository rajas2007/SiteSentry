import { describe, it, expect, vi, beforeEach } from 'vitest';
import { submitAnalysis } from './analysisClient';
import { PageAnalysisRequest } from '@site-sentry/shared-types';

describe('Analysis Client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('should serialize payload including privacy fields', async () => {
    const mockRequest: PageAnalysisRequest = {
      url: 'https://example.com',
      title: 'Test',
      hostname: 'example.com',
      features: {
        hasPasswordField: false,
        hasLoginForm: false,
        formCount: 0,
        externalLinkCount: 0,
        iframeCount: 0,
        scriptCount: 0,
        imageCount: 0,
        suspiciousKeywords: [],
        pageTextLength: 100,
        hasHttps: true,
        hostnameLength: 11,
        subdomainCount: 0,
      },
      privacy_policy_text: 'We sell your data',
      third_party_cookie_count: undefined,
    };

    const fetchMock = vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ score: 100 }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    await submitAnalysis(mockRequest);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const callArgs = fetchMock.mock.calls[0];
    const options = callArgs[1];
    
    expect(options?.body).toBeDefined();
    const body = JSON.parse(options?.body as string);
    expect(body.privacy_policy_text).toBe('We sell your data');
    expect(body.third_party_cookie_count).toBeUndefined(); // undefined is stripped by JSON.stringify but that's fine
  });
});
