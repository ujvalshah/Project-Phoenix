import React from 'react';
import { X } from 'lucide-react';

export interface AppliedFilterChip {
  id: string;
  label: string;
  onRemove: () => void;
}

interface AppliedFiltersBarProps {
  filters: AppliedFilterChip[];
  onClearAll: () => void;
}

export const AppliedFiltersBar: React.FC<AppliedFiltersBarProps> = ({ filters, onClearAll }) => {
  if (filters.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">
        Filters
      </span>
      {filters.map((filter) => (
        <button
          key={filter.id}
          onClick={filter.onRemove}
          className="inline-flex h-7 items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 text-[12px] font-medium text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <span className="truncate max-w-[220px]">{filter.label}</span>
          <X size={12} className="text-slate-400" />
        </button>
      ))}

      <button
        onClick={onClearAll}
        className="ml-1 h-7 rounded-full px-2 text-[12px] font-semibold text-slate-500 transition-colors hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-slate-400 dark:hover:text-white"
      >
        Clear all
      </button>
    </div>
  );
};
