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
}) => {
  const actionsAnchorRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <div className="relative w-full md:max-w-[420px]">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          size={15}
        />
        <input
          type="text"
          placeholder="Search collections and sub-collections…"
          value={searchInputValue}
          onChange={(event) => onSearchInput(event.target.value)}
          className={`${TOOLBAR_INPUT} w-full pl-9 pr-3 text-[13px] focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:bg-slate-900`}
        />
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto md:justify-end">
        <button
          onClick={onOpenFiltersMobile}
          className={`relative inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 lg:hidden ${
            mobileFilterCount > 0
              ? 'border-primary-300 bg-primary-50 text-primary-700 dark:border-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
              : `${TOOLBAR_BUTTON} border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800`
          }`}
          aria-label={mobileFilterCount > 0 ? `Filters (${mobileFilterCount} active)` : 'Filters'}
        >
          <SlidersHorizontal size={14} />
          Filters
          {mobileFilterCount > 0 && (
            <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-600 px-1 text-[10px] font-semibold tabular-nums leading-none text-white dark:bg-primary-500">
              {mobileFilterCount}
            </span>
          )}
        </button>

        <div className="flex h-9 items-center overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <label className="sr-only" htmlFor="collections-sort">Sort</label>
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
            className="inline-flex h-full w-8 items-center justify-center border-l border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            aria-label={`Sort ${sortDirection === 'asc' ? 'descending' : 'ascending'}`}
            title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
          >
            {sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
          </button>
        </div>

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
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
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
              className={`${TOOLBAR_BUTTON} h-9 gap-1 px-2.5 text-[13px]`}
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
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-all hover:bg-slate-50 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            aria-label="Exit selection mode"
          >
            <X size={14} />
          </button>
        )}

      </div>
    </div>
  );
};
