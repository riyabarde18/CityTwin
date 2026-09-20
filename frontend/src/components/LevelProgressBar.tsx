import React from 'react';
import { PointsSummary, ContributionLevel } from '../types';
import { Award, Medal, Trophy, Crown, Sparkles } from 'lucide-react';

const LEVEL_META: Record<ContributionLevel, { icon: React.ElementType; color: string; bg: string }> = {
  'Newcomer': { icon: Sparkles, color: 'text-slate-500', bg: 'bg-slate-100' },
  'Bronze Citizen': { icon: Medal, color: 'text-amber-700', bg: 'bg-amber-100' },
  'Silver Citizen': { icon: Award, color: 'text-slate-500', bg: 'bg-slate-200' },
  'Gold Citizen': { icon: Trophy, color: 'text-amber-500', bg: 'bg-amber-100' },
  'City Champion': { icon: Crown, color: 'text-sky-600', bg: 'bg-sky-100' },
};

interface LevelProgressBarProps {
  summary: PointsSummary;
}

export const LevelProgressBar: React.FC<LevelProgressBarProps> = ({ summary }) => {
  const meta = LEVEL_META[summary.level] || LEVEL_META['Newcomer'];
  const Icon = meta.icon;

  return (
    <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center space-x-2.5">
          <div className={`p-2 rounded-full ${meta.bg}`}>
            <Icon className={`w-5 h-5 ${meta.color}`} />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Current Level</p>
            <p className="text-base font-extrabold text-navy-900">{summary.level}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Lifetime Points</p>
          <p className="text-base font-extrabold text-navy-900">{summary.total_points_earned}</p>
        </div>
      </div>

      {summary.next_level ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-500">
              <span className="font-bold text-navy-800">{summary.points_to_next} pts</span> to {summary.next_level}
            </span>
            <span className="font-bold text-sky-700">{summary.progress_pct.toFixed(0)}%</span>
          </div>
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-3 bg-gradient-to-r from-sky-400 to-navy-700 rounded-full transition-all duration-700"
              style={{ width: `${summary.progress_pct}%` }}
            />
          </div>
        </div>
      ) : (
        <p className="text-[11px] font-semibold text-sky-700 bg-sky-50 border border-sky-200 rounded-lg px-3 py-2 text-center">
          🎉 You've reached the top level — City Champion!
        </p>
      )}
    </div>
  );
};
