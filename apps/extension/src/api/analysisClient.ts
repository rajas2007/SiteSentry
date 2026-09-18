import { PageAnalysisRequest, PageAnalysisResponse } from '@site-sentry/shared-types';

// For local MVP development, we use the local FastAPI server.
// Do NOT hardcode production URLs here for the final build.
const API_BASE_URL = (import.meta as { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL || 'http://localhost:8000';

export async function submitAnalysis(request: PageAnalysisRequest): Promise<PageAnalysisResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Authorization would be added here in the future
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
