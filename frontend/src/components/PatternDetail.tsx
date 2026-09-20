import React from 'react';
import { PatternDetail as PatternDetailType, InterventionResult } from '../types';
import { ScoreBreakdown } from './ScoreBreakdown';
import { CausalGraph } from './CausalGraph';
import { TimelineChart } from './TimelineChart';
import { Explanations } from './Explanations';
import { FieldChecklist } from './FieldChecklist';
import { EvidenceTable } from './EvidenceTable';
import { SourceChart } from './SourceChart';
import { BeforeAfterView } from './BeforeAfterView';
import { GovernanceSection } from './GovernanceSection';
import { StatusBadge } from './StatusBadge';
import { EvidenceSourcesPanel } from './EvidenceSourcesPanel';
import { CascadeRiskGraph } from './CascadeRiskGraph';
import { Flame, Users, Clock, Zap, CheckCircle2 } from 'lucide-react';

interface PatternDetailProps {
  pattern: PatternDetailType | null;
  loading: boolean;
  interventionResult: InterventionResult | null;
  onPatternUpdated?: (updated: PatternDetailType) => void;
}

export const PatternDetail: React.FC<PatternDetailProps> = ({
  pattern,
  loading,
  interventionResult,
  onPatternUpdated
}) => {
  if (loading) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center space-y-3 min-h-[400px]">
        <div className="w-8 h-8 border-3 border-sky-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold text-slate-600">Loading pattern detailed intelligence...</p>
      </div>
    );
  }

  if (!pattern) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center space-y-3 min-h-[400px]">
        <div className="p-3 bg-slate-100 rounded-full text-slate-400">
          <Zap className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-800">No Hotspot Selected</h3>
          <p className="text-xs text-slate-500 max-w-xs mt-1">
            Click &quot;Run CityTwin analysis&quot; in topbar or click a highlighted hotspot circle on the map to inspect urban pattern details.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      
      {/* Headline Header */}
      <div className="bg-gradient-to-br from-navy-950 via-navy-800 to-navy-700 text-white p-5 rounded-2xl shadow-lg space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center space-x-2 flex-wrap gap-1.5">
            <span className="px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center space-x-1">
              <Flame className="w-3.5 h-3.5 fill-current" />
              <span>Emerging Pattern Hotspot</span>
            </span>
            <StatusBadge status={pattern.status} overdue={pattern.is_overdue} />
          </div>

          <div className="text-right">
            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">Pattern Score</span>
            <span className="text-2xl font-extrabold text-sky-400">{pattern.score}<span className="text-xs text-slate-400 font-normal">/100</span></span>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-bold tracking-tight text-white">
            {pattern.top_categories.map(c => c.replace('_', ' ')).join(' → ')}
          </h2>
          <p className="text-xs text-slate-300 mt-0.5">
            Location Radius ~{pattern.radius_m}m around Lat {pattern.center.lat.toFixed(4)}, Lon {pattern.center.lon.toFixed(4)}
          </p>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-4 gap-2 pt-2 border-t border-navy-600/80 text-center">
          <div className="bg-navy-900/60 p-2 rounded-lg">
            <span className="text-[10px] text-sky-200/70 font-medium block">Total Events</span>
            <span className="text-xs font-bold text-white">{pattern.event_count}</span>
          </div>
          <div className="bg-navy-900/60 p-2 rounded-lg">
            <span className="text-[10px] text-sky-200/70 font-medium block">Submitters</span>
            <span className="text-xs font-bold text-sky-300 flex items-center justify-center space-x-1">
              <Users className="w-3 h-3" />
              <span>{pattern.independent_source_count}</span>
            </span>
          </div>
          <div className="bg-navy-900/60 p-2 rounded-lg">
            <span className="text-[10px] text-sky-200/70 font-medium block">Peak Window</span>
            <span className="text-xs font-bold text-amber-300 flex items-center justify-center space-x-1">
              <Clock className="w-3 h-3" />
              <span>{pattern.time_window}</span>
            </span>
          </div>
          <div className="bg-navy-900/60 p-2 rounded-lg">
            <span className="text-[10px] text-sky-200/70 font-medium block">Confidence</span>
            <span className="text-xs font-bold text-emerald-400 flex items-center justify-center space-x-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>{Math.round(pattern.confidence * 100)}%</span>
            </span>
          </div>
        </div>
      </div>

      {/* Intervention Results (if simulated) */}
      {interventionResult && (
        <BeforeAfterView result={interventionResult} />
      )}

      {/* Section 1: Cascade Risk Prediction — small observations → hidden pattern → escalation */}
      <CascadeRiskGraph pattern={pattern} />

      {/* Section 1.5: Government Accountability & Transparency */}
      <GovernanceSection
        pattern={pattern}
        onStatusChanged={(updated) => onPatternUpdated && onPatternUpdated(updated)}
      />

      {/* Section 2: Why This Was Flagged */}
      <ScoreBreakdown breakdown={pattern.score_breakdown} totalScore={pattern.score} />

      {/* Section 2.5: Multi-Source Root-Cause Evidence */}
      <EvidenceSourcesPanel
        patternId={pattern.id}
        evidenceSignals={pattern.evidence_signals}
        onRefreshed={(updated) => onPatternUpdated && onPatternUpdated(updated)}
      />

      {/* Section 3: Relationship Graph */}
      <CausalGraph graph={pattern.graph} />

      {/* Section 4: Timeline Chart */}
      <TimelineChart timeline={pattern.timeline} timeWindow={pattern.time_window} />

      {/* Section 5: Explanations & Disclaimer */}
      <Explanations
        observedFacts={pattern.observed_facts}
        candidateExplanations={pattern.candidate_explanations}
        disclaimer={pattern.disclaimer}
      />

      {/* Section 6: Recommended Field Investigation */}
      <FieldChecklist recommendations={pattern.recommended_investigation} />

      {/* Section 7: Evidence Table */}
      <EvidenceTable events={pattern.events} />

      {/* Section 8: Submitter Source Distribution */}
      <SourceChart events={pattern.events} />

    </div>
  );
};
