import React from 'react';
import {
  ArrowDown,
  ArrowUp,
  CheckSquare,
  ChevronDown,
  LayoutGrid,
  List,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';

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
  onOpenCreate: () => void;
  onOpenActions: () => void;
  isActionMenuOpen: boolean;
  actionMenu: React.ReactNode;
  onOpenFiltersMobile: () => void;
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
  onOpenCreate,
  onOpenActions,
  isActionMenuOpen,
  actionMenu,
  onOpenFiltersMobile,
}) => {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative flex-1 sm:min-w-[260px] sm:max-w-xl">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          size={15}
        />
        <input
          type="text"
          placeholder="Search collections and sub-collections…"
          value={searchInputValue}
          onChange={(event) => onSearchInput(event.target.value)}
          className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[13px] text-slate-900 placeholder:text-slate-400 shadow-[0_1px_0_0_rgba(15,23,42,0.02)] transition-all duration-150 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5 sm:ml-auto">
        <button
          onClick={onOpenFiltersMobile}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 lg:hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <SlidersHorizontal size={14} />
          Filters
        </button>

        <div className="flex h-9 items-center overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <label className="sr-only" htmlFor="collections-sort">Sort</label>
          <select
            id="collections-sort"
            value={sortField}
            onChange={(event) => setSortField(event.target.value as SortField)}
            className="h-full border-none bg-transparent pl-2.5 pr-1 text-[13px] font-medium text-slate-700 focus:outline-none dark:text-slate-200"
          >
            <option value="created">Created</option>
            <option value="updated">Updated</option>
            <option value="followers">Followers</option>
            <option value="nuggets">Nuggets</option>
            <option value="name">Name</option>
          </select>
          <button
            onClick={toggleSortDirection}
            className="inline-flex h-full w-8 items-center justify-center border-l border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            aria-label={`Sort ${sortDirection === 'asc' ? 'descending' : 'ascending'}`}
            title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
          >
            {sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
          </button>
        </div>

        <div className="flex h-9 items-center rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900">
          <button
            onClick={() => setViewMode('table')}
            className={`inline-flex h-7 w-8 items-center justify-center rounded-md transition-all ${
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
            className={`inline-flex h-7 w-8 items-center justify-center rounded-md transition-all ${
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
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
              selectionMode
                ? 'border-primary-500 bg-primary-50 text-primary-700 dark:border-primary-500 dark:bg-primary-900/20 dark:text-primary-300'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <CheckSquare size={14} />
            {selectionMode ? `${selectedCount} selected` : 'Select'}
          </button>
        )}

        {selectionMode && (
          <div className="relative">
            <button
              onClick={onOpenActions}
              disabled={selectedCount === 0}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] font-medium text-slate-700 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Actions
              <ChevronDown size={13} />
            </button>
            {isActionMenuOpen && actionMenu}
          </div>
        )}

        {selectionMode && (
          <button
            onClick={onToggleSelection}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-all hover:bg-slate-50 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            aria-label="Exit selection mode"
          >
            <X size={14} />
          </button>
        )}

        {!selectionMode && canCreate && (
          <button
            onClick={onOpenCreate}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-[13px] font-semibold text-white transition-all hover:bg-slate-800 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            <Plus size={15} />
            Create Collection
          </button>
        )}
      </div>
    </div>
  );
};
