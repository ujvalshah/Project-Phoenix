import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutGrid, List, Rows3, Search, Sparkles } from 'lucide-react';
import { DropdownPortal } from '@/components/UI/DropdownPortal';
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
  tagTaxonomy?: {
    formats: string[];
    domains: string[];
    subtopics: string[];
  };
  enableGroupedTagPicker?: boolean;
  datePreset: 'all' | '7d' | '30d';
  onDatePresetChange: (v: 'all' | '7d' | '30d') => void;
  recentUpdatesMode: boolean;
  onRecentUpdatesModeChange: (on: boolean) => void;
  showRecentToggle?: boolean;
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
  tagTaxonomy,
  enableGroupedTagPicker = false,
  datePreset,
  onDatePresetChange,
  recentUpdatesMode,
  onRecentUpdatesModeChange,
  showRecentToggle = true,
  libraryView = 'grid',
  onLibraryViewChange,
  showLibraryViewToggle = false,
  disabled,
}) => {
  const isNuggets = mode === 'nuggets';
  const [isTagPanelOpen, setIsTagPanelOpen] = useState(false);
  const [tagSearch, setTagSearch] = useState('');
  const [showUnmappedTags, setShowUnmappedTags] = useState(false);
  const tagAnchorRef = useRef<HTMLButtonElement>(null);
  const showTaxonomyDebug = import.meta.env.DEV;

  useEffect(() => {
    if (!isTagPanelOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsTagPanelOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isTagPanelOpen]);

  const groupedTags = useMemo(() => {
    const q = tagSearch.trim().toLowerCase();
    const filteredOptions = q
      ? tagOptions.filter((tag) => tag.toLowerCase().includes(q))
      : tagOptions;
    const formatSet = new Set((tagTaxonomy?.formats || []).map((t) => t.trim().toLowerCase()));
    const domainSet = new Set((tagTaxonomy?.domains || []).map((t) => t.trim().toLowerCase()));
    const subtopicSet = new Set((tagTaxonomy?.subtopics || []).map((t) => t.trim().toLowerCase()));

    return filteredOptions.reduce<Record<'format' | 'domain' | 'subtopic', string[]>>(
      (acc, tag) => {
        const key = tag.trim().toLowerCase();
        if (formatSet.has(key)) acc.format.push(tag);
        else if (domainSet.has(key)) acc.domain.push(tag);
        else if (subtopicSet.has(key)) acc.subtopic.push(tag);
        return acc;
      },
      { format: [], domain: [], subtopic: [] },
    );
  }, [tagOptions, tagSearch, tagTaxonomy]);

  const unmappedTags = useMemo(() => {
    const q = tagSearch.trim().toLowerCase();
    const filteredOptions = q
      ? tagOptions.filter((tag) => tag.toLowerCase().includes(q))
      : tagOptions;
    const formatSet = new Set((tagTaxonomy?.formats || []).map((t) => t.trim().toLowerCase()));
    const domainSet = new Set((tagTaxonomy?.domains || []).map((t) => t.trim().toLowerCase()));
    const subtopicSet = new Set((tagTaxonomy?.subtopics || []).map((t) => t.trim().toLowerCase()));
    return filteredOptions.filter((tag) => {
      const key = tag.trim().toLowerCase();
      return !formatSet.has(key) && !domainSet.has(key) && !subtopicSet.has(key);
    });
  }, [tagOptions, tagSearch, tagTaxonomy]);

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
          {isNuggets && showRecentToggle && (
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

              {tagOptions.length > 0 && !enableGroupedTagPicker && (
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
              {tagOptions.length > 0 && enableGroupedTagPicker && (
                <div className="relative w-full sm:w-auto">
                  <button
                    ref={tagAnchorRef}
                    type="button"
                    onClick={() => setIsTagPanelOpen((open) => !open)}
                    className={`${TOOLBAR_SELECT} w-full min-w-[130px] justify-between text-left sm:w-auto`}
                    aria-expanded={isTagPanelOpen}
                    aria-haspopup="dialog"
                    disabled={disabled}
                  >
                    {tagFilter ? `Tag: ${tagFilter}` : 'All tags'}
                  </button>
                  <DropdownPortal
                    isOpen={isTagPanelOpen}
                    anchorRef={tagAnchorRef}
                    align="right"
                    host="dropdown"
                    offsetY={6}
                    onClickOutside={() => setIsTagPanelOpen(false)}
                    className="w-[320px] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-lg border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900"
                  >
                      <input
                        type="text"
                        value={tagSearch}
                        onChange={(e) => setTagSearch(e.target.value)}
                        placeholder="Search tags..."
                        className={`${TOOLBAR_INPUT} h-8 w-full px-2.5 text-[12px]`}
                      />
                      <div className="mt-2 max-h-64 overflow-y-auto pr-1">
                        {(
                          [
                            ['format', 'Content format'],
                            ['domain', 'Domain'],
                            ['subtopic', 'Subtopic'],
                          ] as const
                        ).map(([key, label]) =>
                          groupedTags[key].length > 0 ? (
                            <div key={key} className="mb-2">
                              <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                {label}
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {groupedTags[key].map((tag) => {
                                  const isActive = tagFilter === tag;
                                  return (
                                    <button
                                      key={tag}
                                      type="button"
                                      onClick={() => {
                                        onTagChange(tag);
                                        setIsTagPanelOpen(false);
                                      }}
                                      className={`rounded-md border px-2 py-1 text-[11px] transition-colors ${
                                        isActive
                                          ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
                                      }`}
                                    >
                                      {tag}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ) : null,
                        )}
                        {tagOptions.length === 0 && (
                          <p className="px-1 py-2 text-[11px] text-slate-500 dark:text-slate-400">No tags yet.</p>
                        )}
                        {showTaxonomyDebug && unmappedTags.length > 0 && (
                          <div className="mt-2 border-t border-slate-200 pt-2 dark:border-slate-700">
                            <button
                              type="button"
                              onClick={() => setShowUnmappedTags((value) => !value)}
                              className="px-1 text-[10px] font-semibold uppercase tracking-wide text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
                            >
                              Not in taxonomy ({unmappedTags.length}) {showUnmappedTags ? 'Hide' : 'Show'}
                            </button>
                            {showUnmappedTags && (
                              <div className="mt-1 flex flex-wrap gap-1 px-1">
                                {unmappedTags.map((tag) => (
                                  <span
                                    key={tag}
                                    className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="mt-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            onTagChange('');
                            setTagSearch('');
                          }}
                          className="text-[11px] font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
                        >
                          Clear tag
                        </button>
                      </div>
                  </DropdownPortal>
                </div>
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
