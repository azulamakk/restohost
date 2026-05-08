import React, { useState } from 'react';
import HealthOverview from './views/HealthOverview.tsx';
import ErrorTickets from './views/ErrorTickets.tsx';
import Opportunities from './views/Opportunities.tsx';
import SentimentView from './views/SentimentAnalysis.tsx';

type View = 'health' | 'tickets' | 'opportunities' | 'sentiment';

const NAV_ITEMS: { id: View; label: string; icon: string }[] = [
  { id: 'health', label: 'Health Overview', icon: '📊' },
  { id: 'tickets', label: 'Errors & Tickets', icon: '🎫' },
  { id: 'opportunities', label: 'Opportunities', icon: '🚀' },
  { id: 'sentiment', label: 'Sentiment', icon: '🧠' },
];

export default function App() {
  const [view, setView] = useState<View>('health');

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center text-white font-bold text-sm">
            RH
          </div>
          <div>
            <span className="font-semibold text-gray-900 text-sm">RestoHost</span>
            <span className="text-gray-400 text-sm ml-1.5">AI Monitor</span>
          </div>
        </div>
        <div className="text-xs text-gray-400">
          Dataset: March 2026 · 300 calls · TF Oakwood + RT Buckhead
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="w-52 bg-white border-r border-gray-200 pt-4 flex-shrink-0">
          <nav className="px-3 space-y-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left
                  ${view === item.id
                    ? 'bg-brand-500 text-white'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }`}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>
          <div className="absolute bottom-4 px-6 text-xs text-gray-400">
            <p>Prueba Técnica 2026</p>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto p-6 bg-gray-50">
          {view === 'health' && <HealthOverview />}
          {view === 'tickets' && <ErrorTickets />}
          {view === 'opportunities' && <Opportunities />}
          {view === 'sentiment' && <SentimentView />}
        </main>
      </div>
    </div>
  );
}

