import React from 'react';
import { LayoutGrid, List, Rows3, Search, Sparkles } from 'lucide-react';
import {
  TOOLBAR_INPUT,
  TOOLBAR_SELECT,
  TOOLBAR_TOGGLE_GROUP,
  TOOLBAR_TOGGLE_ITEM,
} from './toolbarPrimitives';

export type ContentSort = 'published-desc' | 'published-asc' | 'updated-desc' | 'updated-asc';
export type CollectionContentSort = 'updated-desc' | 'updated-asc' | 'name-asc' | 'name-desc';
export type LibraryViewMode = 'grid' | 'list' | 'compact';

interface ContentToolbarProps {
  mode?: 'nuggets' | 'collections';
  className?: string;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  sort: ContentSort;
  onSortChange: (s: ContentSort) => void;
  collectionSort?: CollectionContentSort;
  onCollectionSortChange?: (s: CollectionContentSort) => void;
  sourceTypeFilter: string;
  onSourceTypeChange: (v: string) => void;
  sourceTypeOptions: string[];
  tagFilter: string;
  onTagChange: (v: string) => void;
  tagOptions: string[];
  datePreset: 'all' | '7d' | '30d';
  onDatePresetChange: (v: 'all' | '7d' | '30d') => void;
  recentUpdatesMode: boolean;
  onRecentUpdatesModeChange: (on: boolean) => void;
  libraryView?: LibraryViewMode;
  onLibraryViewChange?: (v: LibraryViewMode) => void;
  showLibraryViewToggle?: boolean;
  disabled?: boolean;
}

const VIEW_OPTS: { id: LibraryViewMode; label: string; icon: React.ReactNode }[] = [
  { id: 'grid', label: 'Grid', icon: <LayoutGrid className="h-3.5 w-3.5" aria-hidden /> },
  { id: 'list', label: 'List', icon: <List className="h-3.5 w-3.5" aria-hidden /> },
  { id: 'compact', label: 'Compact', icon: <Rows3 className="h-3.5 w-3.5" aria-hidden /> },
];

export const ContentToolbar: React.FC<ContentToolbarProps> = ({
  mode = 'nuggets',
  className,
  searchQuery,
  onSearchChange,
  sort,
  onSortChange,
  collectionSort = 'updated-desc',
  onCollectionSortChange,
  sourceTypeFilter,
  onSourceTypeChange,
  sourceTypeOptions,
  tagFilter,
  onTagChange,
  tagOptions,
  datePreset,
  onDatePresetChange,
  recentUpdatesMode,
  onRecentUpdatesModeChange,
  libraryView = 'grid',
  onLibraryViewChange,
  showLibraryViewToggle = false,
  disabled,
}) => {
  const isNuggets = mode === 'nuggets';

  return (
    <div className={['flex flex-col gap-2', className].filter(Boolean).join(' ')} role="search">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-[420px]">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <label htmlFor="library-search" className="sr-only">
            Search library
          </label>
          <input
            id="library-search"
            type="search"
            autoComplete="off"
            disabled={disabled}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={isNuggets ? 'Search titles, excerpts, tags…' : 'Search collections…'}
            className={`${TOOLBAR_INPUT} w-full pl-9 pr-3 text-[13px] dark:bg-slate-900`}
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto md:justify-end">
          {isNuggets && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onRecentUpdatesModeChange(!recentUpdatesMode)}
              className={[
                'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] font-medium shadow-sm transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40 dark:focus-visible:ring-slate-500/40',
                recentUpdatesMode
                  ? 'border-slate-800 bg-slate-900 text-white dark:border-slate-200 dark:bg-slate-100 dark:text-slate-900'
                  : 'border-slate-200/80 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-200 dark:hover:bg-slate-900',
              ].join(' ')}
              aria-pressed={recentUpdatesMode}
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Recent
            </button>
          )}

          <label htmlFor={isNuggets ? 'library-sort-n' : 'library-sort-c'} className="sr-only">
            Sort
          </label>
          {isNuggets ? (
            <select
              id="library-sort-n"
              disabled={disabled}
              value={sort}
              onChange={(e) => onSortChange(e.target.value as ContentSort)}
              className={`${TOOLBAR_SELECT} h-9 max-w-full px-2.5 text-[13px]`}
            >
              <option value="published-desc">Published · Newest</option>
              <option value="published-asc">Published · Oldest</option>
              <option value="updated-desc">Updated · Newest</option>
              <option value="updated-asc">Updated · Oldest</option>
            </select>
          ) : (
            <select
              id="library-sort-c"
              disabled={disabled || !onCollectionSortChange}
              value={collectionSort}
              onChange={(e) => onCollectionSortChange?.(e.target.value as CollectionContentSort)}
              className={`${TOOLBAR_SELECT} h-9 max-w-full px-2.5 text-[13px]`}
            >
              <option value="updated-desc">Updated · Newest</option>
              <option value="updated-asc">Updated · Oldest</option>
              <option value="name-asc">Name · A–Z</option>
              <option value="name-desc">Name · Z–A</option>
            </select>
          )}

          {isNuggets && (
            <>
              <label htmlFor="library-date" className="sr-only">
                Date range
              </label>
              <select
                id="library-date"
                disabled={disabled}
                value={datePreset}
                onChange={(e) => onDatePresetChange(e.target.value as 'all' | '7d' | '30d')}
                className={`${TOOLBAR_SELECT} h-9 px-2.5 text-[13px]`}
              >
                <option value="all">Any time</option>
                <option value="7d">7 days</option>
                <option value="30d">30 days</option>
              </select>

              {sourceTypeOptions.length > 0 && (
                <>
                  <label htmlFor="library-type" className="sr-only">
                    Type
                  </label>
                  <select
                    id="library-type"
                    disabled={disabled}
                    value={sourceTypeFilter}
                    onChange={(e) => onSourceTypeChange(e.target.value)}
                    className={`${TOOLBAR_SELECT} h-9 max-w-[140px] px-2.5 text-[13px] sm:max-w-[160px]`}
                  >
                    <option value="">All types</option>
                    {sourceTypeOptions.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </>
              )}

              {tagOptions.length > 0 && (
                <>
                  <label htmlFor="library-tag" className="sr-only">
                    Tag
                  </label>
                  <select
                    id="library-tag"
                    disabled={disabled}
                    value={tagFilter}
                    onChange={(e) => onTagChange(e.target.value)}
                    className={`${TOOLBAR_SELECT} h-9 max-w-[150px] px-2.5 text-[13px] sm:max-w-[180px]`}
                  >
                    <option value="">All tags</option>
                    {tagOptions.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </>
          )}

          {showLibraryViewToggle && isNuggets && onLibraryViewChange && (
            <div
              className={`${TOOLBAR_TOGGLE_GROUP} hidden h-9 p-0.5 lg:flex dark:bg-slate-900`}
              role="radiogroup"
              aria-label="View mode"
            >
              {VIEW_OPTS.map((opt) => {
                const on = libraryView === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => onLibraryViewChange(opt.id)}
                    className={[
                      TOOLBAR_TOGGLE_ITEM,
                      'h-7 px-2 text-[12px]',
                      on
                        ? 'bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100',
                    ].join(' ')}
                    title={opt.label}
                  >
                    {opt.icon}
                    <span className="hidden sm:inline">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
