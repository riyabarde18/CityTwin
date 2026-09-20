import React, { useState } from 'react';
import { ClipboardList, CheckSquare, Square } from 'lucide-react';

interface FieldChecklistProps {
  recommendations: string[];
}

export const FieldChecklist: React.FC<FieldChecklistProps> = ({ recommendations }) => {
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});

  const toggleCheck = (idx: number) => {
    setCheckedItems(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <ClipboardList className="w-4 h-4 text-sky-600" />
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Recommended Field Investigation Checklist
          </h4>
        </div>
        <span className="text-[11px] font-medium text-slate-500">
          {Object.values(checkedItems).filter(Boolean).length} / {recommendations.length} Verified
        </span>
      </div>

      <div className="space-y-2">
        {recommendations.map((rec, idx) => {
          const isChecked = !!checkedItems[idx];
          return (
            <div
              key={idx}
              onClick={() => toggleCheck(idx)}
              className={`p-2.5 rounded-lg border text-xs cursor-pointer transition flex items-start space-x-2.5 ${
                isChecked
                  ? 'bg-emerald-50/70 border-emerald-200 text-slate-500 line-through'
                  : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
              }`}
            >
              {isChecked ? (
                <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <Square className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              )}
              <span className="leading-snug">{rec}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
