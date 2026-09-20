import React from 'react';
import { ScoreBreakdown as ScoreBreakdownType } from '../types';
import { ShieldCheck, Info } from 'lucide-react';

interface ScoreBreakdownProps {
  breakdown: ScoreBreakdownType;
  totalScore: number;
}

export const ScoreBreakdown: React.FC<ScoreBreakdownProps> = ({ breakdown, totalScore }) => {
  const metrics = [
    {
      key: 'independent_evidence',
      label: 'Independent Evidence',
      val: breakdown.independent_evidence || 0,
      max: 25,
      color: 'bg-sky-500',
      desc: 'Distinct submitter IDs reporting problems in cluster'
    },
    {
      key: 'spatial_consistency',
      label: 'Spatial Consistency',
      val: breakdown.spatial_consistency || 0,
      max: 20,
      color: 'bg-emerald-500',
      desc: 'Cluster tightness (average distance from centroid)'
    },
    {
      key: 'temporal_recurrence',
      label: 'Temporal Recurrence',
      val: breakdown.temporal_recurrence || 0,
      max: 20,
      color: 'bg-indigo-500',
      desc: 'Peak time window concentration & multi-day recurrence'
    },
    {
      key: 'category_cooccurrence',
      label: 'Category Co-occurrence',
      val: breakdown.category_cooccurrence || 0,
      max: 25,
      color: 'bg-purple-500',
      desc: 'Categories with lift > 1.5 + causal chain bonus'
    },
    {
      key: 'detection_confidence',
      label: 'Detection Confidence',
      val: breakdown.detection_confidence || 0,
      max: 10,
      color: 'bg-amber-500',
      desc: 'Average AI vision/text perception confidence score'
    },
    {
      key: 'cross_source_corroboration',
      label: 'Cross-Source Corroboration',
      val: breakdown.cross_source_corroboration || 0,
      max: 15,
      color: 'bg-teal-500',
      desc: 'Bonus for independent, non-citizen evidence (NOAA, CCTV, satellite, mobility, transit) that corroborates the hazard'
    },
  ];

  const penaltyVal = Math.abs(breakdown.duplication_penalty || 0);

  return (
    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-sky-600" />
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Why This Was Flagged (Score Breakdown)
          </h4>
        </div>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-700">
          Total Score: {totalScore}/100
        </span>
      </div>

      <div className="space-y-2.5">
        {metrics.map((m) => {
          const pct = Math.min(100, Math.max(0, (m.val / m.max) * 100));
          return (
            <div key={m.key} className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center space-x-1.5 font-medium text-slate-700">
                  <span>{m.label}</span>
                  <span className="group relative cursor-pointer">
                    <Info className="w-3 h-3 text-slate-400 hover:text-slate-600" />
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block w-48 p-1.5 bg-slate-900 text-white text-[10px] rounded shadow-lg z-20">
                      {m.desc}
                    </span>
                  </span>
                </div>
                <span className="font-semibold text-slate-900">
                  {m.val.toFixed(1)} / {m.max} pts
                </span>
              </div>
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${m.color} transition-all duration-500 rounded-full`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}

        {/* Deduplication Penalty Row */}
        {penaltyVal > 0 && (
          <div className="pt-1.5 border-t border-slate-200 flex justify-between items-center text-xs text-rose-600 font-medium">
            <span>Noise & Duplicate Penalty</span>
            <span>-{penaltyVal.toFixed(1)} pts</span>
          </div>
        )}
      </div>
    </div>
  );
};
