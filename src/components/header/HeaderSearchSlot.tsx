import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Search, X } from 'lucide-react';
import { SearchInput, SearchInputHandle } from './SearchInput';
import { shallowEqual as shallowEqualFilters, useFilterSelector } from '@/context/FilterStateContext';
import { recordSearchEvent } from '@/observability/telemetry';
import { setPendingSuggestionArticleId } from '@/observability/searchTelemetryIds';
import { useSearchSuggestions } from '@/hooks/useSearchSuggestions';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import {
  formatContentStreamLabel,
  formatSourceTypeLabel,
  formatSuggestionPublishedLabel,
} from '@/utils/suggestionDisplay';
import { normalizeSearchQuery } from '@/utils/searchQuery';

export type HeaderDesktopSearchSlotHandle = {
  focus: () => void;
  dismiss: () => void;
  isActiveForEscape: () => boolean;
};

export interface HeaderSearchSlotProps {
  /** Committed query only — updates on submit/clear, not per keystroke (parent shell stays stable while typing). */
  committedSearchQuery: string;
  onSearchSubmit: (query: string, closeMobileOverlay: boolean) => void;
  /** Filter + sort controls that share the desktop search row (must stay visually identical to pre-split Header). */
  trailingToolbar: React.ReactNode;
}

/**
 * Desktop (xl+) search field, typeahead, submit/clear, and ARIA live regions.
 * Subscribes to draft `searchInputValue` here so the Header shell does not rerender on each keystroke.
 */
