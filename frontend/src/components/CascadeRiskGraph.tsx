import React from 'react';
import { PatternDetail } from '../types';
import { matchCascadeTemplate, RiskLevel } from '../data/cascadeTemplates';
import { Eye, Radar, TrendingUp, ShieldCheck, AlertTriangle, Info } from 'lucide-react';

const RISK_STYLE: Record<RiskLevel, { bg: string; border: string; text: string; dot: string; label: string }> = {
  low: { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-700', dot: 'bg-sky-400', label: 'Low' },
  moderate: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', dot: 'bg-amber-400', label: 'Moderate' },
  high: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', dot: 'bg-orange-500', label: 'High' },
  severe: { bg: 'bg-rose-50', border: 'border-rose-300', text: 'text-rose-700', dot: 'bg-rose-500', label: 'Severe' },
};

interface CascadeRiskGraphProps {
  pattern: PatternDetail;
}

/**
 * Turns "why was this flagged" into "here's what it could become": matches
 * the detected pattern against a library of known small-observation →
 * hidden-pattern → cascading-risk chains, and renders the escalation as a
 * staged severity climb rather than a flat list.
 */
export const CascadeRiskGraph: React.FC<CascadeRiskGraphProps> = ({ pattern }) => {
  const { template, isApproximate } = matchCascadeTemplate(pattern);

  return (
    <div className="bg-white rounded-2xl border border-navy-100 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-navy-800 to-navy-700 px-4 py-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center space-x-2">
          <TrendingUp className="w-4 h-4 text-sky-300" />
          <div>
            <h3 className="text-xs font-bold text-white">Cascade Risk Prediction</h3>
            <p className="text-[10px] text-sky-200/80">{template.title}</p>
          </div>
        </div>
        {isApproximate && (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-white/10 text-sky-200 border border-white/20">
            <Info className="w-2.5 h-2.5" />
            <span>Closest matching scenario — approximate</span>
          </span>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Stage 1: Small observations */}
        <div className="bg-sky-50/70 border border-sky-100 rounded-xl p-3">
          <p className="text-[10px] font-bold text-sky-800 uppercase tracking-wide flex items-center space-x-1.5 mb-2">
            <Eye className="w-3.5 h-3.5" />
            <span>Small Observations</span>
          </p>
          <ul className="space-y-1">
            {template.smallObservations.map((obs, i) => (
              <li key={i} className="text-[11px] text-slate-700 flex items-start space-x-1.5">
                <span className="w-1 h-1 rounded-full bg-sky-400 mt-1.5 shrink-0" />
                <span>{obs}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Stage 2: Hidden pattern */}
        <div className="bg-navy-800 rounded-xl p-3 flex items-start space-x-2.5">
          <Radar className="w-4 h-4 text-sky-300 shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] font-bold text-sky-200 uppercase tracking-wide mb-1">Hidden Pattern Detected</p>
            <p className="text-[11px] text-white leading-snug">{template.hiddenPattern}</p>
          </div>
        </div>

        {/* Stage 3: Escalation path (the cascade itself) */}
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center space-x-1.5 mb-2">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            <span>If Ignored — Escalation Path</span>
          </p>
          <div className="space-y-0">
            {template.cascade.map((stage, i) => {
              const style = RISK_STYLE[stage.riskLevel];
              const isLast = i === template.cascade.length - 1;
              return (
                <div key={i} className="flex space-x-3">
                  <div className="flex flex-col items-center">
                    <span className={`w-3 h-3 rounded-full ${style.dot} ring-4 ring-white shrink-0`} />
                    {!isLast && <span className="w-0.5 flex-1 bg-slate-200 min-h-[24px]" />}
                  </div>
                  <div className={`flex-1 mb-2.5 p-2.5 rounded-xl border ${style.bg} ${style.border}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-slate-800">{stage.label}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${style.text} bg-white/70 border ${style.border}`}>
                        {style.label} risk
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-600 mt-0.5">{stage.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Stage 4: CityTwin response */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
          <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide flex items-center space-x-1.5 mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>CityTwin Response</span>
          </p>
          <ul className="space-y-1">
            {template.cityTwinResponse.map((step, i) => (
              <li key={i} className="text-[11px] text-emerald-900 flex items-start space-x-1.5">
                <span className="font-bold text-emerald-600">{i + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-[10px] text-slate-400 italic pt-1 border-t border-slate-100">
          This is a matched illustrative scenario, not a confirmed prediction — it shows a plausible escalation path for this
          combination of observations so field teams can weigh urgency, not a guaranteed outcome.
        </p>
      </div>
    </div>
  );
};
