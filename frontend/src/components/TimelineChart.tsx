import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Clock } from 'lucide-react';

interface TimelineChartProps {
  timeline: Record<string, number>;
  timeWindow: string;
}

export const TimelineChart: React.FC<TimelineChartProps> = ({ timeline, timeWindow }) => {
  // Generate 24 hours timeline data
  const data = Array.from({ length: 24 }, (_, i) => {
    const hStr = `${i.toString().padStart(2, '0')}:00`;
    return {
      hour: hStr,
      hourNum: i,
      count: timeline[hStr] || 0
    };
  });

  // Extract start and end hour from timeWindow string like "17:30-19:30"
  let startH = 17;
  let endH = 19;
  if (timeWindow) {
    const parts = timeWindow.split('-');
    if (parts.length === 2) {
      startH = parseInt(parts[0].split(':')[0], 10) || 17;
      endH = parseInt(parts[1].split(':')[0], 10) || 19;
    }
  }

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <Clock className="w-4 h-4 text-sky-600" />
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Temporal Concentration Timeline
          </h4>
        </div>
        <span className="text-xs font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
          Flagged Window: {timeWindow}
        </span>
      </div>

      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <XAxis
              dataKey="hour"
              tick={{ fontSize: 9, fill: '#64748b' }}
              interval={2}
            />
            <YAxis tick={{ fontSize: 9, fill: '#64748b' }} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0f172a',
                color: '#fff',
                borderRadius: '8px',
                fontSize: '11px',
                padding: '6px 10px'
              }}
            />
            <Bar dataKey="count" radius={[3, 3, 0, 0]}>
              {data.map((entry) => {
                const isPeak = entry.hourNum >= startH && entry.hourNum <= endH;
                return (
                  <Cell
                    key={`cell-${entry.hourNum}`}
                    fill={isPeak ? '#0284c7' : '#cbd5e1'}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
