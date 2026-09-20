import React, { useState } from 'react';
import { PatternDetail, PatternStatus } from '../types';
import { StatusBadge } from './StatusBadge';
import { ProgressBar } from './ProgressBar';
import { updatePatternStatus } from '../api';
import { Building2, Clock, History, Send, ShieldAlert } from 'lucide-react';

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
  in_progress: 'Mark In Progress',
  resolved: 'Mark Resolved',
  rejected: 'Reject',
};

const formatDate = (iso?: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  });
};

interface GovernanceSectionProps {
  pattern: PatternDetail;
  onStatusChanged: (updated: PatternDetail) => void;
}

export const GovernanceSection: React.FC<GovernanceSectionProps> = ({ pattern, onStatusChanged }) => {
  const [department, setDepartment] = useState(pattern.assigned_department);
  const [note, setNote] = useState('');
  const [actorLabel, setActorLabel] = useState('');
  const [progressInput, setProgressInput] = useState('');
  const [submitting, setSubmitting] = useState<PatternStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nextOptions = NEXT_STEPS[pattern.status] || [];

  const handleAction = async (nextStatus: PatternStatus) => {
    setSubmitting(nextStatus);
    setError(null);
    const parsedProgress = progressInput.trim() ? Number(progressInput) : undefined;
    if (parsedProgress !== undefined && (isNaN(parsedProgress) || parsedProgress < 0 || parsedProgress > 100)) {
      setError('Progress must be a number between 0 and 100.');
      setSubmitting(null);
      return;
    }
    try {
      const updated = await updatePatternStatus(pattern.id, nextStatus, {
        department: department !== pattern.assigned_department ? department : undefined,
        note: note || undefined,
        actorLabel: actorLabel || undefined,
        progressPercent: parsedProgress,
      });
      onStatusChanged(updated);
      setNote('');
      setProgressInput('');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update status.');
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800">Government Response &amp; Accountability</h3>
            <p className="text-[10px] text-slate-500">Routed to: <span className="font-semibold text-slate-700">{pattern.assigned_department}</span></p>
          </div>
        </div>
        <StatusBadge status={pattern.status} overdue={pattern.is_overdue} size="md" />
      </div>

      <ProgressBar percent={pattern.progress_percent} status={pattern.status} label="How far along" size="md" />

      {/* SLA due dates */}
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 flex items-center space-x-2">
          <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <div>
            <span className="block text-slate-500">Acknowledge by</span>
            <span className="font-semibold text-slate-800">{formatDate(pattern.acknowledge_due_at)}</span>
          </div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 flex items-center space-x-2">
          <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <div>
            <span className="block text-slate-500">Resolve by</span>
            <span className="font-semibold text-slate-800">{formatDate(pattern.resolve_due_at)}</span>
          </div>
        </div>
      </div>

      {pattern.status_note && (
        <div className="text-[11px] bg-indigo-50 border border-indigo-100 rounded-lg p-2 text-indigo-800">
          <span className="font-bold">Latest note: </span>{pattern.status_note}
        </div>
      )}

      {/* Action panel — simulates the government-side console (no auth in this MVP) */}
      <div className="border-t border-slate-100 pt-3 space-y-2">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide flex items-center space-x-1">
          <ShieldAlert className="w-3 h-3" />
          <span>Officer action (demo console — stands in for an authenticated department portal)</span>
        </p>

        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            value={actorLabel}
            onChange={(e) => setActorLabel(e.target.value)}
            placeholder="Your name / role (optional)"
            className="px-2.5 py-1.5 text-[11px] border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none"
          />
          <input
            type="text"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="Responsible department"
            className="px-2.5 py-1.5 text-[11px] border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none"
          />
        </div>
        <input
          type="number"
          min={0}
          max={100}
          value={progressInput}
          onChange={(e) => setProgressInput(e.target.value)}
          placeholder="Completion % (optional — otherwise a default for the new status is used)"
          className="w-full px-2.5 py-1.5 text-[11px] border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none"
        />
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Public note for citizens (e.g. 'Drain cleared, monitoring for recurrence')"
          rows={2}
          className="w-full px-2.5 py-1.5 text-[11px] border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none resize-none"
        />

        {error && <p className="text-[11px] text-rose-600 font-medium">{error}</p>}

        <div className="flex flex-wrap gap-2 pt-1">
          {nextOptions.map((opt) => (
            <button
              key={opt}
              onClick={() => handleAction(opt)}
              disabled={!!submitting}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-50 transition"
            >
              {submitting === opt ? (
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-3 h-3" />
              )}
              <span>{STATUS_LABELS[opt]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Public audit trail */}
      <div className="border-t border-slate-100 pt-3 space-y-2">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide flex items-center space-x-1">
          <History className="w-3 h-3" />
          <span>Public audit trail</span>
        </p>
        <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
          {pattern.status_log.length === 0 && (
            <p className="text-[11px] text-slate-400">No status changes recorded yet.</p>
          )}
          {[...pattern.status_log].reverse().map((entry) => (
            <div key={entry.id} className="flex items-start space-x-2 text-[11px]">
              <div className="mt-1 w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
              <div>
                <span className="font-semibold text-slate-800">{entry.actor_label}</span>
                <span className="text-slate-500"> marked </span>
                <span className="font-semibold text-slate-800">{entry.status.replace('_', ' ')}</span>
                <span className="text-slate-400"> · {formatDate(entry.created_at)} · {entry.department}</span>
                {entry.note && <p className="text-slate-600 mt-0.5">"{entry.note}"</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
