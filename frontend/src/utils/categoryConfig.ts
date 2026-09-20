import { UrbanCategory } from '../types';

export interface CategoryMeta {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  hex: string;
}

export const CATEGORY_MAP: Record<UrbanCategory, CategoryMeta> = {
  standing_water: {
    label: 'Standing Water',
    color: 'text-sky-700',
    bgColor: 'bg-sky-100',
    borderColor: 'border-sky-300',
    hex: '#0284c7'
  },
  footpath_obstruction: {
    label: 'Footpath Obstruction',
    color: 'text-amber-700',
    bgColor: 'bg-amber-100',
    borderColor: 'border-amber-300',
    hex: '#f59e0b'
  },
  pedestrian_on_road: {
    label: 'Pedestrian on Road',
    color: 'text-rose-700',
    bgColor: 'bg-rose-100',
    borderColor: 'border-rose-300',
    hex: '#ef4444'
  },
  traffic_slowdown: {
    label: 'Traffic Slowdown',
    color: 'text-purple-700',
    bgColor: 'bg-purple-100',
    borderColor: 'border-purple-300',
    hex: '#8b5cf6'
  },
  damaged_surface: {
    label: 'Damaged Surface',
    color: 'text-pink-700',
    bgColor: 'bg-pink-100',
    borderColor: 'border-pink-300',
    hex: '#ec4899'
  },
  garbage: {
    label: 'Garbage',
    color: 'text-slate-700',
    bgColor: 'bg-slate-200',
    borderColor: 'border-slate-400',
    hex: '#64748b'
  },
  unsafe_crossing: {
    label: 'Unsafe Crossing',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-100',
    borderColor: 'border-emerald-300',
    hex: '#10b981'
  },
  accessibility_barrier: {
    label: 'Accessibility Barrier',
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
    borderColor: 'border-orange-300',
    hex: '#d97706'
  }
};

export const getCategoryMeta = (cat: UrbanCategory): CategoryMeta => {
  return CATEGORY_MAP[cat] || {
    label: cat,
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-300',
    hex: '#6b7280'
  };
};
