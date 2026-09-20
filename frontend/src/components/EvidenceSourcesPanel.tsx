import React, { useState } from 'react';
import { EvidenceSignal, EvidenceSourceType, PatternDetail } from '../types';
import { refreshPatternEvidence } from '../api';
import {
  CloudSun, Satellite, Navigation, TrainFront, Camera,
  RefreshCw, CheckCircle2, XCircle, MinusCircle, ShieldCheck, FlaskConical
} from 'lucide-react';

const SOURCE_META: Record<EvidenceSourceType, { label: string; Icon: React.ElementType }> = {
  noaa_weather: { label: 'NOAA Weather', Icon: CloudSun },
  satellite: { label: 'Satellite Imagery', Icon: Satellite },
  mobility_gps: { label: 'Mobility (GPS)', Icon: Navigation },
  public_transit: { label: 'Public Transit', Icon: TrainFront },
  cctv_camera: { label: 'CCTV / Traffic Camera', Icon: Camera },
};

const SOURCE_ORDER: EvidenceSourceType[] = ['noaa_weather', 'cctv_camera', 'satellite', 'mobility_gps', 'public_transit'];

interface EvidenceSourcesPanelProps {
  patternId: string;
  evidenceSignals: Partial<Record<EvidenceSourceType, EvidenceSignal>>;
  onRefreshed: (updated: any) => void;
}

/**
 * Root-cause accuracy comes from independent sources, not more citizen
 * reports. This surfaces every source consulted for a pattern — what it
 * found, whether it's real or a simulated stand-in for a paid API this
 * environment doesn't have credentials for, and whether it corroborates
 * the detected hazard.
 */
export const EvidenceSourcesPanel: React.FC<EvidenceSourcesPanelProps> = ({
  patternId, evidenceSignals, onRefreshed
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const updated = await refreshPatternEvidence(patternId);
      onRefreshed(updated);
    } catch {
      setError('Failed to refresh evidence sources.');
    } finally {
      setRefreshing(false);
    }
  };

  const sources = SOURCE_ORDER.map((key) => ({ key, signal: evidenceSignals[key] })).filter((s) => s.signal);

  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-teal-50 rounded-lg text-teal-600">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800">Multi-Source Root-Cause Evidence</h3>
            <p className="text-[10px] text-slate-500">Independent of citizen reports — used to corroborate or rule out each hypothesis</p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-teal-700 bg-teal-50 border border-teal-200 hover:bg-teal-100 disabled:opacity-50 transition"
        >
          <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Refresh live data</span>
        </button>
      </div>

      {error && <p className="text-[11px] text-rose-600 font-medium">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {sources.map(({ key, signal }) => {
          if (!signal) return null;
          const meta = SOURCE_META[key];
          const dimmed = !signal.relevant || !signal.available;
          return (
            <div
              key={key}
              className={`p-2.5 rounded-xl border space-y-1.5 ${dimmed ? 'bg-slate-50 border-slate-150 opacity-60' : 'bg-white border-slate-200'}`}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center space-x-1.5 text-[11px] font-bold text-slate-800">
                  <meta.Icon className="w-3.5 h-3.5 text-teal-600" />
                  <span>{meta.label}</span>
                </span>
                <span className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${
                  signal.is_simulated
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  <FlaskConical className="w-2.5 h-2.5" />
                  <span>{signal.is_simulated ? 'Simulated' : 'Real data'}</span>
                </span>
              </div>

              {!signal.relevant ? (
                <p className="text-[10px] text-slate-400">Not applicable to this hazard type.</p>
              ) : !signal.available ? (
                <p className="text-[10px] text-slate-400">{signal.interpretation || 'No reading available.'}</p>
              ) : (
                <>
                  <p className="text-[10px] text-slate-600 leading-snug">{signal.interpretation}</p>
                  <div className="flex items-center space-x-1 text-[10px] font-semibold">
                    {signal.supports === true && (
                      <span className="flex items-center space-x-1 text-emerald-700">
                        <CheckCircle2 className="w-3 h-3" /><span>Corroborates hazard</span>
                      </span>
                    )}
                    {signal.supports === false && (
                      <span className="flex items-center space-x-1 text-slate-400">
                        <XCircle className="w-3 h-3" /><span>Does not corroborate</span>
                      </span>
                    )}
                    {signal.supports === null && (
                      <span className="flex items-center space-x-1 text-slate-400">
                        <MinusCircle className="w-3 h-3" /><span>Neutral</span>
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
