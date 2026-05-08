import React, { useEffect, useRef, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, Cell, ComposedChart, Line, Legend,
  LabelList, ReferenceLine,
} from 'recharts';
import type { SentimentAnalysis } from '../types.ts';

type ScatterPoint = {
  x: number; y: number; isResolved: boolean; isError: boolean;
  callEndReason: string; emotion: string; conversationId: string; restaurant: string;
};

const C_ORANGE = '#f97316';
const C_PURPLE = '#8b5cf6';
const C_DARK   = '#0f172a';
const C_GRAY   = '#94a3b8';
const C_GREEN  = '#22c55e';

const EMOTION_COLOR: Record<string, string> = {
  FRUSTRATED: C_ORANGE,
  SATISFIED:  C_GREEN,
  IMPATIENT:  C_PURPLE,
  CONFUSED:   C_GRAY,
  NEUTRAL:    C_DARK,
};

const EMOTION_LABEL: Record<string, string> = {
  FRUSTRATED: 'Frustrated',
  SATISFIED:  'Satisfied',
  IMPATIENT:  'Impatient',
  CONFUSED:   'Confused',
  NEUTRAL:    'Neutral',
};

const BUCKET_COLOR: Record<string, string> = {
  'Very Negative': '#b91c1c',
  'Negative':      C_ORANGE,
  'Neutral':       C_DARK,
  'Positive':      C_PURPLE,
  'Very Positive': C_GREEN,
};

function ScoreBar({ score }: { score: number }) {
  const pct = ((score + 1) / 2) * 100;
  const color = score > 0.1 ? C_ORANGE : score < -0.1 ? C_PURPLE : C_GRAY;
  return (
    <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden w-full">
      <div className="absolute top-0 bottom-0 left-1/2 w-px bg-gray-300 z-10" />
      <div
        className="absolute top-0 bottom-0 rounded-full transition-all"
        style={{
          left:  score >= 0 ? '50%' : `${pct}%`,
          right: score <  0 ? '50%' : `${100 - pct}%`,
          backgroundColor: color,
        }}
      />
    </div>
  );
}

function KpiCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-2">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{title}</p>
      {children}
    </div>
  );
}

interface MotiveCardProps {
  group: SentimentAnalysis['motiveGroups'][0];
  totalCalls: number;
}

