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
    return <div className="p-4 w-80 text-center bg-[#07090e] text-slate-300">Loading analysis...</div>;
  }

  if (error) {
    return (
      <div className="p-4 w-80 bg-[#07090e] text-slate-200 border border-slate-800">
        <h2 className="font-bold text-rose-400 mb-2">Analysis Unavailable</h2>
        <p className="text-sm text-slate-400">{error}</p>
        <p className="text-xs text-slate-500 mt-4">The Site Sentry analysis service could not be reached or has not processed this page.</p>
      </div>
    );
  }

  if (!analysis) return null;

  const { decision, score, confidence, threat_category, recommendations, factors } = analysis;
  
  const bgColors: Record<string, string> = {
    emerald: 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300',
    amber: 'bg-amber-950/40 border-amber-500/30 text-amber-300',
    rose: 'bg-rose-950/40 border-rose-500/30 text-rose-300',
    slate: 'bg-slate-900/60 border-slate-700/50 text-slate-300'
  };
  
  const themeClass = bgColors[decision.ui.color] || bgColors.slate;

  return (
    <div className="w-80 font-sans flex flex-col bg-[#07090e] text-slate-100 border border-slate-800 shadow-2xl">
      <header className={`p-4 border-b-2 ${themeClass}`}>
        <div className="flex items-center justify-between">
          <h1 className="text-sm font-bold tracking-wider uppercase text-slate-100 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            Site Sentry
          </h1>
          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800/80 text-slate-400 border border-slate-700/50">
            v0.1.0
          </span>
        </div>
        <div className="flex justify-between items-end mt-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider">{decision.severity} RISK</p>
            <p className="text-xs text-slate-400 mt-0.5">{threat_category}</p>
          </div>
          <div className="text-right">
            <span className="text-3xl font-black font-mono tracking-tight">{score}</span>
            <span className="text-xs ml-1 text-slate-400">/ 100</span>
          </div>
        </div>
      </header>
      
      <main className="p-4 flex-1 space-y-4 text-xs">
        <section className="bg-slate-900/50 border border-slate-800/80 rounded-lg p-3">
          <div className="flex justify-between items-center mb-1">
            <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Decision Action</h2>
            <span className="text-[10px] font-mono text-cyan-400">Confidence: {Math.round(confidence * 100)}%</span>
          </div>
          <p className="text-sm font-semibold capitalize text-slate-200">{decision.action}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Why this score?</h2>
          
          {analysis.threat_intelligence && analysis.threat_intelligence.sources.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-300">Threat Intelligence</h3>
              <div className="space-y-2">
                {analysis.threat_intelligence.sources.map((source, i) => (
                  <div key={i} className="bg-slate-900/70 border border-slate-800 p-2.5 rounded-lg">
                    <div className="flex justify-between font-medium mb-1">
                      <span className="text-slate-200">{source.provider}</span>
                      <span className={`${source.status === 'detected' ? 'text-rose-400' : source.status === 'clean' ? 'text-emerald-400' : 'text-slate-400'} capitalize font-semibold`}>
                        {source.status}
                      </span>
                    </div>
                    <p className="text-slate-400 text-[11px]">{source.summary}</p>
                    {source.categories && source.categories.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {source.categories.map((cat, j) => (
                          <span key={j} className="bg-rose-950/60 text-rose-300 border border-rose-800/40 px-1.5 py-0.5 rounded text-[10px]">{cat}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-slate-900/40 border border-slate-800/60 p-2.5 rounded-lg">
            <h3 className="text-xs font-semibold text-slate-300 mb-1.5">Other Security Factors</h3>
            <ul className="space-y-1 text-slate-400">
              {factors.map((factor, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-cyan-400">▪</span>
                  <span>{factor}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Recommendations</h2>
          <div className="bg-sky-950/30 border border-sky-800/40 text-sky-200 p-3 rounded-lg text-xs">
            <ul className="space-y-1.5 list-disc list-inside">
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
