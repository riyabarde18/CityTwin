import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Users, AlertCircle, Camera, User as UserIcon } from 'lucide-react';
import { EventItem } from '../types';

interface SourceChartProps {
  events: EventItem[];
}

const CITIZEN_COLOR = '#0ea5e9';  // sky-500 — matches the "Citizen" badge used in the evidence table
const CAMERA_COLOR = '#14b8a6';   // teal-500 — matches the "CCTV" badge used elsewhere

export const SourceChart: React.FC<SourceChartProps> = ({ events }) => {
  const data = useMemo(() => {
    const bySubmitter = new Map<string, { count: number; isCamera: boolean }>();
    for (const ev of events) {
      const existing = bySubmitter.get(ev.submitter_id);
      const isCamera = ev.evidence_source_type === 'cctv_camera';
      if (existing) {
        existing.count += 1;
      } else {
        bySubmitter.set(ev.submitter_id, { count: 1, isCamera });
      }
    }
    return Array.from(bySubmitter.entries())
      .map(([submitter, { count, isCamera }]) => ({
        submitter: submitter.length > 12 ? `${submitter.substring(0, 12)}…` : submitter,
        fullSubmitter: submitter,
        count,
        isCamera,
      }))
      .sort((a, b) => b.count - a.count);
  }, [events]);

  const citizenCount = data.filter((d) => !d.isCamera).length;
  const cameraCount = data.filter((d) => d.isCamera).length;

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center space-x-2">
          <Users className="w-4 h-4 text-sky-600" />
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Submitter Source Distribution
          </h4>
        </div>
        <span className="text-xs font-semibold text-slate-500">
          {data.length} Independent Sources
        </span>
      </div>

      {/* Legend — makes the two colors mean something at a glance */}
      <div className="flex items-center gap-4 text-[10px] font-semibold text-slate-600">
        <span className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CITIZEN_COLOR }} />
          <UserIcon className="w-3 h-3 text-slate-400" />
          <span>Citizen reports ({citizenCount})</span>
        </span>
        {cameraCount > 0 && (
          <span className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CAMERA_COLOR }} />
            <Camera className="w-3 h-3 text-slate-400" />
            <span>Fixed cameras ({cameraCount})</span>
          </span>
        )}
      </div>

      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: -25, bottom: 28 }}>
            <XAxis
              dataKey="submitter"
              tick={{ fontSize: 9, fill: '#64748b' }}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fontSize: 9, fill: '#64748b' }} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0b1730',
                color: '#fff',
                borderRadius: '8px',
                fontSize: '11px',
                border: 'none',
              }}
              formatter={((value: number, _name: any, item: any) => [
                `${value} report${value === 1 ? '' : 's'}`,
                item?.payload?.isCamera ? 'Fixed camera' : 'Citizen',
              ]) as any}
              labelFormatter={((_label: any, payload: any) => payload?.[0]?.payload?.fullSubmitter || '') as any}
            />
            <Bar dataKey="count" radius={[3, 3, 0, 0]}>
              {data.map((entry) => (
                <Cell key={entry.fullSubmitter} fill={entry.isCamera ? CAMERA_COLOR : CITIZEN_COLOR} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Ground Truth Caution Note */}
      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-start space-x-2 text-[11px] text-slate-600">
        <AlertCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <p className="leading-tight">
          <strong className="font-semibold text-slate-700">Caution:</strong> High report volume from a single submitter reflects report density, not verified ground-truth severity.
        </p>
      </div>
    </div>
  );
};
