import React, { useEffect, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import type { DescriptiveStats } from '../types.ts';

const PIE_COLORS: Record<string, string> = {
  CallTransfer: '#f97316',
  UserHangup: '#0f172a',
  AgentHangup: '#ea580c',
  UserInactivity: '#94a3b8',
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function KPICard({
  label, value, sub, accent = 'none',
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: 'orange' | 'purple' | 'dark' | 'none';
}) {
  const border = {
    orange: 'border-l-4 border-brand-500',
    purple: 'border-l-4 border-accent-500',
    dark:   'border-l-4 border-gray-900',
    none:   '',
  };
  const valColor = {
    orange: 'text-brand-600',
    purple: 'text-accent-600',
    dark:   'text-gray-900',
    none:   'text-gray-900',
  };
  return (
    <div className={`bg-white border border-gray-200 rounded-xl p-4 ${border[accent]}`}>
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${valColor[accent]}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
      {children}
    </h2>
  );
}

function LineTooltip({ active, payload, label, avgDaily }: any) {
  if (!active || !payload?.length) return null;
  const count: number = payload[0].value;
  const diff = count - avgDaily;
  const pct = avgDaily ? Math.round(Math.abs(diff) / avgDaily * 100) : 0;
  return (
    <div className="bg-gray-900 text-white rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold">{label}</p>
      <p className="mt-0.5">{count} calls</p>
      <p className={diff >= 0 ? 'text-brand-400' : 'text-accent-300'}>
        {diff >= 0 ? '↑' : '↓'} {pct}% vs daily avg ({avgDaily})
      </p>
    </div>
  );
}

export default function HealthOverview() {
  const [stats, setStats] = useState<DescriptiveStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [activeDow, setActiveDow] = useState<string | null>(null);
  const [activePieIndex, setActivePieIndex] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/stats')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setStats(d as DescriptiveStats);
      })
      .catch((e) => setError(String(e)));
  }, []);

  if (error) {
    return (
      <div className="bg-gray-900 border border-brand-500 rounded-xl p-6 text-white">
        <strong>Pipeline output not found.</strong>{' '}
        Run <code className="bg-gray-800 px-1 rounded text-brand-400">npm run pipeline</code> first.
        <br /><span className="text-sm text-gray-400">{error}</span>
      </div>
    );
  }

  if (!stats) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Loading…</div>;
  }

  const tf = stats.byRestaurant['TF Oakwood'];
  const rt = stats.byRestaurant['RT Buckhead'];

  const dailyData = Object.entries(stats.temporalStats.byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date: date.slice(5), total: count }));

  const avgDaily = dailyData.length
    ? Math.round(dailyData.reduce((s, d) => s + d.total, 0) / dailyData.length)
    : 0;

  const endReasonData = Object.entries(stats.callEndReasonDist)
    .map(([name, value]) => ({ name, value }));

  const dowData = Object.entries(stats.temporalStats.byDayOfWeek)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([dow, count]) => ({ day: DAY_NAMES[Number(dow)], calls: count }));

  const avgDow = dowData.length
    ? Math.round(dowData.reduce((s, d) => s + d.calls, 0) / dowData.length)
    : 0;

  const hourData = Object.entries(stats.temporalStats.byHour)
    .sort(([a], [b]) => Number(a) - Number(b))
    .filter(([h]) => Number(h) >= 8)
    .map(([h, count]) => ({ hour: `${h}:00`, calls: count }));

  const maxHour = Math.max(...hourData.map(d => d.calls));
  const minHour = Math.min(...hourData.map(d => d.calls));
  function hourColor(calls: number): string {
    if (maxHour === minHour) return '#f97316';
    const t = (calls - minHour) / (maxHour - minHour);
    if (t > 0.6) return '#f97316';
    if (t > 0.3) return '#7c3aed';
    return '#1e293b';
  }

  const compRows = [
    { label: 'Total calls', tf: tf.totalCalls, rt: rt.totalCalls, fmt: (v: number) => String(v) },
    { label: 'Transfer rate', tf: tf.transferRate, rt: rt.transferRate, fmt: (v: number) => `${Math.round(v * 100)}%`, flag: (v: number) => v > 0.6 },
    { label: 'SMS sent rate', tf: tf.smsRate, rt: rt.smsRate, fmt: (v: number) => `${Math.round(v * 100)}%` },
    { label: 'Autonomous resolution', tf: tf.autonomousResolutionRate, rt: rt.autonomousResolutionRate, fmt: (v: number) => `${Math.round(v * 100)}%` },
    { label: 'Avg duration', tf: tf.avgDurationSeconds, rt: rt.avgDurationSeconds, fmt: (v: number) => `${v}s` },
    { label: 'Frustration rate', tf: tf.frustrationRate, rt: rt.frustrationRate, fmt: (v: number) => `${Math.round(v * 100)}%`, flag: (v: number) => v > 0.5 },
  ];

  const activeDateData = activeDate ? dailyData.find(d => d.date === activeDate) : null;
  const activeDowData = activeDow ? dowData.find(d => d.day === activeDow) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Health Overview</h1>
        <p className="text-sm text-gray-500 mt-0.5">March 2026 · All restaurants combined</p>
      </div>

      {/* KPI row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Total calls" value={String(stats.totalCalls)} accent="dark" />
        <KPICard
          label="Transfer rate"
          value={`${Math.round((stats.callEndReasonDist['CallTransfer'] ?? 0) / stats.totalCalls * 100)}%`}
          sub={`${stats.callEndReasonDist['CallTransfer']} calls transferred`}
          accent="orange"
        />
        <KPICard
          label="SMS sent"
          value={String(stats.smsStats.totalWithSms)}
          sub={`${Math.round(stats.smsStats.smsRate * 100)}% of all calls`}
          accent="purple"
        />
        <KPICard
          label="Unique callers"
          value={String(stats.callerStats.uniqueCallers)}
          sub={`${stats.callerStats.repeatCallers} repeat callers`}
        />
      </div>

      {/* KPI row 2 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          label="Avg duration"
          value={`${stats.durationStats.avg}s`}
          sub={`Median: ${stats.durationStats.p50}s · P90: ${stats.durationStats.p90}s`}
        />
        <KPICard
          label="Reservation SMS rate"
          value={`${Math.round(stats.smsStats.reservationSmsRate * 100)}%`}
          sub="SMS sent for reservations"
          accent="orange"
        />
        <KPICard
          label="Avg conv. turns"
          value={stats.conversationStats.avgTurns.toFixed(1)}
          sub={`Median length: ${stats.conversationStats.medianLengthChars} chars`}
        />
        <KPICard
          label="Possible bots"
          value={String(stats.callerStats.possibleBot.length)}
          sub="Callers with 5+ identical calls"
          accent="purple"
        />
      </div>

      {/* Restaurant comparison */}
      <div>
        <SectionTitle>Restaurant Comparison</SectionTitle>
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Metric</th>
                <th className="text-center px-4 py-2.5 font-semibold text-brand-600">TF Oakwood (ES)</th>
                <th className="text-center px-4 py-2.5 font-semibold text-accent-600">RT Buckhead (EN)</th>
              </tr>
            </thead>
            <tbody>
              {compRows.map((row) => (
                <tr key={row.label} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-2.5 text-gray-600">{row.label}</td>
                  <td className={`text-center px-4 py-2.5 font-medium ${row.flag?.(row.tf) ? 'text-brand-600' : 'text-gray-900'}`}>
                    {row.fmt(row.tf)}
                  </td>
                  <td className={`text-center px-4 py-2.5 font-medium ${row.flag?.(row.rt) ? 'text-brand-600' : 'text-gray-900'}`}>
                    {row.fmt(row.rt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Daily trend — clickable */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <SectionTitle>Daily Call Volume — click a point</SectionTitle>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart
              data={dailyData}
              style={{ cursor: 'pointer' }}
              onClick={(state: any) => {
                const date = state?.activePayload?.[0]?.payload?.date;
                if (date) setActiveDate(prev => prev === date ? null : date);
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip content={<LineTooltip avgDaily={avgDaily} />} />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#f97316"
                strokeWidth={2}
                dot={{ r: 3, fill: '#f97316', strokeWidth: 0 }}
                activeDot={{ r: 6, stroke: '#ea580c', strokeWidth: 2, fill: '#fff' }}
                name="Calls"
              />
            </LineChart>
          </ResponsiveContainer>
          {activeDateData && (
            <div className="mt-3 bg-gray-900 text-white rounded-lg px-4 py-2.5 text-xs flex items-center justify-between">
              <span className="font-semibold">{activeDateData.date}</span>
              <span>{activeDateData.total} calls</span>
              <span className={activeDateData.total >= avgDaily ? 'text-brand-400' : 'text-accent-300'}>
                {activeDateData.total >= avgDaily ? '↑' : '↓'}{' '}
                {Math.abs(Math.round((activeDateData.total - avgDaily) / avgDaily * 100))}% vs avg ({avgDaily})
              </span>
              <button onClick={() => setActiveDate(null)} className="text-gray-500 hover:text-white ml-2">✕</button>
            </div>
          )}
        </div>

        {/* Call outcomes pie — clickable */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <SectionTitle>Call Outcomes — click to highlight</SectionTitle>
          <div className="flex items-center">
            <ResponsiveContainer width="55%" height={200}>
              <PieChart>
                <Pie
                  data={endReasonData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={82}
                  paddingAngle={2}
                  dataKey="value"
                  onClick={(_: any, index: number) =>
                    setActivePieIndex(prev => prev === index ? null : index)
                  }
                  style={{ cursor: 'pointer' }}
                >
                  {endReasonData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={PIE_COLORS[entry.name] ?? '#94a3b8'}
                      opacity={activePieIndex !== null && activePieIndex !== i ? 0.2 : 1}
                      stroke={activePieIndex === i ? '#fff' : 'none'}
                      strokeWidth={activePieIndex === i ? 2 : 0}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [`${v} calls`]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {endReasonData.map((item, i) => (
                <div
                  key={item.name}
                  className={`flex items-center gap-2 text-xs cursor-pointer rounded px-1.5 py-1 transition-colors ${activePieIndex === i ? 'bg-gray-100 font-medium' : ''}`}
                  onClick={() => setActivePieIndex(prev => prev === i ? null : i)}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: PIE_COLORS[item.name] ?? '#94a3b8' }}
                  />
                  <span className="text-gray-600 flex-1 truncate">{item.name}</span>
                  <span className="font-semibold text-gray-900">{item.value}</span>
                  <span className="text-gray-400">{Math.round(item.value / stats.totalCalls * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Day of week — clickable */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <SectionTitle>Calls by Day of Week — click a bar</SectionTitle>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dowData} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip
                content={({ active, payload }: any) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  const diff = d.calls - avgDow;
                  const pct = avgDow ? Math.round(Math.abs(diff) / avgDow * 100) : 0;
                  return (
                    <div className="bg-gray-900 text-white rounded-lg px-3 py-2 text-xs shadow-lg">
                      <p className="font-semibold">{d.day}</p>
                      <p>{d.calls} calls</p>
                      <p className={diff >= 0 ? 'text-brand-400' : 'text-accent-300'}>
                        {diff >= 0 ? '↑' : '↓'} {pct}% vs weekly avg ({avgDow})
                      </p>
                    </div>
                  );
                }}
              />
              <Bar
                dataKey="calls"
                radius={[4, 4, 0, 0]}
                name="Calls"
                style={{ cursor: 'pointer' }}
                onClick={(data: any) =>
                  setActiveDow(prev => prev === data.day ? null : data.day)
                }
              >
                {dowData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={activeDow === entry.day ? '#f97316' : '#0f172a'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {activeDowData && (
            <div className="mt-2 bg-gray-900 text-white rounded-lg px-3 py-2 text-xs flex items-center justify-between">
              <span className="font-semibold">{activeDowData.day}</span>
              <span>{activeDowData.calls} calls</span>
              <span className={activeDowData.calls >= avgDow ? 'text-brand-400' : 'text-accent-300'}>
                {activeDowData.calls >= avgDow ? '↑' : '↓'}{' '}
                {Math.abs(Math.round((activeDowData.calls - avgDow) / avgDow * 100))}% vs avg ({avgDow})
              </span>
              <button onClick={() => setActiveDow(null)} className="text-gray-500 hover:text-white ml-2">✕</button>
            </div>
          )}
        </div>

        {/* Hourly — intensity colored */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <SectionTitle>Calls by Hour — intensity colored</SectionTitle>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={hourData} barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="hour" tick={{ fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip
                content={({ active, payload }: any) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  const pct = stats.totalCalls ? Math.round(d.calls / stats.totalCalls * 100) : 0;
                  return (
                    <div className="bg-gray-900 text-white rounded-lg px-3 py-2 text-xs shadow-lg">
                      <p className="font-semibold">{d.hour}</p>
                      <p>{d.calls} calls · {pct}% of daily volume</p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="calls" radius={[3, 3, 0, 0]} name="Calls">
                {hourData.map((entry, i) => (
                  <Cell key={i} fill={hourColor(entry.calls)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-400 justify-end">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#1e293b' }} /> Low
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#7c3aed' }} /> Mid
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#f97316' }} /> Peak
            </span>
          </div>
        </div>
      </div>

      {/* Frustration callout */}
      <div className="bg-gray-900 border-l-4 border-brand-500 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <span className="text-xl mt-0.5">⚠️</span>
          <div>
            <p className="text-sm font-semibold text-white">Frustration Signal</p>
            <p className="text-sm text-gray-300 mt-0.5">
              TF Oakwood:{' '}
              <strong className="text-brand-400">
                {Math.round(stats.sentimentStats.byRestaurant['TF Oakwood'].frustrationRate * 100)}%
              </strong>{' '}
              of calls contain frustration markers ·{' '}
              RT Buckhead:{' '}
              <strong className="text-accent-400">
                {Math.round(stats.sentimentStats.byRestaurant['RT Buckhead'].frustrationRate * 100)}%
              </strong>.{' '}
              Reservation SMS confirmation rate is{' '}
              <strong className="text-brand-400">
                {Math.round(stats.smsStats.reservationSmsRate * 100)}%
              </strong>{' '}
              — all RT Buckhead reservations lack confirmation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
