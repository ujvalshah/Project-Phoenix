import React from 'react';
import { Filter } from 'lucide-react';
import { useFilterResults } from '@/context/FilterResultsContext';
import { useDesktopFilterSidebar } from '@/context/DesktopFilterSidebarContext';
import { useFilterPanelHandlers } from '@/hooks/useFilterPanelHandlers';
import { useFilters } from '@/context/FilterStateContext';
import { FilterPanel } from './FilterPanel';

/**
 * Persistent collapsible filter column for the home feed (lg+ only).
 * Narrow screens use MobileFilterSheet; non-home routes use the header dropdown.
 */
export const DesktopFilterSidebar: React.FC = () => {
  const { filterState, handleFilterChange, handleFilterClear } = useFilterPanelHandlers();
  const { resultCount } = useFilterResults();
  const { sidebarCollapsed, toggleSidebarCollapsed, setSidebarCollapsed } = useDesktopFilterSidebar();
  const { hasActiveFilters, activeFilterCount } = useFilters();

  return (
    <aside
      className={`relative hidden min-h-0 shrink-0 flex-col border-r border-slate-200/80 bg-white transition-[width] duration-200 ease-out dark:border-slate-800 dark:bg-slate-950 lg:flex ${
        sidebarCollapsed ? 'w-[52px]' : 'w-64 xl:w-72'
      }`}
      aria-label={sidebarCollapsed ? 'Filters collapsed' : 'Filters'}
    >
      {/* Collapsed rail — always mounted, shown only when collapsed.
          Keeping both states mounted avoids re-subscribing React Query and
          re-building tag maps in FilterPanel on every toggle. */}
      <button
        type="button"
        onClick={toggleSidebarCollapsed}
        className={`${sidebarCollapsed ? 'flex' : 'hidden'} sticky top-16 z-10 h-[calc(100vh-4rem)] min-h-[12rem] w-full flex-col items-center gap-2 border-0 bg-transparent px-1.5 py-4 text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-400 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:bg-slate-800/90`}
        aria-expanded={false}
        aria-controls="desktop-filter-panel"
        title="Show filters"
      >
        <Filter size={20} strokeWidth={2} className="shrink-0 text-slate-500 dark:text-slate-400" aria-hidden />
        {hasActiveFilters && (
          <span className="flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary-500 px-1 text-[10px] font-bold text-white">
            {activeFilterCount}
          </span>
        )}
        <span className="mt-1 max-w-[2.75rem] text-center text-[10px] font-semibold uppercase leading-tight tracking-wide text-slate-500 dark:text-slate-400">
          Filters
        </span>
      </button>
      <div
        id="desktop-filter-panel"
        className={`${sidebarCollapsed ? 'hidden' : 'flex'} sticky top-16 z-10 h-[calc(100vh-4rem)] min-h-0 w-full flex-col overflow-hidden`}
      >
        <FilterPanel
          layout="sidebar"
          filters={filterState}
          onChange={handleFilterChange}
          onClear={handleFilterClear}
          resultCount={resultCount}
          onRequestCollapse={() => setSidebarCollapsed(true)}
        />
      </div>
    </aside>
  );
};
