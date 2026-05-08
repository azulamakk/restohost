import React, { useEffect, useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import type { Ticket, Severity } from '../types.ts';

const ERROR_SEVERITY: Record<string, Severity> = {
  BROKEN_PROMISE:      'CRITICAL',
  AVOIDABLE_TRANSFER:  'HIGH',
  STT_FAILURE:         'HIGH',
  INCOMPLETE_FLOW:     'HIGH',
  NULL_CLASSIFICATION: 'MEDIUM',
  UNFILTERED_SPAM:     'MEDIUM',
  REPEAT_CALLER:       'MEDIUM',
  LANGUAGE_MISMATCH:   'LOW',
};

const SEVERITY_ORDER: Record<Severity, number> = {
  CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, NONE: 4,
};

function SeverityBadge({ severity }: { severity: Severity }) {
  const cls: Record<Severity, string> = {
    CRITICAL: 'bg-brand-600 text-white',
    HIGH:     'bg-brand-400 text-white',
    MEDIUM:   'bg-accent-500 text-white',
    LOW:      'bg-gray-200 text-gray-700',
    NONE:     'bg-gray-100 text-gray-500',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls[severity]}`}>
      {severity}
    </span>
  );
}

function TicketModal({ ticket, onClose }: { ticket: Ticket; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-100 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <SeverityBadge severity={ticket.severity} />
              <span className="text-xs text-gray-400 font-mono">{ticket.conversationId.slice(0, 12)}</span>
            </div>
            <h3 className="text-base font-semibold text-gray-900">{ticket.errorLabel}</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {ticket.restaurantName} · {new Date(ticket.callStartTime).toLocaleDateString()} · {ticket.callDurationSeconds}s · {ticket.callEndReason}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl ml-4">×</button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Reason for call</p>
            <p className="text-sm text-gray-700">{ticket.reasonForCalling || '(empty)'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">What happened</p>
            <p className="text-sm text-gray-700">{ticket.description}</p>
          </div>
          <div className="bg-brand-50 border border-brand-100 rounded-lg p-3">
            <p className="text-xs font-semibold text-brand-700 uppercase tracking-wide mb-1">Why it matters</p>
            <p className="text-sm text-brand-800">{ticket.whyItMatters}</p>
          </div>
          <div className="bg-gray-900 rounded-lg p-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Proposed fix</p>
            <p className="text-sm text-gray-100">{ticket.proposedFix}</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span>Confidence: {Math.round(ticket.confidence * 100)}%</span>
            <span>·</span>
            <span>Source: {ticket.source}</span>
            <span>·</span>
            <span>Error code: {ticket.errorCode}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ErrorTickets() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filterRestaurant, setFilterRestaurant] = useState<string>('all');
  const [filterError, setFilterError] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [selected, setSelected] = useState<Ticket | null>(null);

  useEffect(() => {
    fetch('/api/tickets')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setTickets(d as Ticket[]);
      })
      .catch((e) => setError(String(e)));
  }, []);

  const filtered = useMemo(() => {
    return [...tickets]
      .filter((t) => {
        if (filterRestaurant !== 'all' && t.restaurantName !== filterRestaurant) return false;
        if (filterError !== 'all' && t.errorCode !== filterError) return false;
        if (filterSeverity !== 'all' && t.severity !== filterSeverity) return false;
        return true;
      })
      .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  }, [tickets, filterRestaurant, filterError, filterSeverity]);

  const errorDistData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of tickets) counts[t.errorCode] = (counts[t.errorCode] ?? 0) + 1;
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([code, count]) => ({ code, count }));
  }, [tickets]);

  const errorCodes = useMemo(() => [...new Set(tickets.map((t) => t.errorCode))], [tickets]);

  if (error) {
    return (
      <div className="bg-gray-900 border border-brand-500 rounded-xl p-6 text-white">
        <strong>Pipeline output not found.</strong>{' '}
        Run <code className="bg-gray-800 px-1 rounded text-brand-400">npm run pipeline</code> first.
      </div>
    );
  }

  const byRestaurant = {
    'TF Oakwood': tickets.filter((t) => t.restaurantName === 'TF Oakwood').length,
    'RT Buckhead': tickets.filter((t) => t.restaurantName === 'RT Buckhead').length,
  };

  const handleBarClick = (data: any) => {
    setFilterError(prev => prev === data.code ? 'all' : data.code);
  };

  return (
    <div className="space-y-6">
      {selected && <TicketModal ticket={selected} onClose={() => setSelected(null)} />}

      <div>
        <h1 className="text-xl font-bold text-gray-900">Errors & Tickets</h1>
        <p className="text-sm text-gray-500 mt-0.5">{tickets.length} errors identified across 300 calls</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Total errors</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{tickets.length}</p>
          <p className="text-xs text-gray-400">{Math.round((tickets.length / 300) * 100)}% of all calls</p>
        </div>
        <div className="bg-gray-900 border border-brand-500 rounded-xl p-4">
          <p className="text-xs text-brand-400 uppercase tracking-wide font-medium">Critical</p>
          <p className="text-2xl font-bold text-white mt-1">
            {tickets.filter((t) => t.severity === 'CRITICAL').length}
          </p>
          <p className="text-xs text-gray-400">Require immediate action</p>
        </div>
        <div className="bg-white border border-brand-200 rounded-xl p-4">
          <p className="text-xs text-brand-600 uppercase tracking-wide font-medium">TF Oakwood</p>
          <p className="text-2xl font-bold text-brand-600 mt-1">{byRestaurant['TF Oakwood']}</p>
          <p className="text-xs text-gray-400">
            {Math.round((byRestaurant['TF Oakwood'] / 150) * 100)}% of its calls
          </p>
        </div>
        <div className="bg-white border border-accent-200 rounded-xl p-4">
          <p className="text-xs text-accent-600 uppercase tracking-wide font-medium">RT Buckhead</p>
          <p className="text-2xl font-bold text-accent-600 mt-1">{byRestaurant['RT Buckhead']}</p>
          <p className="text-xs text-gray-400">
            {Math.round((byRestaurant['RT Buckhead'] / 150) * 100)}% of its calls
          </p>
        </div>
      </div>

      {/* Error distribution — click to cross-filter */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Error Distribution</h2>
          <span className="text-xs text-gray-400">Click a bar to filter the table below</span>
        </div>
        {filterError !== 'all' && (
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full font-medium">
              Showing: {filterError}
            </span>
            <button
              onClick={() => setFilterError('all')}
              className="text-xs text-gray-400 hover:text-gray-700"
            >
              Clear ✕
            </button>
          </div>
        )}
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={errorDistData} layout="vertical" barSize={18} style={{ cursor: 'pointer' }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
            <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis
              type="category"
              dataKey="code"
              tick={{ fontSize: 10 }}
              tickLine={false}
              width={150}
            />
            <Tooltip
              content={({ active, payload }: any) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                const pct = tickets.length ? Math.round(d.count / tickets.length * 100) : 0;
                const sev = ERROR_SEVERITY[d.code] ?? 'NONE';
                return (
                  <div className="bg-gray-900 text-white rounded-lg px-3 py-2 text-xs shadow-lg">
                    <p className="font-semibold">{d.code}</p>
                    <p className="mt-0.5">{d.count} tickets · {pct}% of all errors</p>
                    <p className="text-gray-400">Severity: {sev}</p>
                    <p className="text-brand-400 mt-1">Click to filter ↓</p>
                  </div>
                );
              }}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} name="Tickets" onClick={handleBarClick}>
              {errorDistData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={
                    filterError === entry.code
                      ? '#f97316'
                      : filterError === 'all'
                      ? '#0f172a'
                      : '#e2e8f0'
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={filterRestaurant}
          onChange={(e) => setFilterRestaurant(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-300"
        >
          <option value="all">All restaurants</option>
          <option value="TF Oakwood">TF Oakwood</option>
          <option value="RT Buckhead">RT Buckhead</option>
        </select>
        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-300"
        >
          <option value="all">All severities</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
        <select
          value={filterError}
          onChange={(e) => setFilterError(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-300"
        >
          <option value="all">All error types</option>
          {errorCodes.map((code) => (
            <option key={code} value={code}>{code}</option>
          ))}
        </select>
        <span className="text-sm text-gray-400">{filtered.length} of {tickets.length} tickets</span>
        {(filterRestaurant !== 'all' || filterError !== 'all' || filterSeverity !== 'all') && (
          <button
            onClick={() => { setFilterRestaurant('all'); setFilterError('all'); setFilterSeverity('all'); }}
            className="text-sm text-gray-400 hover:text-gray-700 underline"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Ticket table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Severity</th>
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Restaurant</th>
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Error type</th>
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Call reason</th>
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-400 text-sm">
                    No tickets match the current filters.
                  </td>
                </tr>
              )}
              {filtered.map((ticket) => (
                <tr
                  key={ticket.conversationId}
                  onClick={() => setSelected(ticket)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-2.5">
                    <SeverityBadge severity={ticket.severity} />
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs font-medium ${ticket.restaurantName === 'TF Oakwood' ? 'text-brand-600' : 'text-accent-600'}`}>
                      {ticket.restaurantName}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs font-mono text-gray-600">{ticket.errorCode}</span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 max-w-xs truncate">
                    {ticket.reasonForCalling || '(empty)'}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">
                    {new Date(ticket.callStartTime).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">
                    {ticket.callDurationSeconds}s
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center">
        Click any row to see full ticket details, root cause, and proposed fix
      </p>
    </div>
  );
}
