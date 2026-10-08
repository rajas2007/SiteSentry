import React, { useState } from 'react';
import { LayoutGrid, History, BarChart3, Settings, Search, Sparkles } from 'lucide-react';
import { BrandWordmark } from './primitives';

const nav = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'history', label: 'Scan History', icon: History },
  { id: 'analytics', label: 'Threat Analytics', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const;

export function ConsoleShell({
  activeTab,
  setActiveTab,
  onQuickScan,
  isBackendConnected,
  children,
}: {
  activeTab: 'overview' | 'history' | 'analytics' | 'settings';
  setActiveTab: (tab: 'overview' | 'history' | 'analytics' | 'settings') => void;
  onQuickScan: (url: string) => void;
  isBackendConnected: boolean;
  children: React.ReactNode;
}) {
  const [searchInput, setSearchInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      onQuickScan(searchInput.trim());
      setSearchInput('');
    }
  };

  return (
    <div className="blueprint min-h-screen text-foreground lg:grid lg:grid-cols-[216px_minmax(0,1fr)]">
      <aside className="relative z-10 border-b border-border bg-background/85 text-primary-foreground lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex min-h-[72px] items-center border-b border-border/70 px-4 py-3.5 lg:px-5 lg:py-5">
          <BrandWordmark className="w-[156px] lg:w-[166px]" />
          <div className="ml-2 flex items-center gap-1.5 text-[0.65rem] text-muted-foreground lg:hidden">
            <span className={`h-1.5 w-1.5 rounded-full ${isBackendConnected ? 'bg-safe' : 'bg-caution'}`} />
            {isBackendConnected ? 'Online' : 'Offline'}
          </div>
        </div>

        <nav aria-label="Dashboard navigation" className="grid grid-cols-4 gap-1 px-2 py-2 lg:flex lg:flex-col lg:px-3 lg:py-4">
          {nav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={`relative flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 border-b-2 px-1.5 py-2 text-[10px] font-medium transition-colors lg:min-h-11 lg:flex-row lg:justify-start lg:gap-3 lg:border-b-0 lg:border-l-2 lg:px-3 lg:text-sm ${
                activeTab === id
                  ? 'border-analysis bg-secondary/55 text-heading'
                  : 'border-transparent text-muted-foreground hover:bg-secondary/35 hover:text-heading'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </nav>
        
        <div className="mt-auto hidden border-t border-border/70 p-4 lg:block">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className={`h-2 w-2 rounded-full ${isBackendConnected ? 'bg-safe shadow-[0_0_8px_var(--safe)]' : 'bg-caution shadow-[0_0_8px_var(--caution)]'}`} />
            <span>{isBackendConnected ? 'API & Redis Online' : 'Standalone Mode'}</span>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex flex-col h-screen overflow-y-auto">
        <header className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-4 border-b border-border/70 bg-background/80 backdrop-blur-md px-4 py-4 sm:px-6 lg:px-8">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold tracking-tight text-heading sm:text-2xl capitalize">
              {activeTab === 'analytics' ? 'Threat Analytics' : activeTab === 'history' ? 'Scan History' : activeTab}
            </h1>
          </div>
          
          <form onSubmit={handleSubmit} className="flex-1 max-w-[440px] min-w-[240px]">
            <div className="relative flex items-center">
              <Search className="absolute left-3 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Analyze any URL or domain..."
                className="w-full rounded-full border border-border/80 bg-background/50 py-1.5 pl-9 pr-20 text-sm text-heading placeholder:text-muted-foreground focus:border-analysis focus:bg-background focus:outline-none focus:ring-2 focus:ring-analysis/20 transition-all"
              />
              <button
                type="submit"
                className="absolute right-1 top-1 bottom-1 flex items-center justify-center gap-1.5 rounded-full bg-analysis px-3 text-[10px] font-semibold text-analysis-foreground hover:bg-analysis/90 transition-colors"
                style={{ color: '#0f172a', cursor: 'pointer' }}
              >
                <Sparkles className="h-3 w-3" /> Scan
              </button>
            </div>
          </form>
        </header>
        <main id="main-content" className="flex-1 w-full max-w-[1500px] mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
