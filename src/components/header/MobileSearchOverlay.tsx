import React, { useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Clock } from 'lucide-react';
import { SearchInput, SearchInputHandle } from './SearchInput';
import { getOverlayHost } from '@/utils/overlayHosts';
import { useSearchSuggestions } from '@/hooks/useSearchSuggestions';
import { setPendingSuggestionArticleId } from '@/observability/searchTelemetryIds';
import { recordSearchEvent } from '@/observability/telemetry';
import {
  formatContentStreamLabel,
  formatSourceTypeLabel,
  formatSuggestionPublishedLabel,
} from '@/utils/suggestionDisplay';

interface MobileSearchOverlayProps {
  isOpen: boolean;
  onClose: (reason?: 'dismiss' | 'commit') => void;
  initialValue: string;
  /** Bumped by filter resets so the overlay's input mirrors the cleared state. */
  resetSignal?: number;
  onDraftChange: (value: string) => void;
  onCommitSearch: (value: string) => void;
}

/**
 * Full-screen mobile search overlay with recent searches.
 *
 * Extracted from Header to prevent the overlay's state (recent searches,
 * input value) from participating in Header's render cycle.
 */
export const MobileSearchOverlay = React.memo<MobileSearchOverlayProps>(({
  isOpen,
  onClose,
  initialValue,
  resetSignal,
  onDraftChange,
  onCommitSearch,
}) => {
  const searchRef = useRef<SearchInputHandle>(null);
  const scrollBodyRef = useRef<HTMLDivElement>(null);
  const typeaheadBucketRef = useRef<'lt2' | 'ge2'>('lt2');
  const debouncedDraftRef = useRef('');
  const [draftQuery, setDraftQuery] = useState(initialValue);
  const [debouncedDraftQuery, setDebouncedDraftQuery] = useState(initialValue);
  const [viewportBottomPadPx, setViewportBottomPadPx] = useState(0);
  const suggestionsQuery = useSearchSuggestions(debouncedDraftQuery, 6);

  useLayoutEffect(() => {
    debouncedDraftRef.current = debouncedDraftQuery;
  }, [debouncedDraftQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedDraftQuery(draftQuery);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [draftQuery]);

  // Re-open: scroll to top and align bucket (portal unmounts when closed; refs reset on next mount).
  useEffect(() => {
    if (!isOpen) return;
    requestAnimationFrame(() => {
      const el = scrollBodyRef.current;
      if (el) el.scrollTop = 0;
      typeaheadBucketRef.current = debouncedDraftRef.current.trim().length >= 2 ? 'ge2' : 'lt2';
    });
  }, [isOpen]);

  // When typeahead turns on/off, reset scroll so users are not left mid-list on
  // a panel that just unmounted most of its content (scenario 5).
  useEffect(() => {
    const bucket = debouncedDraftQuery.trim().length >= 2 ? 'ge2' : 'lt2';
    if (typeaheadBucketRef.current === bucket) return;
    typeaheadBucketRef.current = bucket;
    const el = scrollBodyRef.current;
    if (el) el.scrollTop = 0;
  }, [debouncedDraftQuery]);

  // Virtual keyboard / visual viewport: keep scrollable tail reachable (scenario 6).
  useEffect(() => {
    if (!isOpen) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const sync = () => {
      const obscured = Math.max(0, window.innerHeight - (vv.offsetTop + vv.height));
      setViewportBottomPadPx(obscured);
    };
    sync();
    vv.addEventListener('resize', sync);
    vv.addEventListener('scroll', sync);
    return () => {
      vv.removeEventListener('resize', sync);
      vv.removeEventListener('scroll', sync);
      setViewportBottomPadPx(0);
    };
  }, [isOpen]);

  // Recent searches — self-contained in the overlay.
  // Guarded against corrupted/foreign localStorage payloads: a bad value must
  // never crash the overlay's mount (the only user-visible search path on mobile).
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem('recent_searches');
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((s): s is string => typeof s === 'string' && s.length > 0);
    } catch {
      return [];
    }
  });

  const saveRecentSearch = useCallback((query: string) => {
    if (!query.trim()) return;
    const trimmed = query.trim();
    setRecentSearches(prev => {
      const updated = [trimmed, ...prev.filter(s => s !== trimmed)].slice(0, 5);
      if (typeof window !== 'undefined') {
        localStorage.setItem('recent_searches', JSON.stringify(updated));
      }
      return updated;
    });
  }, []);

  const handleSubmit = useCallback((query: string) => {
    if (query.trim()) {
      saveRecentSearch(query);
    }
    onCommitSearch(query.trim());
    onClose('commit');
  }, [saveRecentSearch, onCommitSearch, onClose]);

  const handleSuggestionPick = useCallback(
    (item: { id: string; title: string }, rankIndex: number) => {
      recordSearchEvent({
        name: 'search_suggestion_selected',
        payload: {
          query: draftQuery.trim(),
          suggestionId: item.id,
          suggestionTitle: item.title,
          commitQuery: item.title,
          selectionIntent: 'commit_search_by_article_title',
          source: 'touch',
          surface: 'mobile-overlay',
          rank: rankIndex + 1,
        },
      });
      setPendingSuggestionArticleId(item.id);
      handleSubmit(item.title);
    },
    [draftQuery, handleSubmit],
  );

  const handleRecentClick = useCallback((search: string) => {
    searchRef.current?.setValue(search);
    handleSubmit(search);
  }, [handleSubmit]);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed left-0 right-0 top-0 flex h-[100dvh] max-h-[100dvh] min-h-0 flex-col overflow-hidden bg-white pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Search"
    >
      {/* Search Bar — non-scrolling; top safe area so chrome stays below notch (scenario 10) */}
      <div className="flex shrink-0 items-center gap-3 border-b border-gray-200 px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top,0px))]">
        <div className="relative flex-1">
          <SearchInput
            ref={searchRef}
            initialValue={initialValue}
            resetSignal={resetSignal}
            externalValue={initialValue}
            onSearch={(value) => {
              setDraftQuery(value);
              onDraftChange(value);
            }}
            onChangeImmediate={(value) => setDraftQuery(value)}
            onSubmit={(q) => handleSubmit(q)}
            placeholder="Search..."
            className="w-full"
            inputClassName="w-full h-12 pl-11 pr-12 text-base font-medium bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:bg-white focus:outline-none transition-all"
            iconSize={20}
            autoFocus
          />
        </div>
        <button
          onClick={() => onClose('dismiss')}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors"
          aria-label="Close search"
        >
          <X size={20} />
        </button>
      </div>

      {/* Single scroll region: suggestions + recents (avoids flex min-height:auto overflow past fixed shell on mobile) */}
      <div
        ref={scrollBodyRef}
        className="hide-scrollbar-mobile min-h-0 flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]"
        style={{
          paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + ${viewportBottomPadPx}px)`,
        }}
      >
        {/* Typeahead suggestions */}
        {debouncedDraftQuery.trim().length >= 2 && (
          <div className="px-4 pt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Suggestions</p>
            {suggestionsQuery.isLoading ? (
              <p className="py-2 text-sm text-gray-500">Loading suggestions...</p>
            ) : suggestionsQuery.data?.suggestions?.length ? (
              <div className="space-y-1">
                {suggestionsQuery.data.suggestions.map((item, index) => {
                  const dateLabel = formatSuggestionPublishedLabel(item.publishedAt);
                  const streamLabel = formatContentStreamLabel(item.contentStream);
                  const sourceLabel = formatSourceTypeLabel(item.sourceType);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSuggestionPick(item, index)}
                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <div className="font-medium">{item.title}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-gray-500">
                        <span className="rounded bg-gray-100 px-1.5 py-px font-medium text-gray-600">
                          {streamLabel}
                        </span>
                        {dateLabel ? <span>{dateLabel}</span> : null}
                        {sourceLabel ? <span className="text-gray-400">{sourceLabel}</span> : null}
                      </div>
                      {item.excerpt ? (
                        <div className="line-clamp-1 text-xs text-gray-500">{item.excerpt}</div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="py-2 text-sm text-gray-500">No suggestions found.</p>
            )}
          </div>
        )}

        {/* Recent Searches */}
        {recentSearches.length > 0 && (
          <div className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <Clock size={16} className="text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-700">Recent Searches</h3>
            </div>
            <div className="space-y-1">
              {recentSearches.map((search, index) => (
                <button
                  key={index}
                  onClick={() => handleRecentClick(search)}
                  className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                  aria-label={`Search for ${search}`}
                >
                  <Clock size={16} className="text-gray-400" />
                  {search}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty State — only before typeahead is active (otherwise suggestions panel owns the body) */}
        {recentSearches.length === 0 && debouncedDraftQuery.trim().length < 2 && (
          <div className="flex min-h-[40vh] flex-col items-center justify-center p-8">
            <div className="text-center">
              <Search size={48} className="mx-auto mb-4 text-gray-300" />
              <p className="text-sm text-gray-500">Start typing to search</p>
            </div>
          </div>
        )}
      </div>
    </div>,
    getOverlayHost('drawer'),
  );
});

MobileSearchOverlay.displayName = 'MobileSearchOverlay';
