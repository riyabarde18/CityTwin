import React from 'react';
import { CandidateExplanation, UrbanCategory } from '../types';
import { getCategoryMeta } from '../utils/categoryConfig';
import { FileText, Lightbulb, AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';

const EVIDENCE_SOURCE_LABELS: Record<string, string> = {
  noaa_weather: 'NOAA Weather',
  satellite: 'Satellite (simulated)',
  mobility_gps: 'Mobility GPS (simulated)',
  public_transit: 'Public Transit (simulated)',
  cctv_camera: 'CCTV Camera',
};

interface ExplanationsProps {
  observedFacts: string[];
  candidateExplanations: CandidateExplanation[];
  disclaimer: string;
}

export const Explanations: React.FC<ExplanationsProps> = ({
  observedFacts,
  candidateExplanations,
  disclaimer
}) => {
  return (
    <div className="space-y-4">
      
      {/* Block 1: Observed Facts */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div className="flex items-center space-x-2 mb-2.5">
          <FileText className="w-4 h-4 text-slate-700" />
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Observed Empirical Facts
          </h4>
        </div>
        <ul className="space-y-1.5">
          {observedFacts.map((fact, idx) => (
            <li key={idx} className="flex items-start space-x-2 text-xs text-slate-700 leading-normal">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
              <span>{fact}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Block 2: Candidate Explanations */}
      <div className="bg-sky-50/60 p-4 rounded-xl border border-sky-200">
        <div className="flex items-center space-x-2 mb-3">
          <Lightbulb className="w-4 h-4 text-sky-600" />
          <h4 className="text-xs font-bold text-sky-900 uppercase tracking-wider">
            AI Candidate Explanations (Hypotheses)
          </h4>
        </div>

        <div className="space-y-3">
          {candidateExplanations.map((exp, idx) => {
            const confPct = Math.round(exp.confidence * 100);
            return (
              <div key={idx} className="bg-white p-3 rounded-lg border border-sky-100 shadow-xs space-y-2">
                <p className="text-xs font-medium text-slate-800 leading-snug">
                  {exp.explanation}
                </p>

                {/* Confidence Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-500 font-medium">Hypothesis Confidence</span>
                    <span className="font-bold text-sky-700">{confPct}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sky-600 rounded-full transition-all duration-500"
                      style={{ width: `${confPct}%` }}
                    />
                  </div>
                </div>

                {/* Supporting Categories */}
                {exp.supporting_categories && exp.supporting_categories.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {exp.supporting_categories.map((cat) => {
                      const meta = getCategoryMeta(cat as UrbanCategory);
                      return (
                        <span
                          key={cat}
                          className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${meta.bgColor} ${meta.color}`}
                        >
                          {meta.label}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Independent evidence sources corroborating this hypothesis */}
                {exp.supporting_evidence_sources && exp.supporting_evidence_sources.length > 0 && (
                  <div className="flex items-center flex-wrap gap-1 pt-1 border-t border-slate-100">
                    <span className="text-[9px] text-slate-400 flex items-center space-x-1">
                      <ShieldCheck className="w-3 h-3 text-teal-600" />
                      <span>Corroborated by:</span>
                    </span>
                    {exp.supporting_evidence_sources.map((src) => (
                      <span key={src} className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                        {EVIDENCE_SOURCE_LABELS[src] || src}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Disclaimer Notice */}
      <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl flex items-start space-x-2 text-xs text-amber-800">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="font-medium italic leading-snug">
          {disclaimer}
        </p>
      </div>

    </div>
  );
};
