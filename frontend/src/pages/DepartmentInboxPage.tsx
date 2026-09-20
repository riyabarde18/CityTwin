import React, { useEffect, useMemo, useState } from 'react';
import { getReportsInbox, updateEventStatus } from '../api';
import { EventItem, PatternStatus } from '../types';
import { getCategoryMeta } from '../utils/categoryConfig';
import { StatusBadge } from '../components/StatusBadge';
import { ProgressBar } from '../components/ProgressBar';
import { EscalationsPanel } from '../components/EscalationsPanel';
import { Inbox, RefreshCw, Send, MapPin } from 'lucide-react';

const NEXT_STEPS: Record<PatternStatus, PatternStatus[]> = {
  new: ['acknowledged', 'in_progress', 'rejected'],
  acknowledged: ['in_progress', 'resolved', 'rejected'],
  in_progress: ['resolved', 'rejected', 'acknowledged'],
  resolved: ['in_progress'],
  rejected: ['acknowledged', 'in_progress'],
};

const STATUS_LABELS: Record<PatternStatus, string> = {
  new: 'New',
  acknowledged: 'Acknowledge',
  in_progress: 'In Progress',
  resolved: 'Resolve',
  rejected: 'Reject',
};

const formatDate = (iso?: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

/**
 * The government-side surface for automatic routing: every individual
 * citizen report lands here immediately, filed under its department and
 * zone — no waiting for pattern detection. This is a demo console (no
 * auth) standing in for an authenticated per-department portal.
 */
export const DepartmentInboxPage: React.FC = () => {
  const [reports, setReports] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [zoneFilter, setZoneFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [actingOn, setActingOn] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getReportsInbox();
      setReports(data);
    } catch (err: any) {
      setError('Failed to load inbox. Ensure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const departments = useMemo(
    () => Array.from(new Set(reports.map((r) => r.assigned_department))).sort(),
    [reports]
  );
  const zones = useMemo(
    () => Array.from(new Set(reports.map((r) => r.assigned_zone))).sort(),
    [reports]
  );

  const filtered = useMemo(() => {
    return reports.filter((r) => {
      if (deptFilter !== 'all' && r.assigned_department !== deptFilter) return false;
      if (zoneFilter !== 'all' && r.assigned_zone !== zoneFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      return true;
    });
  }, [reports, deptFilter, zoneFilter, statusFilter]);

  const handleAction = async (eventId: string, nextStatus: PatternStatus) => {
    setActingOn(`${eventId}:${nextStatus}`);
    try {
      const updated = await updateEventStatus(eventId, nextStatus, { actorLabel: 'Department Officer' });
      setReports((prev) => prev.map((r) => (r.event_id === eventId ? updated : r)));
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update report status.');
    } finally {
      setActingOn(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-2 space-y-4">
      <div className="flex items-center justify-end">
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Proactive notifications: overdue + severe-weather-forecast cases */}
      <EscalationsPanel />

      {/* Filters */}
      <div className="flex flex-wrap gap-2 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="px-2.5 py-1.5 text-[11px] border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none"
        >
          <option value="all">All departments</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select
          value={zoneFilter}
          onChange={(e) => setZoneFilter(e.target.value)}
          className="px-2.5 py-1.5 text-[11px] border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none"
        >
          <option value="all">All zones</option>
          {zones.map((z) => <option key={z} value={z}>{z}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-2.5 py-1.5 text-[11px] border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none"
        >
          <option value="all">All statuses</option>
          <option value="new">New</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="rejected">Rejected</option>
        </select>
        <span className="ml-auto text-[11px] text-slate-500 self-center">{filtered.length} of {reports.length} reports</span>
      </div>

      {error && <p className="text-xs text-rose-600 font-medium text-center">{error}</p>}

      {!loading && filtered.length === 0 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center text-center space-y-2">
          <Inbox className="w-6 h-6 text-slate-400" />
          <p className="text-xs text-slate-500">No reports match these filters yet.</p>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((r) => {
          const meta = getCategoryMeta(r.category);
          const nextOptions = NEXT_STEPS[r.status] || [];
          return (
            <div key={r.event_id} className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-1.5">
                <div className="flex items-center space-x-2 flex-wrap gap-1.5">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${meta.bgColor} ${meta.color}`}>
                    {meta.label}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-700">{r.assigned_department}</span>
                  <span className="text-[11px] text-slate-400">· {r.assigned_zone}</span>
                </div>
                <StatusBadge status={r.status} />
              </div>

              <p className="text-xs text-slate-700">{r.description}</p>

              <ProgressBar percent={r.progress_percent} status={r.status} />

              <div className="flex items-center justify-between flex-wrap gap-1.5 text-[10px] text-slate-400">
                <span className="flex items-center space-x-1">
                  <MapPin className="w-3 h-3" />
                  <span>{r.lat.toFixed(5)}, {r.lon.toFixed(5)}</span>
                </span>
                <span>Submitted {formatDate(r.timestamp)} · by {r.submitter_id}</span>
              </div>

              {r.status_note && (
                <p className="text-[11px] bg-indigo-50 border border-indigo-100 text-indigo-800 rounded-lg p-2">
                  "{r.status_note}"
                </p>
              )}

              {nextOptions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-100">
                  {nextOptions.map((opt) => {
                    const key = `${r.event_id}:${opt}`;
                    return (
                      <button
                        key={opt}
                        onClick={() => handleAction(r.event_id, opt)}
                        disabled={!!actingOn}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-50 transition"
                      >
                        {actingOn === key ? (
                          <span className="w-2.5 h-2.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Send className="w-2.5 h-2.5" />
                        )}
                        <span>{STATUS_LABELS[opt]}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
