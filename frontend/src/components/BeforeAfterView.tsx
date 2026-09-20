import React from 'react';
import { InterventionResult } from '../types';
import { getCategoryMeta } from '../utils/categoryConfig';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Sparkles, TrendingDown, CheckCircle } from 'lucide-react';

interface BeforeAfterViewProps {
  result: InterventionResult;
  onClose?: () => void;
}

export const BeforeAfterView: React.FC<BeforeAfterViewProps> = ({ result, onClose }) => {
  const chartData = result.category_comparison.map(item => ({
    category: getCategoryMeta(item.category).label,
    Before: item.before_count,
    After: item.after_count,
    reductionPct: item.reduction_pct
  }));

  return (
    <div className="bg-emerald-50/90 border border-emerald-300 p-5 rounded-2xl shadow-lg space-y-4">
      
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-emerald-200">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-emerald-600 text-white rounded-lg shadow-sm">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Intervention Impact Simulation Result
            </h3>
            <p className="text-xs text-emerald-800 font-medium">
              Simulated Post-Enforcement / Drainage Remediation
            </p>
          </div>
        </div>

        {/* Reduction Badge */}
        <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-xl border border-emerald-300 shadow-sm">
          <TrendingDown className="w-4 h-4 text-emerald-600" />
          <span className="text-base font-extrabold text-emerald-700">
            -{result.overall_reduction_pct}% Drop
          </span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-xs">
          <span className="text-[10px] font-semibold text-slate-500 uppercase">Pre-Fix Reports</span>
          <p className="text-lg font-bold text-rose-600">{result.before_total_events}</p>
        </div>
        <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-xs">
          <span className="text-[10px] font-semibold text-slate-500 uppercase">Post-Fix Reports</span>
          <p className="text-lg font-bold text-emerald-600">{result.after_total_events}</p>
        </div>
        <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-xs">
          <span className="text-[10px] font-semibold text-slate-500 uppercase">Status</span>
          <p className="text-xs font-bold text-emerald-700 mt-1 flex items-center justify-center space-x-1">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            <span>Remediated</span>
          </p>
        </div>
      </div>

      {/* Category Comparison Chart */}
      <div className="bg-white p-4 rounded-xl border border-emerald-200">
        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
          Reports Per Problem Category: Before vs After
        </h4>
        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 20 }}>
              <XAxis dataKey="category" tick={{ fontSize: 9, fill: '#475569' }} angle={-25} textAnchor="end" />
              <YAxis tick={{ fontSize: 9, fill: '#475569' }} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  color: '#fff',
                  borderRadius: '8px',
                  fontSize: '11px'
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              <Bar dataKey="Before" fill="#ef4444" radius={[3, 3, 0, 0]} />
              <Bar dataKey="After" fill="#10b981" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
};
