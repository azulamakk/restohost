import React, { useEffect, useState } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, ReferenceLine, Legend,
} from 'recharts';
import type { PatternAnalysis, ForecastResult, AssistantAdjustment } from '../types.ts';

const PRIORITY_COLORS = ['#ea580c', '#f97316', '#7c3aed', '#0f172a'];

function OpportunityCard({
  opportunity,
  color,
  priority,
  forceExpanded = false,
}: {
  opportunity: PatternAnalysis['opportunities'][0];
  color: string;
  priority: number;
  forceExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (forceExpanded) setExpanded(true);
  }, [forceExpanded]);

  const isOpen = expanded;

  return (
    <div className={`bg-white border rounded-xl overflow-hidden transition-all ${forceExpanded ? 'border-brand-400 ring-1 ring-brand-300' : 'border-gray-200'}`}>
      <div
        className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start gap-3">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 mt-0.5"
            style={{ background: color }}
          >
            {priority}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-gray-900">{opportunity.title}</h3>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                  {opportunity.affectedCalls} calls
                </span>
                <span className="text-gray-400 text-xs">{isOpen ? '▲' : '▼'}</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{opportunity.description}</p>
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Evidence</p>
            <p className="text-sm text-gray-700">{opportunity.evidence}</p>
          </div>
          <div className="bg-gray-900 rounded-lg p-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Estimated monthly impact</p>
            <p className="text-sm text-gray-100">{opportunity.estimatedMonthlyImpact}</p>
          </div>
          <div className="bg-brand-50 border border-brand-100 rounded-lg p-3">
            <p className="text-xs font-semibold text-brand-700 uppercase tracking-wide mb-1">Proposed fix</p>
            <p className="text-sm text-brand-800">{opportunity.proposedFix}</p>
          </div>
          <div className="flex gap-4 text-xs text-gray-500">
            <span>Impact: <strong className="text-gray-800">{opportunity.impactScore}/10</strong></span>
            <span>Effort: <strong className="text-gray-800">{opportunity.effortScore}/10</strong></span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Opportunities() {
  const [patterns, setPatterns] = useState<PatternAnalysis | null>(null);
  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeOpp, setActiveOpp] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/patterns').then((r) => r.json()),
      fetch('/api/forecast').then((r) => r.json()),
    ])
      .then(([p, f]) => {
        if (p.error) setError(p.error);
        else if (f.error) setError(f.error);
        else {
          setPatterns(p as PatternAnalysis);
          setForecast(f as ForecastResult);
        }
      })
      .catch((e) => setError(String(e)));
  }, []);

  if (error) {
    return (
      <div className="bg-gray-900 border border-brand-500 rounded-xl p-6 text-white">
        <strong>Pipeline output not found.</strong>{' '}
        Run <code className="bg-gray-800 px-1 rounded text-brand-400">npm run pipeline</code> first.
      </div>
    );
  }

  if (!patterns || !forecast) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Loading…</div>;
  }

  const transferRateByHour = Object.entries(patterns.temporalPatterns.transferRateByHour)
    .sort(([a], [b]) => Number(a) - Number(b))
    .filter(([h]) => Number(h) >= 8)
    .map(([h, rate]) => ({
      hour: `${h}:00`,
      transferRate: Math.round(Number(rate) * 100),
    }));

  const scatterData = patterns.opportunities.map((o) => ({
    x: o.effortScore,
    y: o.impactScore,
    label: `O${o.priority}`,
    title: o.title,
    calls: o.affectedCalls,
    priority: o.priority,
  }));

  const forecastData = (forecast.dailyForecasts ?? []).map((d) => ({
    day: d.dayOfWeek.slice(0, 3),
    predicted: d.predictedVolume,
    historical: d.historicalAvg,
  }));

  const renderDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (cx === undefined || cy === undefined) return <g />;
    const color = PRIORITY_COLORS[(payload.priority || 1) - 1] ?? '#94a3b8';
    const isActive = activeOpp === null || activeOpp === payload.priority;
    return (
      <g
        onClick={() => setActiveOpp(p => p === payload.priority ? null : payload.priority)}
        style={{ cursor: 'pointer' }}
      >
        <circle cx={cx} cy={cy} r={20} fill={color} fillOpacity={isActive ? 0.9 : 0.25} />
        <text
          x={cx} y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          fill="white"
          fontSize={12}
          fontWeight="bold"
        >
          {payload.label}
        </text>
      </g>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Improvement Opportunities</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {patterns.opportunities.length} prioritized opportunities · Sorted by operational impact
        </p>
      </div>

      {/* Opportunity cards */}
      <div className="space-y-3">
        {patterns.opportunities.map((opp, i) => (
          <OpportunityCard
            key={opp.id}
            opportunity={opp}
            color={PRIORITY_COLORS[i] ?? '#94a3b8'}
            priority={i + 1}
            forceExpanded={activeOpp === i + 1}
          />
        ))}
      </div>

      {/* KB Gaps */}
      {patterns.kbGaps.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Knowledge Base Gaps</h2>
          <div className="space-y-2">
            {patterns.kbGaps.map((gap, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <span className="text-base">📋</span>
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {gap.topic}
                    <span className={`ml-2 text-xs font-normal ${gap.restaurant === 'TF Oakwood' ? 'text-brand-600' : 'text-accent-600'}`}>
                      {gap.restaurant}
                    </span>
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{gap.description}</p>
                </div>
                <span className="ml-auto text-xs text-gray-400 flex-shrink-0">{gap.callCount} calls</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Impact vs effort — clickable dots */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-1">Impact vs Effort</h2>
          <p className="text-xs text-gray-400 mb-3">Click a dot to expand its opportunity card above</p>
          <ResponsiveContainer width="100%" height={240}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                type="number"
                dataKey="x"
                name="Effort"
                domain={[0, 11]}
                label={{ value: 'Effort →', position: 'insideBottom', offset: -5, fontSize: 11, fill: '#94a3b8' }}
                tick={{ fontSize: 10 }}
                tickLine={false}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Impact"
                domain={[0, 11]}
                label={{ value: 'Impact ↑', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#94a3b8' }}
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                content={({ payload }: any) => {
                  const d = payload?.[0]?.payload;
                  if (!d) return null;
                  return (
                    <div className="bg-gray-900 text-white rounded-lg px-3 py-2 text-xs shadow-lg max-w-48">
                      <p className="font-semibold">{d.label}</p>
                      <p className="text-gray-300 mt-0.5 line-clamp-2">{d.title}</p>
                      <p className="text-gray-400 mt-1">{d.calls} affected calls</p>
                      <p className="text-brand-400 mt-1">Impact {d.y}/10 · Effort {d.x}/10</p>
                      <p className="text-gray-400 mt-1">Click to expand card ↑</p>
                    </div>
                  );
                }}
              />
              <Scatter data={scatterData} shape={renderDot} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Transfer rate by hour */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-1">Transfer Rate by Hour</h2>
          <p className="text-xs text-gray-400 mb-3">Orange = above 70% threshold</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={transferRateByHour} barSize={14} margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="hour" tick={{ fontSize: 9 }} tickLine={false} />
              <YAxis
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}%`}
                domain={[0, 100]}
              />
              <ReferenceLine
                y={70}
                stroke="#f97316"
                strokeDasharray="4 4"
                label={{ value: '70%', position: 'insideTopRight', fontSize: 10, fill: '#f97316' }}
              />
              <Tooltip
                content={({ active, payload }: any) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-gray-900 text-white rounded-lg px-3 py-2 text-xs shadow-lg">
                      <p className="font-semibold">{d.hour}</p>
                      <p className={d.transferRate > 70 ? 'text-brand-400' : d.transferRate > 50 ? 'text-accent-300' : 'text-gray-300'}>
                        {d.transferRate}% transfer rate
                      </p>
                      {d.transferRate > 70 && <p className="text-brand-400 mt-1">Above 70% threshold</p>}
                    </div>
                  );
                }}
              />
              <Bar dataKey="transferRate" name="Transfer rate" radius={[3, 3, 0, 0]}>
                {transferRateByHour.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.transferRate > 70 ? '#f97316' : entry.transferRate > 50 ? '#7c3aed' : '#1e293b'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Forecast */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">
            Next Week Forecast
            <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded border border-gray-200 font-normal normal-case">
              Confidence: {forecast.confidenceLevel}
            </span>
          </h2>
          <span className="text-xs text-gray-400">{forecast.forecastWeek}</span>
        </div>

        <div className="bg-gray-900 border-l-4 border-brand-500 rounded-lg p-3 text-xs text-gray-300">
          ⚠️ <strong className="text-white">Limitation:</strong> {forecast.caveat}
        </div>

        {/* Per-restaurant cards */}
        {forecast.byRestaurant && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {Object.entries(forecast.byRestaurant).map(([name, data]) => {
              const isOakwood = name.includes('Oakwood');
              const borderColor = isOakwood ? 'border-orange-400' : 'border-violet-400';
              const textColor   = isOakwood ? 'text-orange-600' : 'text-violet-600';
              return (
                <div key={name} className={`bg-white rounded-xl border-2 ${borderColor} p-4`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-sm font-bold ${textColor}`}>{name}</span>
                    <span className="text-xs text-gray-400">
                      ~{data.predictedWeeklyTotal} calls · peak: {data.peakDay}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {data.topMotives.map(m => (
                      <span
                        key={m.category}
                        className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-medium"
                      >
                        {m.category} {m.pct}%
                      </span>
                    ))}
                  </div>
                  {/* Mini daily volume bar */}
                  <div className="mt-3 flex items-end gap-1 h-8">
                    {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(day => {
                      const vol = data.dailyVolumes[day] ?? 0;
                      const maxVol = Math.max(...Object.values(data.dailyVolumes), 1);
                      const heightPct = (vol / maxVol) * 100;
                      return (
                        <div key={day} className="flex-1 flex flex-col items-center gap-0.5">
                          <div
                            className="w-full rounded-sm"
                            style={{
                              height: `${heightPct}%`,
                              background: isOakwood ? '#f97316' : '#8b5cf6',
                              opacity: 0.7,
                              minHeight: vol > 0 ? 3 : 0,
                            }}
                          />
                          <span className="text-gray-400" style={{ fontSize: 8 }}>{day.slice(0, 1)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Combined volume chart */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Combined weekly volume — predicted vs historical avg
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={forecastData} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip
                content={({ active, payload, label }: any) => {
                  if (!active || !payload?.length) return null;
                  const predicted = payload.find((p: any) => p.dataKey === 'predicted')?.value;
                  const historical = payload.find((p: any) => p.dataKey === 'historical')?.value;
                  const diff = predicted - historical;
                  return (
                    <div className="bg-gray-900 text-white rounded-lg px-3 py-2 text-xs shadow-lg">
                      <p className="font-semibold">{label}</p>
                      <p className="text-brand-400">{predicted} predicted calls</p>
                      <p className="text-gray-400">{historical} historical avg</p>
                      <p className={diff >= 0 ? 'text-brand-300 mt-1' : 'text-accent-300 mt-1'}>
                        {diff >= 0 ? '↑' : '↓'} {Math.abs(diff)} vs avg
                      </p>
                    </div>
                  );
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                formatter={(v) => v === 'predicted' ? 'Predicted' : 'Historical avg'}
              />
              <Bar dataKey="predicted" name="predicted" fill="#f97316" radius={[4, 4, 0, 0]} />
              <Bar dataKey="historical" name="historical" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Assistant adjustments */}
        {forecast.assistantAdjustments?.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                Assistant config — changes to make before the week starts
              </p>
              <span className="text-xs text-gray-400">{forecast.assistantAdjustments.length} items</span>
            </div>
            <div className="space-y-3">
              {forecast.assistantAdjustments.map((adj: AssistantAdjustment, i: number) => {
                const borderColor = adj.priority === 'HIGH' ? 'border-orange-400' : adj.priority === 'MEDIUM' ? 'border-violet-400' : 'border-gray-300';
                const badgeBg    = adj.priority === 'HIGH' ? 'bg-orange-600' : adj.priority === 'MEDIUM' ? 'bg-violet-600' : 'bg-gray-400';
                const restColor  = adj.restaurant === 'TF Oakwood' ? 'bg-orange-50 text-orange-700' : adj.restaurant === 'RT Buckhead' ? 'bg-violet-50 text-violet-700' : 'bg-gray-100 text-gray-600';
                return (
                  <div key={i} className={`border-l-4 ${borderColor} pl-3 py-2 rounded-r-lg bg-gray-50`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold text-white px-1.5 py-0.5 rounded ${badgeBg}`}>
                        {adj.priority}
                      </span>
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${restColor}`}>
                        {adj.restaurant}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 italic mb-1">{adj.trigger}</p>
                    <p className="text-xs text-gray-800 leading-relaxed">{adj.action}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Operational checks */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Operational checks</p>
          <ul className="space-y-1.5">
            {forecast.preventiveRecommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                <span className="text-brand-500 mt-0.5 flex-shrink-0 font-bold">→</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
