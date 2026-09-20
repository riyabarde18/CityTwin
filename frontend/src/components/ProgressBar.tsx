import React from 'react';
import { PatternStatus } from '../types';

const BAR_COLOR: Record<PatternStatus, string> = {
  new: 'bg-slate-400',
  acknowledged: 'bg-amber-500',
  in_progress: 'bg-sky-500',
  resolved: 'bg-emerald-500',
  rejected: 'bg-rose-400',
};

interface ProgressBarProps {
  percent: number;
  status: PatternStatus;
  label?: string;
  size?: 'sm' | 'md';
}

/** "How far along is it" — a simple, always-answered completion indicator. */
export const ProgressBar: React.FC<ProgressBarProps> = ({ percent, status, label, size = 'sm' }) => {
  const clamped = Math.max(0, Math.min(100, percent));
  const height = size === 'md' ? 'h-2.5' : 'h-1.5';

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold text-slate-500">{label || 'Progress'}</span>
        <span className="text-[10px] font-bold text-slate-700">{clamped}%</span>
      </div>
      <div className={`w-full ${height} bg-slate-100 rounded-full overflow-hidden`}>
        <div
          className={`${height} ${BAR_COLOR[status] || 'bg-slate-400'} rounded-full transition-all duration-500`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
};
