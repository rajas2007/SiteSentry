import { useEffect, useState } from 'react';
import { ExtensionMessageResponse, PageAnalysisResponse } from '@site-sentry/shared-types';

export default function App() {
  const [analysis, setAnalysis] = useState<PageAnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_CURRENT_ANALYSIS' }, (response: ExtensionMessageResponse) => {
      setLoading(false);
      if (response?.status === 'SUCCESS') {
        setAnalysis(response.data);
      } else if (response?.status === 'ERROR') {
        setError(response.error);
      } else {
        setError('No analysis available for this page.');
      }
    });
  }, []);

  if (loading) {
    return <div className="p-4 w-80 text-center">Loading analysis...</div>;
  }

  if (error) {
    return (
      <div className="p-4 w-80">
        <h2 className="font-bold text-red-600 mb-2">Analysis Unavailable</h2>
        <p className="text-sm text-gray-700">{error}</p>
        <p className="text-xs text-gray-500 mt-4">The Site Sentry analysis service could not be reached or has not processed this page.</p>
      </div>
    );
  }

  if (!analysis) return null;

  const { decision, score, confidence, threat_category, recommendations, factors } = analysis;
  
  const bgColors = {
    emerald: 'bg-emerald-100 border-emerald-500 text-emerald-900',
    amber: 'bg-amber-100 border-amber-500 text-amber-900',
    rose: 'bg-rose-100 border-rose-500 text-rose-900',
    slate: 'bg-slate-100 border-slate-500 text-slate-900'
  };
  
  const themeClass = bgColors[decision.ui.color] || bgColors.slate;

  return (
    <div className="w-80 font-sans flex flex-col bg-white">
      <header className={`p-4 border-b-4 ${themeClass}`}>
        <h1 className="text-lg font-bold">Site Sentry</h1>
        <div className="flex justify-between items-end mt-2">
          <div>
            <p className="text-sm font-semibold uppercase">{decision.severity} RISK</p>
            <p className="text-xs opacity-80">{threat_category}</p>
          </div>
          <div className="text-right">
            <span className="text-3xl font-black">{score}</span>
            <span className="text-xs ml-1 opacity-80">/ 100</span>
          </div>
        </div>
      </header>
      
      <main className="p-4 flex-1">
        <section className="mb-4">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Decision</h2>
          <p className="text-sm font-medium capitalize text-gray-800">{decision.action}</p>
          <div className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded">
            Confidence: {Math.round(confidence * 100)}%
          </div>
        </section>

        <section className="mb-4">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Key Factors</h2>
          <ul className="text-sm space-y-1">
            {factors.map((factor, i) => (
              <li key={i} className="flex items-start">
                <span className="mr-2 text-gray-400">•</span>
                <span className="text-gray-700">{factor}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Recommendations</h2>
          <div className="bg-blue-50 text-blue-900 p-3 rounded text-sm">
            <ul className="space-y-2">
              {recommendations.map((rec, i) => (
                <li key={i}>{rec}</li>
              ))}
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}
