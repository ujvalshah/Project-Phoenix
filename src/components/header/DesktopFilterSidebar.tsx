import React from 'react';
import { Filter } from 'lucide-react';
import { useFilterResults } from '@/context/FilterResultsContext';
import { useDesktopFilterSidebar } from '@/context/DesktopFilterSidebarContext';
import { useFilterPanelHandlers } from '@/hooks/useFilterPanelHandlers';
import { shallowEqual, useFilterSelector } from '@/context/FilterStateContext';
import { FilterPanel } from './FilterPanel';

/**
 * Persistent collapsible filter column for the home feed (lg+ only).
 * Narrow screens use MobileFilterSheet; non-home routes use the header dropdown.
 */
export const DesktopFilterSidebar: React.FC = () => {
  const { filterState, handleFilterChange, handleFilterClear } = useFilterPanelHandlers();
  const { resultCount } = useFilterResults();
  const { sidebarCollapsed, toggleSidebarCollapsed, setSidebarCollapsed } = useDesktopFilterSidebar();
  const { hasActiveFilters, activeFilterCount } = useFilterSelector(
    (s) => ({
      hasActiveFilters: s.hasActiveFilters,
      activeFilterCount: s.activeFilterCount,
    }),
    shallowEqual,
  );

  // Single source of truth: outer width + inner cross-fade share the same
  // `data-state` and matched easing/duration so the sidebar reads as one
  // unified motion rather than a snapping shell with separately-animating guts.
  const state = sidebarCollapsed ? 'collapsed' : 'expanded';
  const SIDEBAR_EASE = 'cubic-bezier(0.32,0.72,0,1)';
  const SIDEBAR_MS = 220;

  return (
    <aside
      data-state={state}
      style={{
        transitionProperty: 'width',
        transitionDuration: `${SIDEBAR_MS}ms`,
        transitionTimingFunction: SIDEBAR_EASE,
      }}
      className="relative hidden min-h-0 shrink-0 flex-col overflow-hidden border-r border-slate-200/80 bg-white will-change-[width] motion-reduce:transition-none data-[state=collapsed]:w-[52px] data-[state=expanded]:w-64 dark:border-slate-800 dark:bg-slate-950 lg:flex xl:data-[state=expanded]:w-72"
      aria-label={sidebarCollapsed ? 'Filters collapsed' : 'Filters'}
    >
      {/* Collapsed rail — always mounted; opacity cross-fades with the panel.
          Absolutely positioned so it doesn't fight the panel for layout space
          while the aside width animates. */}
      <button
        type="button"
        onClick={toggleSidebarCollapsed}
        data-state={state}
        style={{
          transitionProperty: 'opacity',
          transitionDuration: `${SIDEBAR_MS}ms`,
          transitionTimingFunction: SIDEBAR_EASE,
        }}
        className="absolute inset-y-0 left-0 z-10 flex w-[52px] flex-col items-center gap-2 border-0 bg-transparent px-1.5 py-4 text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-400 motion-reduce:transition-none data-[state=collapsed]:opacity-100 data-[state=expanded]:pointer-events-none data-[state=expanded]:opacity-0 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:bg-slate-800/90"
        aria-expanded={!sidebarCollapsed}
        aria-controls="desktop-filter-panel"
        title="Show filters"
      >
        <div className="sticky top-20 flex flex-col items-center gap-2">
          <Filter size={20} strokeWidth={2} className="shrink-0 text-slate-500 dark:text-slate-400" aria-hidden />
          {hasActiveFilters && (
            <span className="flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary-500 px-1 text-[10px] font-bold text-white">
              {activeFilterCount}
            </span>
          )}
          <span className="mt-1 max-w-[2.75rem] text-center text-[10px] font-semibold uppercase leading-tight tracking-wide text-slate-500 dark:text-slate-400">
            Filters
          </span>
        </div>
      </button>
      {/* Panel keeps its full intrinsic width so its internals never reflow
          mid-animation; the aside's overflow-hidden does the visual clip. */}
      <div
        id="desktop-filter-panel"
        data-state={state}
        style={{
          transitionProperty: 'opacity',
          transitionDuration: `${SIDEBAR_MS}ms`,
          transitionTimingFunction: SIDEBAR_EASE,
        }}
        className="sticky top-16 z-0 flex h-[calc(100vh-4rem)] w-64 min-h-0 shrink-0 flex-col overflow-hidden will-change-[opacity] motion-reduce:transition-none data-[state=collapsed]:pointer-events-none data-[state=collapsed]:opacity-0 data-[state=expanded]:pointer-events-auto data-[state=expanded]:opacity-100 xl:w-72"
        aria-hidden={sidebarCollapsed}
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
