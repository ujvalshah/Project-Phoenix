import React from 'react';
import { ArrowDownAZ, ArrowUpAZ, LayoutGrid, List, Rows3, Search, Sparkles } from 'lucide-react';

export type ContentSort = 'published-desc' | 'published-asc' | 'updated-desc' | 'updated-asc';
export type CollectionContentSort = 'updated-desc' | 'updated-asc' | 'name-asc' | 'name-desc';
export type LibraryViewMode = 'grid' | 'list' | 'compact';

interface ContentToolbarProps {
  mode?: 'nuggets' | 'collections';
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
    <div
      className="sticky top-14 z-[100] -mx-px border-y border-slate-200/50 bg-slate-50/90 py-2.5 backdrop-blur-md dark:border-slate-800/60 dark:bg-slate-950/92 lg:top-16"
      role="search"
    >
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-3">
          <div className="relative min-w-0 flex-1 lg:max-w-sm">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
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
              className="h-9 w-full rounded border border-slate-200/80 bg-white pl-8 pr-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400/40 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-500 dark:focus:ring-slate-500/40"
            />
          </div>

          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            {isNuggets && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => onRecentUpdatesModeChange(!recentUpdatesMode)}
                className={[
                  'inline-flex h-8 shrink-0 items-center gap-1 rounded border px-2 text-[11px] font-medium',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 dark:focus-visible:outline-slate-200',
                  recentUpdatesMode
                    ? 'border-slate-800 bg-slate-900 text-white dark:border-slate-200 dark:bg-slate-100 dark:text-slate-900'
                    : 'border-slate-200/80 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900',
                ].join(' ')}
              >
                <Sparkles className="h-3 w-3" aria-hidden />
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
                className="h-8 max-w-full rounded border border-slate-200/80 bg-white px-2 text-[11px] font-medium text-slate-800 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400/40 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
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
                className="h-8 max-w-full rounded border border-slate-200/80 bg-white px-2 text-[11px] font-medium text-slate-800 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400/40 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="updated-desc">Updated · Newest</option>
                <option value="updated-asc">Updated · Oldest</option>
                <option value="name-asc">Name · A–Z</option>
                <option value="name-desc">Name · Z–A</option>
              </select>
            )}

            <ArrowDownAZ className="hidden h-3.5 w-3.5 shrink-0 text-slate-300 dark:text-slate-600 sm:block" aria-hidden />
            <ArrowUpAZ className="hidden h-3.5 w-3.5 shrink-0 text-slate-300 dark:text-slate-600 sm:block" aria-hidden />

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
                  className="h-8 rounded border border-slate-200/80 bg-white px-2 text-[11px] font-medium text-slate-800 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400/40 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
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
                      className="h-8 max-w-[120px] rounded border border-slate-200/80 bg-white px-2 text-[11px] font-medium text-slate-800 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400/40 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 sm:max-w-[140px]"
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
                      className="h-8 max-w-[130px] rounded border border-slate-200/80 bg-white px-2 text-[11px] font-medium text-slate-800 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400/40 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 sm:max-w-[160px]"
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
                className="ml-auto flex items-center rounded border border-slate-200/70 bg-white p-px dark:border-slate-700 dark:bg-slate-950"
                role="group"
                aria-label="Layout"
              >
                {VIEW_OPTS.map((opt) => {
                  const on = libraryView === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onLibraryViewChange(opt.id)}
                      className={[
                        'inline-flex h-7 items-center gap-1 rounded-sm px-2 text-[11px] font-medium',
                        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 dark:focus-visible:outline-slate-200',
                        on
                          ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-50'
                          : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100',
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
    </div>
  );
};
