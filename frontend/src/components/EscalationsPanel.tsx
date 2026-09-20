import React, { useEffect, useState } from 'react';
import { Escalation } from '../types';
import { getEscalations, scanEscalations, acknowledgeEscalation } from '../api';
import { AlertTriangle, CloudRain, RefreshCw, CheckCircle2, Radar } from 'lucide-react';

const RISK_META: Record<string, { bg: string; border: string; text: string; label: string }> = {
  severe: { bg: 'bg-rose-50', border: 'border-rose-300', text: 'text-rose-700', label: 'Severe Risk' },
  elevated: { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-700', label: 'Elevated Risk' },
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * Proactive notifications to the department: a problem that's been open too
 * long, sitting in a zone where severe weather is forecast — i.e. something
 * that could turn dangerous if left unresolved. No SMS/email/push channel is
 * wired up in this build, so this panel *is* the notification surface.
 */
export const EscalationsPanel: React.FC = () => {
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ackingId, setAckingId] = useState<string | null>(null);
  const [lastScanMsg, setLastScanMsg] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getEscalations({ acknowledged: false });
      setEscalations(data);
    } catch (err: any) {
      setError('Failed to load risk escalations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleScan = async () => {
    setScanning(true);
    setError(null);
    setLastScanMsg(null);
    try {
      const created = await scanEscalations();
      setLastScanMsg(
        created.length > 0
          ? `Found ${created.length} new risk escalation${created.length > 1 ? 's' : ''}.`
          : 'No new risk escalations — either nothing overdue, or no severe weather forecast right now.'
      );
      await load();
    } catch (err: any) {
      setError('Risk scan failed (weather service unreachable). Try again shortly.');
    } finally {
      setScanning(false);
    }
  };

  const handleAcknowledge = async (id: string) => {
    setAckingId(id);
    try {
      await acknowledgeEscalation(id, 'Department Officer');
      setEscalations((prev) => prev.filter((e) => e.id !== id));
    } catch {
      setError('Failed to acknowledge escalation.');
    } finally {
      setAckingId(null);
    }
  };

  if (!loading && escalations.length === 0 && !lastScanMsg) {
    // Quiet by default — only take up space when there's something to say,
    // but still offer the manual scan trigger for the demo.
    return (
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <span className="text-[11px] text-slate-500 flex items-center space-x-1.5">
          <Radar className="w-3.5 h-3.5 text-slate-400" />
          <span>No active risk escalations for this department right now.</span>
        </span>
        <button
          onClick={handleScan}
          disabled={scanning}
          className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 transition"
        >
          <RefreshCw className={`w-3 h-3 ${scanning ? 'animate-spin' : ''}`} />
          <span>Check for risk now</span>
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-rose-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-rose-50 border-b border-rose-100">
        <span className="text-xs font-bold text-rose-800 flex items-center space-x-1.5">
          <AlertTriangle className="w-4 h-4" />
          <span>Risk Escalations ({escalations.length})</span>
        </span>
        <button
          onClick={handleScan}
          disabled={scanning}
          className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold text-rose-700 bg-white border border-rose-200 hover:bg-rose-100 disabled:opacity-50 transition"
        >
          <RefreshCw className={`w-3 h-3 ${scanning ? 'animate-spin' : ''}`} />
          <span>Check for risk now</span>
        </button>
      </div>

      {lastScanMsg && (
        <p className="text-[10px] text-slate-500 px-3.5 py-1.5 bg-slate-50 border-b border-slate-100">{lastScanMsg}</p>
      )}
      {error && <p className="text-[11px] text-rose-600 font-medium px-3.5 py-1.5">{error}</p>}

      <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
        {escalations.map((esc) => {
          const meta = RISK_META[esc.risk_level] || RISK_META.elevated;
          return (
            <div key={esc.id} className={`p-3 space-y-1.5 ${meta.bg}`}>
              <div className="flex items-center justify-between flex-wrap gap-1.5">
                <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${meta.border} ${meta.text} bg-white`}>
                  <CloudRain className="w-3 h-3" />
                  <span>{meta.label}</span>
                </span>
                <span className="text-[10px] text-slate-500">{formatDate(esc.created_at)}</span>
              </div>
              <p className="text-[11px] text-slate-700">{esc.reason}</p>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-slate-500">{esc.department} · {esc.zone}</span>
                <button
                  onClick={() => handleAcknowledge(esc.id)}
                  disabled={ackingId === esc.id}
                  className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-50 transition"
                >
                  {ackingId === esc.id ? (
                    <span className="w-2.5 h-2.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-2.5 h-2.5" />
                  )}
                  <span>Acknowledge</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
