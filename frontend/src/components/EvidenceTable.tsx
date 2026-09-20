import React, { useState } from 'react';
import { EventItem } from '../types';
import { getCategoryMeta } from '../utils/categoryConfig';
import { Table, ArrowUpDown, Image as ImageIcon, Camera, User as UserIcon } from 'lucide-react';

interface EvidenceTableProps {
  events: EventItem[];
}

export const EvidenceTable: React.FC<EvidenceTableProps> = ({ events }) => {
  const [sortField, setSortField] = useState<'timestamp' | 'severity'>('timestamp');
  const [sortAsc, setSortAsc] = useState(false);

  const sortedEvents = [...events].sort((a, b) => {
    if (sortField === 'timestamp') {
      const ta = new Date(a.timestamp).getTime();
      const tb = new Date(b.timestamp).getTime();
      return sortAsc ? ta - tb : tb - ta;
    } else {
      return sortAsc ? a.severity - b.severity : b.severity - a.severity;
    }
  });

  const toggleSort = (field: 'timestamp' | 'severity') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Table className="w-4 h-4 text-sky-600" />
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Evidence Observations Table ({events.length})
          </h4>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center space-x-2 text-[11px]">
          <button
            onClick={() => toggleSort('timestamp')}
            className={`flex items-center space-x-1 px-2 py-1 rounded ${
              sortField === 'timestamp' ? 'bg-sky-100 text-sky-700 font-semibold' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            <span>Time</span>
            <ArrowUpDown className="w-3 h-3" />
          </button>
          <button
            onClick={() => toggleSort('severity')}
            className={`flex items-center space-x-1 px-2 py-1 rounded ${
              sortField === 'severity' ? 'bg-sky-100 text-sky-700 font-semibold' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            <span>Severity</span>
            <ArrowUpDown className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto max-h-60 rounded-lg border border-slate-100">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-slate-50 text-slate-500 font-semibold sticky top-0 border-b border-slate-200">
            <tr>
              <th className="py-2 px-3">Time</th>
              <th className="py-2 px-3">Category</th>
              <th className="py-2 px-3">Sev</th>
              <th className="py-2 px-3">Source</th>
              <th className="py-2 px-3">Submitter</th>
              <th className="py-2 px-3">Evidence</th>
              <th className="py-2 px-3">Tag</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {sortedEvents.map((ev) => {
              const meta = getCategoryMeta(ev.category);
              return (
                <tr key={ev.event_id} className="hover:bg-slate-50/80 transition">
                  <td className="py-2 px-3 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                    {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-2 px-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${meta.bgColor} ${meta.color}`}>
                      {meta.label}
                    </span>
                  </td>
                  <td className="py-2 px-3 font-semibold">
                    <span className={ev.severity >= 4 ? 'text-rose-600' : 'text-slate-700'}>
                      {ev.severity}/5
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    {ev.evidence_source_type === 'cctv_camera' ? (
                      <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                        <Camera className="w-2.5 h-2.5" />
                        <span>CCTV</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                        <UserIcon className="w-2.5 h-2.5" />
                        <span>Citizen</span>
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">
                    {ev.submitter_id}
                  </td>
                  <td className="py-2 px-3">
                    {ev.image_path ? (
                      <div className="flex items-center space-x-1 text-sky-600 font-medium text-[11px]">
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>Photo</span>
                      </div>
                    ) : (
                      <span className="text-slate-400 text-[11px]">Text report</span>
                    )}
                  </td>
                  <td className="py-2 px-3">
                    {ev.is_synthetic ? (
                      <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[9px] font-semibold border border-amber-200">
                        Synthetic
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[9px] font-semibold border border-emerald-200">
                        Real
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
