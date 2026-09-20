import React from 'react';
import { UrbanCategory } from '../types';
import { CATEGORY_MAP } from '../utils/categoryConfig';
import { Filter } from 'lucide-react';

interface CategoryFilterProps {
  selectedCategories: UrbanCategory[];
  onToggleCategory: (cat: UrbanCategory) => void;
  onClearAll: () => void;
}

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  selectedCategories,
  onToggleCategory,
  onClearAll
}) => {
  const allCategories = Object.keys(CATEGORY_MAP) as UrbanCategory[];

  return (
    <div className="bg-white/90 backdrop-blur-sm p-3 rounded-xl shadow-lg border border-slate-200/80 max-w-xl">
      <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-100">
        <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700">
          <Filter className="w-3.5 h-3.5 text-sky-600" />
          <span>Category Filter & Map Legend</span>
        </div>
        {selectedCategories.length < allCategories.length && (
          <button
            onClick={onClearAll}
            className="text-[11px] font-medium text-sky-600 hover:text-sky-800"
          >
            Select All ({allCategories.length})
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {allCategories.map((cat) => {
          const meta = CATEGORY_MAP[cat];
          const isSelected = selectedCategories.includes(cat);
          return (
            <button
              key={cat}
              onClick={() => onToggleCategory(cat)}
              className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
                isSelected
                  ? `${meta.bgColor} ${meta.color} ${meta.borderColor} border shadow-xs`
                  : 'bg-slate-100 text-slate-400 border border-transparent line-through opacity-60 hover:opacity-100'
              }`}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: meta.hex }}
              />
              <span>{meta.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
