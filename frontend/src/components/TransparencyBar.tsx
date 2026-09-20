import React, { useEffect, useState } from 'react';
import { TransparencySummary } from '../types';
import { getTransparencySummary } from '../api';
import { ShieldCheck, AlertTriangle, TimerReset, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Public-facing accountability strip: no login required. Shows citywide and
 * per-department response performance so citizens and city leadership can
 * see whether reported patterns are actually being acted on.
 */
export const TransparencyBar: React.FC<{ refreshKey?: number }> = ({ refreshKey }) => {
  const [summary, setSummary] = useState<TransparencySummary | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getTransparencySummary()
      .then((data) => { if (!cancelled) setSummary(data); })
      .catch(() => { /* silently ignore on initial empty state */ });
    return () => { cancelled = true; };
  }, [refreshKey]);

  if (!summary || summary.total_patterns === 0) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition"
      >
        <div className="flex items-center space-x-4 flex-wrap gap-y-1">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-800">
            <ShieldCheck className="w-4 h-4 text-sky-600" />
            <span>Public Accountability</span>
          </div>
          <span className="text-[11px] text-slate-600">
            <span className="font-bold text-slate-900">{summary.total_patterns}</span> patterns flagged
          </span>
          <span className="text-[11px] text-emerald-700">
            <span className="font-bold">{summary.total_resolved}</span> resolved
          </span>
          <span className={`text-[11px] flex items-center space-x-1 ${summary.total_overdue > 0 ? 'text-rose-700' : 'text-slate-500'}`}>
            {summary.total_overdue > 0 && <AlertTriangle className="w-3 h-3" />}
            <span><span className="font-bold">{summary.total_overdue}</span> overdue</span>
          </span>
          {summary.citywide_avg_resolution_days != null && (
            <span className="text-[11px] text-slate-600 flex items-center space-x-1">
              <TimerReset className="w-3 h-3" />
              <span>Avg resolution: <span className="font-bold text-slate-900">{summary.citywide_avg_resolution_days}d</span></span>
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-4 py-3 overflow-x-auto">
          <table className="w-full text-[11px] min-w-[560px]">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-1 pr-3 font-semibold">Responsible Department</th>
                <th className="py-1 px-2 font-semibold text-center">Total</th>
                <th className="py-1 px-2 font-semibold text-center">New</th>
                <th className="py-1 px-2 font-semibold text-center">In Progress</th>
                <th className="py-1 px-2 font-semibold text-center">Resolved</th>
                <th className="py-1 px-2 font-semibold text-center text-rose-600">Overdue</th>
                <th className="py-1 pl-2 font-semibold text-right">Avg Resolution</th>
              </tr>
            </thead>
            <tbody>
              {summary.by_department.map((row) => (
                <tr key={row.department} className="border-t border-slate-100">
                  <td className="py-1.5 pr-3 font-semibold text-slate-800">{row.department}</td>
                  <td className="py-1.5 px-2 text-center text-slate-700">{row.total}</td>
                  <td className="py-1.5 px-2 text-center text-slate-500">{row.new}</td>
                  <td className="py-1.5 px-2 text-center text-sky-700">{row.in_progress}</td>
                  <td className="py-1.5 px-2 text-center text-emerald-700">{row.resolved}</td>
                  <td className={`py-1.5 px-2 text-center font-bold ${row.overdue > 0 ? 'text-rose-700' : 'text-slate-400'}`}>{row.overdue}</td>
                  <td className="py-1.5 pl-2 text-right text-slate-700">
                    {row.avg_resolution_days != null ? `${row.avg_resolution_days}d` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
