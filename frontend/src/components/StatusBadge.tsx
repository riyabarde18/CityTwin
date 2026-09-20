import React from 'react';
import { PatternStatus } from '../types';
import { Circle, Eye, Wrench, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

interface StatusMeta {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  Icon: React.ElementType;
}

export const STATUS_META: Record<PatternStatus, StatusMeta> = {
  new: {
    label: 'New — Unacknowledged',
    color: 'text-slate-700',
    bgColor: 'bg-slate-100',
    borderColor: 'border-slate-300',
    Icon: Circle,
  },
  acknowledged: {
    label: 'Acknowledged',
    color: 'text-amber-700',
    bgColor: 'bg-amber-100',
    borderColor: 'border-amber-300',
    Icon: Eye,
  },
  in_progress: {
    label: 'In Progress',
    color: 'text-sky-700',
    bgColor: 'bg-sky-100',
    borderColor: 'border-sky-300',
    Icon: Wrench,
  },
  resolved: {
    label: 'Resolved',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-100',
    borderColor: 'border-emerald-300',
    Icon: CheckCircle2,
  },
  rejected: {
    label: 'Rejected / Not Applicable',
    color: 'text-rose-700',
    bgColor: 'bg-rose-100',
    borderColor: 'border-rose-300',
    Icon: XCircle,
  },
};

interface StatusBadgeProps {
  status: PatternStatus;
  overdue?: boolean;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, overdue, size = 'sm' }) => {
  const meta = STATUS_META[status] || STATUS_META.new;
  const { Icon } = meta;
  const padding = size === 'md' ? 'px-3 py-1.5 text-xs' : 'px-2 py-0.5 text-[10px]';

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`inline-flex items-center space-x-1 rounded-full border font-bold ${padding} ${meta.color} ${meta.bgColor} ${meta.borderColor}`}
      >
        <Icon className="w-3 h-3" />
        <span>{meta.label}</span>
      </span>
      {overdue && (
        <span className={`inline-flex items-center space-x-1 rounded-full border font-bold ${padding} text-rose-700 bg-rose-50 border-rose-300`}>
          <AlertTriangle className="w-3 h-3" />
          <span>Overdue</span>
        </span>
      )}
    </span>
  );
};