const HeaderSearchSlotInner = forwardRef<HeaderDesktopSearchSlotHandle, HeaderSearchSlotProps>(
  function HeaderSearchSlotInner(
    { committedSearchQuery, onSearchSubmit, trailingToolbar },
    ref,
  ) {
    const {
      searchInputValue,
      searchInputResetSignal,
      setSearchInput: setSearchDraft,
      commitSearch,
      selectedCategories,
      selectedTag,
      collectionId,
      favorites,
      unread,
      formats,
      timeRange,
      formatTagIds,
      domainTagIds,
      subtopicTagIds,
      contentStream,
    } = useFilterSelector(
      (s) => ({
        searchInputValue: s.searchInputValue,
        searchInputResetSignal: s.searchInputResetSignal,
        setSearchInput: s.setSearchInput,
        commitSearch: s.commitSearch,
        selectedCategories: s.selectedCategories,
        selectedTag: s.selectedTag,
        collectionId: s.collectionId,
        favorites: s.favorites,
        unread: s.unread,
        formats: s.formats,
        timeRange: s.timeRange,
        formatTagIds: s.formatTagIds,
        domainTagIds: s.domainTagIds,
        subtopicTagIds: s.subtopicTagIds,
        contentStream: s.contentStream,
      }),
      shallowEqualFilters,
    );

    const [isDesktopSearchFocused, setIsDesktopSearchFocused] = useState(false);
    const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
    const desktopSearchRef = useRef<SearchInputHandle>(null);
    const desktopSearchContainerRef = useRef<HTMLDivElement>(null);

    const debouncedSearchInputForSuggestions = useDebouncedValue(searchInputValue, 180);
    const suggestionFilters = useMemo(
      () => ({
        categories: selectedCategories,
        tag: selectedTag,
        collectionId,
        favorites,
        unread,
        formats,
        timeRange,
        formatTagIds,
        domainTagIds,
        subtopicTagIds,
        contentStream,
      }),
      [
        selectedCategories,
        selectedTag,
        collectionId,
        favorites,
        unread,
        formats,
        timeRange,
        formatTagIds,
        domainTagIds,
        subtopicTagIds,
        contentStream,
      ],
    );
    const desktopSuggestions = useSearchSuggestions(debouncedSearchInputForSuggestions, 6, suggestionFilters);
    const desktopSuggestionItems = useMemo(
      () => desktopSuggestions.data?.suggestions ?? [],
      [desktopSuggestions.data?.suggestions],
    );
    const shouldShowDesktopSuggestions =
      isDesktopSearchFocused && searchInputValue.trim().length >= 2;
    const activeSuggestion = useMemo(
      () =>
        activeSuggestionIndex >= 0 && activeSuggestionIndex < desktopSuggestionItems.length
          ? desktopSuggestionItems[activeSuggestionIndex]
          : null,
      [activeSuggestionIndex, desktopSuggestionItems],
    );

    const desktopActiveOptionAnnouncement = useMemo(() => {
      if (!shouldShowDesktopSuggestions || desktopSuggestions.isLoading) return '';
      if (activeSuggestionIndex < 0 || desktopSuggestionItems.length === 0) return '';
      const item = desktopSuggestionItems[activeSuggestionIndex];
      if (!item) return '';
      return `Suggestion ${activeSuggestionIndex + 1} of ${desktopSuggestionItems.length}: ${item.title}`;
    }, [
      shouldShowDesktopSuggestions,
      desktopSuggestions.isLoading,
      activeSuggestionIndex,
      desktopSuggestionItems,
    ]);

    useImperativeHandle(
      ref,
      () => ({
        focus: () => {
          desktopSearchRef.current?.focus();
        },
        dismiss: () => {
          setIsDesktopSearchFocused(false);
          setActiveSuggestionIndex(-1);
        },
        isActiveForEscape: () => isDesktopSearchFocused,
      }),
      [isDesktopSearchFocused],
    );

    /**
     * Called from SearchInput after its internal 250ms debounce (and on blur/Enter paths).
     * Updates global **draft** (`searchInputValue`) only. The home feed `/api/articles` query
     * keys off **committed** `searchQuery` — updated via `commitSearch` on submit / suggestion
     * pick / clear, or when the draft is cleared to empty (immediate “exit search” behavior).
     */
    const handleDebouncedSearch = useCallback(
      (value: string) => {
        setSearchDraft(value);
        setActiveSuggestionIndex(-1);
        recordSearchEvent({
          name: 'search_query_changed',
          payload: { query: value, length: value.trim().length, surface: 'header' },
        });
        if (!value.trim()) {
          commitSearch('');
        }
      },
      [setSearchDraft, commitSearch],
    );

    const handleClearSearch = useCallback(() => {
      desktopSearchRef.current?.clear();
      setSearchDraft('');
      commitSearch('');
      setActiveSuggestionIndex(-1);
      setIsDesktopSearchFocused(false);
    }, [setSearchDraft, commitSearch]);

    const handleDesktopSuggestionSelect = useCallback(
      (index: number, source: 'mouse' | 'keyboard') => {
        const item = desktopSuggestionItems[index];
        if (!item) return;
        const commitQuery = normalizeSearchQuery(searchInputValue) || normalizeSearchQuery(item.title);
        recordSearchEvent({
          name: 'search_suggestion_selected',
          payload: {
            query: searchInputValue.trim(),
            suggestionId: item.id,
            suggestionTitle: item.title,
            rank: index + 1,
            source,
            commitQuery,
            selectionIntent: 'commit_search_by_typed_query',
          },
        });
        setPendingSuggestionArticleId(item.id);
        onSearchSubmit(commitQuery, false);
        setActiveSuggestionIndex(-1);
        setIsDesktopSearchFocused(false);
      },
      [desktopSuggestionItems, onSearchSubmit, searchInputValue],
    );

    const handleDesktopInputKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!shouldShowDesktopSuggestions) {
          if (e.key === 'Escape') {
            setIsDesktopSearchFocused(false);
            setActiveSuggestionIndex(-1);
            e.preventDefault();
          }
          return;
        }

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setActiveSuggestionIndex((prev) => {
            if (desktopSuggestionItems.length === 0) return -1;
            return prev < desktopSuggestionItems.length - 1 ? prev + 1 : 0;
          });
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setActiveSuggestionIndex((prev) => {
            if (desktopSuggestionItems.length === 0) return -1;
            return prev > 0 ? prev - 1 : desktopSuggestionItems.length - 1;
          });
          return;
        }
        if (e.key === 'Enter' && activeSuggestion) {
          e.preventDefault();
          handleDesktopSuggestionSelect(activeSuggestionIndex, 'keyboard');
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          setIsDesktopSearchFocused(false);
          setActiveSuggestionIndex(-1);
        }
      },
      [
        shouldShowDesktopSuggestions,
        desktopSuggestionItems.length,
        activeSuggestion,
        activeSuggestionIndex,
        handleDesktopSuggestionSelect,
      ],
    );

    useEffect(() => {
      const handlePointerDown = (event: MouseEvent) => {
        if (!desktopSearchContainerRef.current) return;
        if (!desktopSearchContainerRef.current.contains(event.target as Node)) {
          setIsDesktopSearchFocused(false);
          setActiveSuggestionIndex(-1);
        }
      };
      document.addEventListener('mousedown', handlePointerDown);
      return () => document.removeEventListener('mousedown', handlePointerDown);
    }, []);

    return (
      <div ref={desktopSearchContainerRef} className="relative min-h-9 min-w-[220px] w-full max-w-none">
        <SearchInput
          ref={desktopSearchRef}
          initialValue={searchInputValue}
          resetSignal={searchInputResetSignal}
          externalValue={searchInputValue}
          onSearch={handleDebouncedSearch}
          onChangeImmediate={setSearchDraft}
          onSubmit={(q) => onSearchSubmit(q, false)}
          placeholder="Search..."
          showClearButton={false}
          className="w-full"
          inputClassName="w-full h-9 pl-10 pr-36 text-sm font-medium bg-gray-50 border border-gray-100 rounded-lg text-gray-900 placeholder:text-gray-500 focus:ring-2 focus:ring-yellow-400 focus:bg-white focus:outline-none transition-all dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-slate-800 dark:focus:ring-yellow-500/50"
          iconSize={16}
          inputId="desktop-search-combobox"
          inputRole="combobox"
          ariaAutocomplete="list"
          ariaControls="desktop-search-suggestions"
          ariaExpanded={shouldShowDesktopSuggestions}
          ariaActiveDescendant={
            activeSuggestion ? `desktop-search-option-${activeSuggestion.id}` : undefined
          }
          autoComplete="off"
          onInputFocus={() => {
            recordSearchEvent({
              name: 'search_opened',
              payload: { surface: 'desktop-input' },
            });
            setIsDesktopSearchFocused(true);
          }}
          onInputBlur={() => {
            window.setTimeout(() => setIsDesktopSearchFocused(false), 120);
          }}
          onInputKeyDown={handleDesktopInputKeyDown}
        />

        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {shouldShowDesktopSuggestions
            ? desktopSuggestions.isLoading
              ? 'Loading suggestions'
              : desktopSuggestionItems.length > 0
                ? `${desktopSuggestionItems.length} suggestions available.`
                : 'No suggestions found.'
            : ''}
        </div>

        <div
          key={`${activeSuggestionIndex}-${activeSuggestion?.id ?? 'none'}`}
          className="sr-only"
          aria-live="polite"
          aria-atomic="true"
        >
          {desktopActiveOptionAnnouncement}
        </div>

        {shouldShowDesktopSuggestions && (
          <div
            id="desktop-search-suggestions"
            role="listbox"
            aria-label="Search suggestions"
            aria-multiselectable={false}
            className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-80 overflow-auto rounded-lg border border-gray-200 bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-slate-900"
          >
            {desktopSuggestions.isLoading ? (
              <div className="px-3 py-2 text-sm text-gray-500 dark:text-slate-400">Loading suggestions...</div>
            ) : desktopSuggestionItems.length > 0 ? (
              desktopSuggestionItems.map((item, idx) => {
                const isActive = idx === activeSuggestionIndex;
                const dateLabel = formatSuggestionPublishedLabel(item.publishedAt);
                const streamLabel = formatContentStreamLabel(item.contentStream);
                const sourceLabel = formatSourceTypeLabel(item.sourceType);
                return (
                  <button
                    key={item.id}
                    id={`desktop-search-option-${item.id}`}
                    role="option"
                    aria-selected={isActive}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleDesktopSuggestionSelect(idx, 'mouse')}
                    className={`w-full rounded-md px-3 py-2 text-left transition-colors ${
                      isActive
                        ? 'bg-yellow-50 text-gray-900 dark:bg-slate-800 dark:text-slate-100'
                        : 'text-gray-700 hover:bg-gray-50 dark:text-slate-200 dark:hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="text-sm font-medium">{item.title}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-gray-500 dark:text-slate-400">
                      <span className="rounded bg-gray-100 px-1.5 py-px font-medium text-gray-600 dark:bg-slate-800 dark:text-slate-300">
                        {streamLabel}
                      </span>
                      {dateLabel ? <span>{dateLabel}</span> : null}
                      {sourceLabel ? (
                        <span className="text-gray-400 dark:text-slate-500">{sourceLabel}</span>
                      ) : null}
                    </div>
                    {item.excerpt ? (
                      <div className="line-clamp-1 text-xs text-gray-500 dark:text-slate-400">{item.excerpt}</div>
                    ) : null}
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-2 text-sm text-gray-500 dark:text-slate-400">No suggestions found.</div>
            )}
          </div>
        )}

        <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const liveValue = desktopSearchRef.current?.getValue() ?? searchInputValue;
              onSearchSubmit(liveValue, false);
              setIsDesktopSearchFocused(false);
              setActiveSuggestionIndex(-1);
            }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-1 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300 dark:focus-visible:ring-offset-slate-900"
            aria-label="Submit search"
            title="Search"
          >
            <Search size={16} />
          </button>
          {(searchInputValue.trim().length > 0 || committedSearchQuery.trim().length > 0) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleClearSearch();
              }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-1 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300 dark:focus-visible:ring-offset-slate-900"
              aria-label="Clear search"
              title="Clear"
            >
              <X size={16} />
            </button>
          )}
          {trailingToolbar}
        </div>
      </div>
    );
  },
);

HeaderSearchSlotInner.displayName = 'HeaderSearchSlot';

export const HeaderSearchSlot = React.memo(HeaderSearchSlotInner);
