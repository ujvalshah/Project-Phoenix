import React, { useCallback, useMemo, Suspense, lazy } from 'react';

const LazyMobileSearchOverlay = lazy(() =>
  import('./MobileSearchOverlay').then((m) => ({ default: m.MobileSearchOverlay })),
);
import { shallowEqual as shallowEqualFilters, useFilterSelector } from '@/context/FilterStateContext';
import { recordSearchEvent } from '@/observability/telemetry';

export interface HeaderMobileSearchSessionProps {
  isOpen: boolean;
  onRequestClose: () => void;
  onSearchSubmit: (query: string, closeMobileOverlay: boolean) => void;
}

/**
 * Owns mobile overlay + filter draft subscription so Header does not rerender on each keystroke
 * while the overlay is open (or while draft changes from other surfaces).
 */
const HeaderMobileSearchSessionInner: React.FC<HeaderMobileSearchSessionProps> = ({
  isOpen,
  onRequestClose,
  onSearchSubmit,
}) => {
  const {
    searchInputValue,
    searchInputResetSignal,
    setSearchInput: setSearchDraft,
    commitSearch,
    revertSearchDraftToCommitted,
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
      revertSearchDraftToCommitted: s.revertSearchDraftToCommitted,
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

  const handleDebouncedSearch = useCallback(
    (value: string) => {
      setSearchDraft(value);
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

  return (
    <Suspense fallback={null}>
      <LazyMobileSearchOverlay
        isOpen={isOpen}
        onClose={(reason) => {
          if (reason !== 'commit') {
            recordSearchEvent({
              name: 'search_abandoned',
              payload: { surface: 'mobile-overlay', draft: searchInputValue },
            });
            revertSearchDraftToCommitted();
          }
          onRequestClose();
        }}
        initialValue={searchInputValue}
        resetSignal={searchInputResetSignal}
        onDraftChange={handleDebouncedSearch}
        onCommitSearch={(q) => onSearchSubmit(q, true)}
        suggestionFilters={suggestionFilters}
      />
    </Suspense>
  );
};

HeaderMobileSearchSessionInner.displayName = 'HeaderMobileSearchSession';

export const HeaderMobileSearchSession = React.memo(HeaderMobileSearchSessionInner);
