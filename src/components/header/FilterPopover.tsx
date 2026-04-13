import React from 'react';
import { FilterPanel } from './FilterPanel';
import type { FilterState } from './filterTypes';

interface FilterPopoverProps {
  filters: FilterState;
  onChange: (newFilters: FilterState) => void;
  onClear: () => void;
  resultCount?: number;
}

/** Desktop dropdown filter (non–home routes and legacy shell). Home feed uses `DesktopFilterSidebar`. */
export const FilterPopover: React.FC<FilterPopoverProps> = ({ filters, onChange, onClear, resultCount }) => {
  return (
    <div className="w-[min(860px,94vw)] overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
      <FilterPanel layout="popover" filters={filters} onChange={onChange} onClear={onClear} resultCount={resultCount} />
    </div>
  );
};
