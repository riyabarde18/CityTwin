import React, { useState, useEffect } from 'react';
import { getMyReports, submitFollowup } from '../api';
import { MyReportItem } from '../types';
import { getCategoryMeta } from '../utils/categoryConfig';
import { StatusBadge } from '../components/StatusBadge';
import { ProgressBar } from '../components/ProgressBar';
import { useAuth } from '../context/AuthContext';
import { Search, Inbox, Link2, MapPin, Building2, History, ShieldCheck, MessageSquarePlus, Trophy } from 'lucide-react';

const FOLLOWUP_MIN_DAYS = 7;

/** Owner-only prompt to add a follow-up update once a report is old enough to earn the bonus. */
const FollowupBox: React.FC<{ reportId: string; daysOld: number }> = ({ reportId, daysOld }) => {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (daysOld < FOLLOWUP_MIN_DAYS) return null;
  if (done) {
    return (
      <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2 flex items-center space-x-1.5">
        <Trophy className="w-3.5 h-3.5" />
        <span>Follow-up submitted — thanks for keeping this updated!</span>
      </p>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await submitFollowup(reportId, text.trim());
      setDone(true);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to submit follow-up.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="pt-2 border-t border-slate-100 space-y-1.5">
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide flex items-center space-x-1">
        <MessageSquarePlus className="w-3 h-3 text-sky-500" />
        <span>This report is {daysOld}d old — add a follow-up (+10 pts)</span>
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Is the issue still there? Better, worse, or resolved?"
        rows={2}
        className="w-full px-2.5 py-1.5 text-[11px] border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none resize-none"
      />
      {error && <p className="text-[10px] text-rose-600 font-medium">{error}</p>}
      <button
        type="submit"
        disabled={submitting || text.trim().length < 15}
        className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50 transition"
      >
        {submitting ? <span className="w-2.5 h-2.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <MessageSquarePlus className="w-2.5 h-2.5" />}
        <span>Submit follow-up</span>
      </button>
    </form>
  );
};

/**
 * Closes the citizen-awareness loop. Logged-in users see their reports
 * automatically (attributed by verified phone number); anyone can also look
 * up a submitter id manually (e.g. to browse demo data, or before logging in).
 */
export const MyReportsPage: React.FC = () => {
  const { user } = useAuth();
  const [submitterId, setSubmitterId] = useState('citizen_mobile_01');
  const [reports, setReports] = useState<MyReportItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [showManualLookup, setShowManualLookup] = useState(!user);

  const runLookup = async (id?: string) => {
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const data = await getMyReports(id);
      setReports(data);
    } catch (err: any) {
      setError('Failed to fetch reports. Ensure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  // Logged-in users see their own reports immediately, no typing required.
  useEffect(() => {
    if (user) {
      runLookup(undefined);
    }
  }, [user]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submitterId.trim()) return;
    await runLookup(submitterId.trim());
  };

  const formatDate = (iso?: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-2 space-y-6">
      {user && (
        <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-2.5">
          <span className="text-xs text-emerald-800 flex items-center space-x-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Showing reports for <span className="font-bold">{user.phone_number}</span></span>
          </span>
          <button
            onClick={() => setShowManualLookup((v) => !v)}
            className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900"
          >
            {showManualLookup ? 'Hide' : 'Look up a different ID'}
          </button>
        </div>
      )}

      {showManualLookup && (
        <form onSubmit={handleSearch} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-2">
          <input
            type="text"
            value={submitterId}
            onChange={(e) => setSubmitterId(e.target.value)}
            placeholder="Enter a submitter identifier"
            className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 transition"
          >
            {loading ? (
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Search className="w-3.5 h-3.5" />
            )}
            <span>Find reports</span>
          </button>
        </form>
      )}

      {error && <p className="text-xs text-rose-600 font-medium text-center">{error}</p>}

      {searched && !loading && reports && reports.length === 0 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center text-center space-y-2">
          <Inbox className="w-6 h-6 text-slate-400" />
          <p className="text-xs text-slate-500">No reports found for this identifier. Submit one from the "Report Issue" tab first.</p>
        </div>
      )}

      {reports && reports.length > 0 && (
        <div className="space-y-3">
          {reports.map((r) => {
            const meta = getCategoryMeta(r.event.category);
            return (
              <div key={r.event.event_id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-1.5">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${meta.bgColor} ${meta.color}`}>
                    {meta.label}
                  </span>
                  <span className="text-[10px] text-slate-400">{formatDate(r.event.timestamp)}</span>
                </div>
                <p className="text-xs text-slate-700">{r.event.description}</p>
                <p className="text-[10px] text-slate-400 flex items-center space-x-1">
                  <MapPin className="w-3 h-3" />
                  <span>{r.event.lat.toFixed(5)}, {r.event.lon.toFixed(5)}</span>
                </p>

                {/* Automatic routing — always present, the instant the report was submitted */}
                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                  <div className="flex items-center justify-between flex-wrap gap-1.5">
                    <span className="text-[11px] text-slate-700 flex items-center space-x-1.5">
                      <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                      <span>
                        Auto-routed to <span className="font-semibold">{r.event.assigned_department}</span>
                        {' '}— <span className="font-semibold">{r.event.assigned_zone}</span>
                      </span>
                    </span>
                    <StatusBadge status={r.event.status} />
                  </div>
                  <ProgressBar percent={r.event.progress_percent} status={r.event.status} />
                  {r.event.status_note && (
                    <p className="text-[11px] bg-indigo-50 border border-indigo-100 text-indigo-800 rounded-lg p-2">
                      "{r.event.status_note}" <span className="text-indigo-400">— {formatDate(r.event.status_updated_at)}</span>
                    </p>
                  )}
                  {r.event_status_log.length > 1 && (
                    <details className="text-[10px] text-slate-500">
                      <summary className="cursor-pointer flex items-center space-x-1 select-none">
                        <History className="w-3 h-3" />
                        <span>Full status history ({r.event_status_log.length})</span>
                      </summary>
                      <div className="mt-1.5 space-y-1 pl-4">
                        {[...r.event_status_log].reverse().map((entry) => (
                          <div key={entry.id}>
                            <span className="font-semibold text-slate-700">{entry.actor_label}</span>
                            {' '}marked <span className="font-semibold text-slate-700">{entry.status.replace('_', ' ')}</span>
                            {' '}· {formatDate(entry.created_at)}
                            {entry.note && <span className="block text-slate-500">"{entry.note}"</span>}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>

                {/* Follow-up bonus — only meaningful for a real report_id (not synthetic demo data) owned by the current user */}
                {user && r.event.report_id && (
                  <FollowupBox
                    reportId={r.event.report_id}
                    daysOld={Math.floor((Date.now() - new Date(r.event.timestamp).getTime()) / 86400000)}
                  />
                )}

                {r.pattern_id && (
                  <div className="mt-2 pt-2 border-t border-slate-100 space-y-1.5">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide flex items-center space-x-1">
                      <Link2 className="w-3 h-3" />
                      <span>Also part of a larger detected pattern</span>
                    </p>
                    <div className="flex items-center justify-between flex-wrap gap-1.5">
                      <span className="text-[11px] text-slate-700">
                        Pattern assigned to <span className="font-semibold">{r.pattern_department}</span>
                      </span>
                      {r.pattern_status && <StatusBadge status={r.pattern_status as any} />}
                    </div>
                    {r.pattern_status_note && (
                      <p className="text-[11px] bg-indigo-50 border border-indigo-100 text-indigo-800 rounded-lg p-2">
                        "{r.pattern_status_note}" <span className="text-indigo-400">— {formatDate(r.pattern_status_updated_at)}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