function MotiveCard({ group, totalCalls: _ }: MotiveCardProps) {
  const [expanded, setExpanded] = useState(false);
  const sentimentColor = group.avgSentimentScore > 0.1 ? C_ORANGE : group.avgSentimentScore < -0.1 ? C_PURPLE : C_GRAY;
  const sentimentEmoji = group.avgSentimentScore > 0.1 ? '😊' : group.avgSentimentScore < -0.1 ? '😠' : '😐';
  const positivePct = group.emotionDist['SATISFIED'] ?? 0;
  const negativePct = (group.emotionDist['FRUSTRATED'] ?? 0) + (group.emotionDist['IMPATIENT'] ?? 0);
  const neutralPct = group.count - positivePct - negativePct;

  const tfCount = group.byRestaurant['TF Oakwood'] ?? 0;
  const rtCount = group.byRestaurant['RT Buckhead'] ?? 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{sentimentEmoji}</span>
          <div>
            <p className="font-semibold text-gray-900 text-sm">{group.category}</p>
            <p className="text-xs text-gray-400">{group.count} calls · {group.pct}% of total</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="text-xs font-bold px-2 py-1 rounded-full"
            style={{ background: `${sentimentColor}20`, color: sentimentColor }}
          >
            {group.avgSentimentScore > 0 ? '+' : ''}{group.avgSentimentScore.toFixed(2)}
          </span>
          <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-700">
            {Math.round(group.successRate * 100)}% resolved
          </span>
          <span className="text-gray-400 text-sm">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-4">
          {/* Sentiment bar */}
          <div>
            <p className="text-xs text-gray-500 mb-1 font-medium">Sentiment distribution</p>
            <div className="flex h-3 rounded-full overflow-hidden gap-px">
              {positivePct > 0 && (
                <div style={{ flex: positivePct, background: C_GREEN }} title={`Satisfied: ${positivePct}`} />
              )}
              {neutralPct > 0 && (
                <div style={{ flex: neutralPct, background: C_DARK }} title={`Neutral: ${neutralPct}`} />
              )}
              {negativePct > 0 && (
                <div style={{ flex: negativePct, background: C_ORANGE }} title={`Frustrated/Impatient: ${negativePct}`} />
              )}
            </div>
            <div className="flex gap-3 mt-1">
              <span className="text-xs text-gray-400">
                <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: C_GREEN }} />
                {positivePct} satisfied
              </span>
              <span className="text-xs text-gray-400">
                <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: C_DARK }} />
                {neutralPct} neutral
              </span>
              <span className="text-xs text-gray-400">
                <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: C_ORANGE }} />
                {negativePct} negative
              </span>
            </div>
          </div>

          {/* By restaurant */}
          <div>
            <p className="text-xs text-gray-500 mb-2 font-medium">By restaurant</p>
            <div className="flex gap-3">
              <div className="flex-1 flex items-center gap-2">
                <div className="h-2 rounded-full flex-1 bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(tfCount / group.count) * 100}%`, background: C_ORANGE }}
                  />
                </div>
                <span className="text-xs text-orange-600 font-medium w-16">TF {tfCount}</span>
              </div>
              <div className="flex-1 flex items-center gap-2">
                <div className="h-2 rounded-full flex-1 bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(rtCount / group.count) * 100}%`, background: C_PURPLE }}
                  />
                </div>
                <span className="text-xs text-violet-600 font-medium w-16">RT {rtCount}</span>
              </div>
            </div>
          </div>

          {/* Emotion breakdown */}
          <div>
            <p className="text-xs text-gray-500 mb-2 font-medium">Emotion breakdown</p>
            <div className="space-y-1">
              {Object.entries(group.emotionDist)
                .sort((a, b) => b[1] - a[1])
                .map(([emotion, count]) => (
                  <div key={emotion} className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 w-20">{EMOTION_LABEL[emotion] ?? emotion}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(count / group.count) * 100}%`,
                          background: EMOTION_COLOR[emotion] ?? C_GRAY,
                        }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-6 text-right">{count}</span>
                  </div>
                ))}
            </div>
          </div>

          {/* Examples */}
          {group.examples.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-2 font-medium">Example call reasons</p>
              <div className="space-y-1">
                {group.examples.map((ex, i) => (
                  <p key={i} className="text-xs text-gray-700 bg-gray-50 rounded px-3 py-1.5 italic">
                    "{ex}"
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Avg duration */}
          <div className="flex gap-6 pt-1">
            <div>
              <p className="text-xs text-gray-400">Avg duration</p>
              <p className="text-sm font-semibold text-gray-900">{group.avgDuration}s</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Error rate</p>
              <p className="text-sm font-semibold" style={{ color: group.errorRate > 0.3 ? C_ORANGE : C_DARK }}>
                {Math.round(group.errorRate * 100)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Success rate</p>
              <p className="text-sm font-semibold text-green-600">
                {Math.round(group.successRate * 100)}%
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ConversationPanel({
  conversationId, conversation, emotion, score, loading, onClose,
}: {
  conversationId: string; conversation: string; emotion: string;
  score: number; loading: boolean; onClose: () => void;
}) {
  const turns = conversation.split('\n').filter(l => l.trim());
  return (
    <div className="mt-4 border border-gray-200 rounded-xl overflow-hidden">
      <div className="bg-gray-900 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-white font-semibold text-sm">{conversationId}</span>
          <span className="text-xs text-gray-400">
            {EMOTION_LABEL[emotion] ?? emotion} · score {score > 0 ? '+' : ''}{score.toFixed(2)}
          </span>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-xs">✕ close</button>
      </div>
      <div className="max-h-96 overflow-y-auto p-4 bg-gray-50 space-y-2">
        {loading && (
          <p className="text-xs text-gray-400 text-center py-8">Loading conversation…</p>
        )}
        {!loading && turns.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-8">No transcript available.</p>
        )}
        {!loading && turns.map((turn, i) => {
          const isCustomer = /^customer:/i.test(turn);
          const isAgent    = /^agent:/i.test(turn);
          const text = turn.replace(/^(customer|agent):\s*/i, '');
          if (!isCustomer && !isAgent) {
            return <p key={i} className="text-xs text-gray-400 italic">{turn}</p>;
          }
          return (
            <div key={i} className={`flex gap-2 ${isCustomer ? 'flex-row-reverse' : 'flex-row'}`}>
              <span className={`text-xs font-semibold px-2 py-1 rounded self-start flex-shrink-0 ${isCustomer ? 'bg-orange-100 text-orange-700' : 'bg-gray-200 text-gray-600'}`}>
                {isCustomer ? 'Customer' : 'Agent'}
              </span>
              <p className={`text-xs px-3 py-2 rounded-lg max-w-lg leading-relaxed ${isCustomer ? 'bg-orange-50 text-gray-800' : 'bg-white text-gray-700 border border-gray-200'}`}>
                {text}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const DOW_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function SentimentView() {
  const [data, setData] = useState<SentimentAnalysis | null>(null);
  const [activeScatter, setActiveScatter] = useState<ScatterPoint | null>(null);
  const [showConversation, setShowConversation] = useState(false);
  const [loadingConv, setLoadingConv] = useState(false);
  const callsMapRef = useRef<Record<string, string> | null>(null);
  const [callsMapReady, setCallsMapReady] = useState(false);

  useEffect(() => {
    fetch('/api/sentiment')
      .then(r => r.json())
      .then(setData)
      .catch(console.error);
  }, []);

  function handleShowConversation() {
    setShowConversation(true);
    if (callsMapRef.current) return;
    setLoadingConv(true);
    fetch('/api/calls')
      .then(r => r.json())
      .then((calls: Array<{ conversationId: string; conversation: string }>) => {
        const map: Record<string, string> = {};
        for (const c of calls) map[c.conversationId] = c.conversation ?? '';
        callsMapRef.current = map;
        setCallsMapReady(true);
      })
      .catch(console.error)
      .finally(() => setLoadingConv(false));
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400 text-sm">Loading sentiment analysis…</p>
      </div>
    );
  }

  // KPI: mood-outcome match rate
  // "match" = positive sentiment → resolved, or negative sentiment → not resolved
  const matches = data.callSentiments.filter(c => {
    const pos = c.sentimentScore > 0.1;
    const neg = c.sentimentScore < -0.1;
    return (pos && c.isResolved) || (neg && !c.isResolved);
  }).length;
  const matchRate = Math.round((matches / data.totalCalls) * 100);

  // Most resolved motive
  const topResolvedMotive = [...data.motiveGroups]
    .filter(g => g.count >= 5)
    .sort((a, b) => b.successRate - a.successRate)[0];

  // Outcome chart data
  const outcomeData = data.sentimentOutcomes
    .filter(b => b.count > 0)
    .map(b => ({
      bucket: b.bucket,
      'Resolved %': Math.round(b.resolvedRate * 100),
      'Transferred %': Math.round(b.transferRate * 100),
      'Error %': Math.round(b.errorRate * 100),
      count: b.count,
    }));

  // Scatter data
  const scatterData = data.callSentiments.map(c => ({
    x: c.sentimentScore,
    y: c.durationSeconds,
    isResolved: c.isResolved,
    isError: c.isError,
    callEndReason: c.callEndReason,
    emotion: c.emotion,
    conversationId: c.conversationId,
    restaurant: c.restaurantName,
  }));

  // Hourly chart
  const hourlyData = Object.entries(data.byHour)
    .map(([h, v]) => ({ hour: `${h}:00`, avgScore: v.avgScore, count: v.count }))
    .sort((a, b) => parseInt(a.hour) - parseInt(b.hour));

  // DOW chart
  const dowData = Object.entries(data.byDayOfWeek)
    .map(([d, v]) => ({ day: DOW_LABEL[parseInt(d)] ?? d, avgScore: v.avgScore, count: v.count, dow: parseInt(d) }))
    .sort((a, b) => a.dow - b.dow);

  // Restaurant data
  const restaurants = Object.entries(data.byRestaurant);

  // Key insight text
  const veryNeg = data.sentimentOutcomes.find(b => b.bucket === 'Very Negative');
  const veryPos = data.sentimentOutcomes.find(b => b.bucket === 'Very Positive');
  const negTransfer = veryNeg ? Math.round(veryNeg.transferRate * 100) : 0;
  const posResolved = veryPos ? Math.round(veryPos.resolvedRate * 100) : 0;

  return (
    <div className="space-y-8 pb-12">

      {/* ── Header ───────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sentiment Analysis</h1>
        <p className="text-sm text-gray-400 mt-1">
          Rule-based analysis of {data.totalCalls} calls · keyword matching on customer transcript turns
        </p>
      </div>

      {/* ── KPI Row ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Avg Sentiment Score">
          <p
            className="text-3xl font-bold"
            style={{ color: data.avgScore > 0 ? C_ORANGE : data.avgScore < 0 ? C_PURPLE : C_GRAY }}
          >
            {data.avgScore > 0 ? '+' : ''}{data.avgScore.toFixed(2)}
          </p>
          <ScoreBar score={data.avgScore} />
          <p className="text-xs text-gray-400">
            {data.distribution.positive} pos · {data.distribution.neutral} neutral · {data.distribution.negative} neg
          </p>
        </KpiCard>

        <KpiCard title="Top Emotion">
          {data.topEmotions.slice(0, 3).map(e => (
            <div key={e.emotion} className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: EMOTION_COLOR[e.emotion] ?? C_GRAY }}
              />
              <span className="text-xs font-semibold text-gray-800">{EMOTION_LABEL[e.emotion] ?? e.emotion}</span>
              <span className="text-xs text-gray-400 ml-auto">{e.count} ({e.pct}%)</span>
            </div>
          ))}
        </KpiCard>

        <KpiCard title="Most Resolved Motive">
          {topResolvedMotive ? (
            <>
              <p className="text-lg font-bold text-gray-900">{topResolvedMotive.category}</p>
              <p className="text-2xl font-bold text-green-600">
                {Math.round(topResolvedMotive.successRate * 100)}%
              </p>
              <p className="text-xs text-gray-400">success rate · {topResolvedMotive.count} calls</p>
            </>
          ) : <p className="text-gray-400 text-sm">N/A</p>}
        </KpiCard>

        <KpiCard title="Mood → Outcome Match">
          <p className="text-3xl font-bold" style={{ color: matchRate > 60 ? C_ORANGE : C_GRAY }}>
            {matchRate}%
          </p>
          <p className="text-xs text-gray-400">
            of calls where sentiment predicted the outcome
          </p>
          <p className="text-xs text-gray-500">
            positive → resolved · negative → not resolved
          </p>
        </KpiCard>
      </div>

      {/* ── Mood → Outcome Link ───────────────────────────────────── */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-4">Mood → Outcome Link</h2>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-xs text-gray-500 mb-4">
            Percentage of calls in each sentiment bucket resolved, transferred, or errored
          </p>
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={outcomeData} layout="vertical" barSize={12} barGap={4} barCategoryGap="38%">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
              <YAxis type="category" dataKey="bucket" width={115} tick={{ fontSize: 12, fill: '#374151' }} />
              <Tooltip
                formatter={(v: number, name: string) => [`${v}%`, name]}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Resolved %" fill={C_GREEN} radius={[0, 4, 4, 0]}>
                <LabelList dataKey="Resolved %" position="insideRight" style={{ fill: '#fff', fontSize: 10, fontWeight: 600 }} formatter={(v: number) => v > 8 ? `${v}%` : ''} />
              </Bar>
              <Bar dataKey="Transferred %" fill={C_ORANGE} radius={[0, 4, 4, 0]}>
                <LabelList dataKey="Transferred %" position="insideRight" style={{ fill: '#fff', fontSize: 10, fontWeight: 600 }} formatter={(v: number) => v > 8 ? `${v}%` : ''} />
              </Bar>
              <Bar dataKey="Error %" fill={C_PURPLE} radius={[0, 4, 4, 0]}>
                <LabelList dataKey="Error %" position="insideRight" style={{ fill: '#fff', fontSize: 10, fontWeight: 600 }} formatter={(v: number) => v > 8 ? `${v}%` : ''} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Key insight callout */}
          <div className="mt-4 bg-gray-900 border-l-4 border-brand-500 rounded-r-xl p-4">
            <p className="text-sm text-white font-medium">
              Key finding: sentiment predicts outcomes
            </p>
            <p className="text-sm text-gray-300 mt-1">
              Calls with very negative sentiment are transferred {negTransfer}% of the time.
              Calls with very positive sentiment resolve at {posResolved}% — a clear correlation
              between how the caller feels and whether the AI can close the loop.
            </p>
          </div>
        </div>
      </section>

      {/* ── Sentiment Scatter ─────────────────────────────────────── */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-4">Sentiment × Duration Scatter</h2>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-xs text-gray-500 mb-1">
            x = sentiment score (−1 to 1) · y = call duration (s) · color = outcome
          </p>
          <div className="flex gap-4 mb-3">
            <span className="text-xs flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: C_GREEN }} /> Resolved
            </span>
            <span className="text-xs flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: C_ORANGE }} /> Transferred
            </span>
            <span className="text-xs flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: C_PURPLE }} /> Error
            </span>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                type="number" dataKey="x" domain={[-1.1, 1.1]} name="Score"
                tick={{ fontSize: 11 }} tickFormatter={v => v.toFixed(1)} label={{ value: 'Sentiment Score', position: 'insideBottom', offset: -2, fontSize: 11, fill: '#94a3b8' }}
              />
              <YAxis
                type="number" dataKey="y" name="Duration"
                tick={{ fontSize: 11 }} label={{ value: 'Duration (s)', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#94a3b8' }}
              />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ payload }) => {
                  if (!payload?.length) return null;
                  const d = payload[0]?.payload;
                  return (
                    <div className="bg-white border border-gray-200 rounded-lg shadow p-3 text-xs space-y-1">
                      <p className="font-semibold text-gray-900">{d.conversationId}</p>
                      <p className="text-gray-500">{d.restaurant}</p>
                      <p>Score: <b>{d.x.toFixed(2)}</b></p>
                      <p>Duration: <b>{d.y}s</b></p>
                      <p>Emotion: <b>{EMOTION_LABEL[d.emotion] ?? d.emotion}</b></p>
                      <p>End: <b>{d.callEndReason}</b></p>
                    </div>
                  );
                }}
              />
              <ReferenceLine x={0} stroke="#e2e8f0" strokeWidth={1.5} />
              <Scatter
                data={scatterData}
                onClick={(d) => {
                  setActiveScatter(d as unknown as ScatterPoint);
                  setShowConversation(false);
                }}
                style={{ cursor: 'pointer' }}
              >
                {scatterData.map((entry, i) => {
                  const isSelected = activeScatter?.conversationId === entry.conversationId;
                  const color = entry.isError ? C_PURPLE : entry.callEndReason === 'CallTransfer' ? C_ORANGE : C_GREEN;
                  return (
                    <Cell key={i} fill={color} fillOpacity={isSelected ? 1 : 0.65} stroke={isSelected ? C_DARK : 'none'} strokeWidth={2} r={isSelected ? 6 : 4} />
                  );
                })}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>

          {activeScatter && (
            <div>
              <div className="mt-3 bg-gray-50 rounded-xl p-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-gray-700">
                <span className="font-mono font-semibold text-gray-900">{activeScatter.conversationId}</span>
                <span>{activeScatter.restaurant}</span>
                <span>Score: <b>{activeScatter.x.toFixed(2)}</b></span>
                <span>Duration: <b>{activeScatter.y}s</b></span>
                <span>Emotion: <b>{EMOTION_LABEL[activeScatter.emotion] ?? activeScatter.emotion}</b></span>
                <span>End: <b>{activeScatter.callEndReason}</b></span>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={showConversation ? () => setShowConversation(false) : handleShowConversation}
                    className="px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg hover:bg-gray-700 transition-colors font-medium"
                  >
                    {showConversation ? 'Hide Conversation' : 'Show Conversation'}
                  </button>
                  <button
                    className="text-gray-400 hover:text-gray-600 px-2"
                    onClick={() => { setActiveScatter(null); setShowConversation(false); }}
                  >✕</button>
                </div>
              </div>

              {showConversation && (
                <ConversationPanel
                  conversationId={activeScatter.conversationId}
                  conversation={callsMapReady ? (callsMapRef.current?.[activeScatter.conversationId] ?? '') : ''}
                  emotion={activeScatter.emotion}
                  score={activeScatter.x}
                  loading={loadingConv}
                  onClose={() => setShowConversation(false)}
                />
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── Call Motives ──────────────────────────────────────────── */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-1">Call Motives</h2>
        <p className="text-xs text-gray-400 mb-4">
          {data.motiveGroups.length} categories detected · click any card to expand
        </p>
        <div className="space-y-3">
          {data.motiveGroups.map(group => (
            <MotiveCard key={group.category} group={group} totalCalls={data.totalCalls} />
          ))}
        </div>
      </section>

      {/* ── Temporal Sentiment ────────────────────────────────────── */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-4">Sentiment Over Time</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* By hour */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm font-semibold text-gray-700 mb-4">By Hour of Day</p>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" domain={[-1, 1]} tick={{ fontSize: 10 }} tickFormatter={v => v.toFixed(1)} />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  formatter={(v: number, name: string) => [
                    name === 'Score' ? v.toFixed(3) : v,
                    name,
                  ]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="left" dataKey="count" name="Calls" fill={C_DARK} opacity={0.3} radius={[3, 3, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="avgScore" name="Score" stroke={C_ORANGE} strokeWidth={2} dot={{ r: 3, fill: C_ORANGE }} />
                <ReferenceLine yAxisId="right" y={0} stroke="#e2e8f0" strokeDasharray="4 4" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* By day of week */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm font-semibold text-gray-700 mb-4">By Day of Week</p>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={dowData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" domain={[-1, 1]} tick={{ fontSize: 10 }} tickFormatter={v => v.toFixed(1)} />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  formatter={(v: number, name: string) => [
                    name === 'Score' ? v.toFixed(3) : v,
                    name,
                  ]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="left" dataKey="count" name="Calls" fill={C_PURPLE} opacity={0.3} radius={[3, 3, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="avgScore" name="Score" stroke={C_ORANGE} strokeWidth={2} dot={{ r: 3, fill: C_ORANGE }} />
                <ReferenceLine yAxisId="right" y={0} stroke="#e2e8f0" strokeDasharray="4 4" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* ── Restaurant Mood Profiles ──────────────────────────────── */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-4">Restaurant Mood Profiles</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {restaurants.map(([name, stats]) => {
            const total = stats.moodOutcomeMatrix.positiveResolved
              + stats.moodOutcomeMatrix.positiveTransferred
              + stats.moodOutcomeMatrix.negativeResolved
              + stats.moodOutcomeMatrix.negativeTransferred || 1;

            const cells = [
              {
                label: 'Positive + Resolved',
                value: stats.moodOutcomeMatrix.positiveResolved,
                bg: 'bg-green-600', text: 'text-white',
                note: 'Ideal outcome',
              },
              {
                label: 'Positive + Transferred',
                value: stats.moodOutcomeMatrix.positiveTransferred,
                bg: 'bg-gray-200', text: 'text-gray-700',
                note: 'Happy caller, still escalated',
              },
              {
                label: 'Negative + Resolved',
                value: stats.moodOutcomeMatrix.negativeResolved,
                bg: 'bg-gray-800', text: 'text-white',
                note: 'AI recovered the call',
              },
              {
                label: 'Negative + Transferred',
                value: stats.moodOutcomeMatrix.negativeTransferred,
                bg: 'bg-orange-600', text: 'text-white',
                note: 'Worst case — frustrated AND transferred',
              },
            ];

            const isOakwood = name.includes('Oakwood');
            const accentColor = isOakwood ? 'border-orange-400' : 'border-violet-400';

            return (
              <div key={name} className={`bg-white rounded-xl border-2 ${accentColor} p-5`}>
                <div className="flex items-center gap-2 mb-4">
                  <span
                    className="text-sm font-bold"
                    style={{ color: isOakwood ? C_ORANGE : C_PURPLE }}
                  >{name}</span>
                  <span className="text-xs text-gray-400 ml-auto">
                    avg score: {stats.avgScore > 0 ? '+' : ''}{stats.avgScore.toFixed(2)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {cells.map((cell) => (
                    <div
                      key={cell.label}
                      className={`${cell.bg} ${cell.text} rounded-lg p-4 flex flex-col items-center justify-center`}
                    >
                      <p className="text-3xl font-bold">{cell.value}</p>
                      <p className="text-xs mt-1 text-center opacity-90">{cell.label}</p>
                      <p className="text-xs mt-0.5 text-center opacity-60">{Math.round((cell.value / total) * 100)}%</p>
                      <p className="text-xs mt-1 text-center opacity-70 italic">{cell.note}</p>
                    </div>
                  ))}
                </div>

                {/* Emotion distribution mini-chart */}
                <div className="mt-4">
                  <p className="text-xs text-gray-500 mb-2 font-medium">Emotion distribution</p>
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(stats.emotionDist)
                      .sort((a, b) => b[1] - a[1])
                      .map(([emotion, count]) => (
                        <span
                          key={emotion}
                          className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{
                            background: `${EMOTION_COLOR[emotion] ?? C_GRAY}20`,
                            color: EMOTION_COLOR[emotion] ?? C_GRAY,
                          }}
                        >
                          {EMOTION_LABEL[emotion] ?? emotion} {count}
                        </span>
                      ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

    </div>
  );
}
