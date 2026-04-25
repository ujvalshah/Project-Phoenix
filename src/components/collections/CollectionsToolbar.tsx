import React, { useRef } from 'react';
import { DropdownPortal } from '@/components/UI/DropdownPortal';
import {
  TOOLBAR_BUTTON,
  TOOLBAR_INPUT,
  TOOLBAR_SELECT,
  TOOLBAR_TOGGLE_GROUP,
  TOOLBAR_TOGGLE_ITEM,
} from '@/components/workspace/toolbarPrimitives';
import {
  ArrowDown,
  ArrowUp,
  CheckSquare,
  ChevronDown,
  LayoutGrid,
  List,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import type { AppliedFilterChip } from '@/components/collections/AppliedFiltersBar';

type ViewMode = 'grid' | 'table';
type SortField = 'created' | 'updated' | 'followers' | 'nuggets' | 'name';
type SortDirection = 'asc' | 'desc';

interface CollectionsToolbarProps {
  searchInputValue: string;
  onSearchInput: (value: string) => void;
  sortField: SortField;
  sortDirection: SortDirection;
  setSortField: (value: SortField) => void;
  toggleSortDirection: () => void;
  viewMode: ViewMode;
  setViewMode: (value: ViewMode) => void;
  selectionMode: boolean;
  selectedCount: number;
  canSelect: boolean;
  canCreate: boolean;
  onToggleSelection: () => void;
  onOpenActions: () => void;
  onCloseActionMenu: () => void;
  isActionMenuOpen: boolean;
  actionMenu: React.ReactNode;
  onOpenFiltersMobile: () => void;
  mobileFilterCount?: number;
  appliedFilters: AppliedFilterChip[];
  onClearFilters: () => void;
  showSortField?: boolean;
  showMobileSort?: boolean;
  searchPlaceholder?: string;
  searchAriaLabel?: string;
}

export const CollectionsToolbar: React.FC<CollectionsToolbarProps> = ({
  searchInputValue,
  onSearchInput,
  sortField,
  sortDirection,
  setSortField,
  toggleSortDirection,
  viewMode,
  setViewMode,
  selectionMode,
  selectedCount,
  canSelect,
  canCreate,
  onToggleSelection,
  onOpenActions,
  onCloseActionMenu,
  isActionMenuOpen,
  actionMenu,
  onOpenFiltersMobile,
  mobileFilterCount = 0,
  appliedFilters,
  onClearFilters,
  showSortField = true,
  showMobileSort = true,
  searchPlaceholder = 'Search collections and sub-collections...',
  searchAriaLabel = searchPlaceholder,
}) => {
  const actionsAnchorRef = useRef<HTMLButtonElement>(null);
  const mobileSortVisibility = showMobileSort ? 'flex' : 'hidden lg:flex';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-1.5 lg:overflow-x-auto">
        <div className="relative w-full flex-1 lg:min-w-[220px] lg:max-w-[420px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
          <input
            type="text"
            placeholder={searchPlaceholder}
            aria-label={searchAriaLabel}
            value={searchInputValue}
            onChange={(event) => onSearchInput(event.target.value)}
            className={`${TOOLBAR_INPUT} min-h-11 w-full pl-9 pr-3 text-[14px] focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:bg-slate-900 lg:h-9 lg:min-h-0 lg:text-[13px]`}
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
        <button
          onClick={onOpenFiltersMobile}
          className={`relative inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 lg:hidden ${
            mobileFilterCount > 0
              ? 'border-primary-300 bg-primary-50 text-primary-700 dark:border-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
              : `${TOOLBAR_BUTTON} border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800`
          }`}
          aria-label={mobileFilterCount > 0 ? `Topics (${mobileFilterCount} active scope)` : 'Browse topics'}
        >
          <SlidersHorizontal size={14} />
          Topics
          {mobileFilterCount > 0 && (
            <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-600 px-1 text-[10px] font-semibold tabular-nums leading-none text-white dark:bg-primary-500">
              {mobileFilterCount}
            </span>
          )}
        </button>

        {showSortField ? (
          <div className={`${mobileSortVisibility} min-h-11 items-center overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 lg:h-9 lg:min-h-0`}>
            <label className="sr-only" htmlFor="collections-sort">
              Sort
            </label>
            <select
              id="collections-sort"
              value={sortField}
              onChange={(event) => setSortField(event.target.value as SortField)}
              className={`${TOOLBAR_SELECT} h-full rounded-none border-none bg-transparent pl-2.5 pr-1 text-[13px] dark:bg-transparent`}
            >
              <option value="created">Created</option>
              <option value="updated">Updated</option>
              <option value="followers">Followers</option>
              <option value="nuggets">Nuggets</option>
              <option value="name">Name</option>
            </select>
            <button
              onClick={toggleSortDirection}
              className="inline-flex h-full min-w-11 items-center justify-center border-l border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white lg:min-w-8"
              aria-label={`Sort ${sortDirection === 'asc' ? 'descending' : 'ascending'}`}
              title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
            >
              {sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
            </button>
          </div>
        ) : (
          <button
            onClick={toggleSortDirection}
            className={`${mobileSortVisibility} min-h-11 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 lg:h-9 lg:min-h-0`}
            aria-label={`Sort ${sortDirection === 'asc' ? 'oldest first' : 'latest first'}`}
            title={sortDirection === 'asc' ? 'Oldest first' : 'Latest first'}
          >
            {sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
            {sortDirection === 'asc' ? 'Oldest' : 'Latest'}
          </button>
        )}

        <div className={`${TOOLBAR_TOGGLE_GROUP} hidden h-9 p-0.5 lg:flex dark:bg-slate-900`}>
          <button
            onClick={() => setViewMode('table')}
            className={`${TOOLBAR_TOGGLE_ITEM} w-8 justify-center transition-all ${
              viewMode === 'table'
                ? 'bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white'
            }`}
            aria-label="Table view"
            aria-pressed={viewMode === 'table'}
          >
            <List size={15} />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`${TOOLBAR_TOGGLE_ITEM} w-8 justify-center transition-all ${
              viewMode === 'grid'
                ? 'bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white'
            }`}
            aria-label="Grid view"
            aria-pressed={viewMode === 'grid'}
          >
            <LayoutGrid size={15} />
          </button>
        </div>

        {canSelect && canCreate && (
          <button
            onClick={onToggleSelection}
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 lg:h-9 lg:min-h-0 ${
              selectionMode
                ? 'border-primary-500 bg-primary-50 text-primary-700 dark:border-primary-500 dark:bg-primary-900/20 dark:text-primary-300'
                : `${TOOLBAR_BUTTON} border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800`
            }`}
          >
            <CheckSquare size={14} />
            {selectionMode ? `${selectedCount} selected` : 'Select'}
          </button>
        )}

        {selectionMode && (
          <div className="relative inline-flex">
            <button
              ref={actionsAnchorRef}
              type="button"
              onClick={onOpenActions}
              disabled={selectedCount === 0}
              className={`${TOOLBAR_BUTTON} min-h-11 gap-1 px-2.5 text-[13px] lg:h-9 lg:min-h-0`}
              aria-expanded={isActionMenuOpen}
              aria-haspopup="menu"
            >
              Actions
              <ChevronDown size={13} />
            </button>
            <DropdownPortal
              isOpen={isActionMenuOpen}
              anchorRef={actionsAnchorRef}
              align="right"
              host="dropdown"
              offsetY={6}
              onClickOutside={onCloseActionMenu}
              className="w-44 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-150 dark:border-slate-700 dark:bg-slate-900"
            >
              {actionMenu}
            </DropdownPortal>
          </div>
        )}

        {selectionMode && (
          <button
            onClick={onToggleSelection}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-all hover:bg-slate-50 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white lg:h-9 lg:min-h-0 lg:w-9 lg:min-w-0"
            aria-label="Exit selection mode"
          >
            <X size={14} />
          </button>
        )}
        </div>
      </div>

      {appliedFilters.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <span className="shrink-0 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-slate-400 dark:text-slate-500">
            Active
          </span>
          {appliedFilters.map((filter) => (
            <button
              key={filter.id}
              onClick={filter.onRemove}
              className="inline-flex min-h-11 max-w-[240px] shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-white px-3 text-[12px] font-medium text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 lg:h-7 lg:min-h-0 lg:px-2.5 lg:text-[11px]"
            >
              <span className="truncate">{filter.label}</span>
              <X size={11} className="text-slate-400" />
            </button>
          ))}
          <button
            onClick={onClearFilters}
            className="min-h-11 shrink-0 rounded-full px-3 text-[12px] font-semibold text-slate-500 transition-colors hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-slate-400 dark:hover:text-white lg:h-7 lg:min-h-0 lg:px-2.5 lg:text-[11px]"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
};
