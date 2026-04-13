import { useCallback, useMemo } from 'react';
import { useFilters } from '@/context/FilterStateContext';
import type { FilterState } from '@/components/header/filterTypes';

/**
 * Shared filter panel wiring (Header popover, desktop sidebar, etc.).
 * Keeps collection + dimension tag sync identical everywhere.
 */
export function useFilterPanelHandlers(): {
  filterState: FilterState;
  handleFilterChange: (newFilters: FilterState) => void;
  handleFilterClear: () => void;
} {
  const {
    collectionId,
    formatTagIds,
    domainTagIds,
    subtopicTagIds,
    setCollectionId,
    toggleFormatTag,
    toggleDomainTag,
    toggleSubtopicTag,
    clearFormatTags,
    clearDomainTags,
    clearSubtopicTags,
  } = useFilters();

  const filterState: FilterState = useMemo(
    () => ({
      collectionId: collectionId ?? null,
      formatTagIds,
      domainTagIds,
      subtopicTagIds,
    }),
    [collectionId, formatTagIds, domainTagIds, subtopicTagIds],
  );

  const handleFilterChange = useCallback(
    (newFilters: FilterState) => {
      setCollectionId(newFilters.collectionId);
      const syncDimension = (prev: string[], next: string[], toggle: (id: string) => void) => {
        for (const id of next) {
          if (!prev.includes(id)) toggle(id);
        }
        for (const id of prev) {
          if (!next.includes(id)) toggle(id);
        }
      };
      syncDimension(formatTagIds, newFilters.formatTagIds || [], toggleFormatTag);
      syncDimension(domainTagIds, newFilters.domainTagIds || [], toggleDomainTag);
      syncDimension(subtopicTagIds, newFilters.subtopicTagIds || [], toggleSubtopicTag);
    },
    [
      setCollectionId,
      formatTagIds,
      domainTagIds,
      subtopicTagIds,
      toggleFormatTag,
      toggleDomainTag,
      toggleSubtopicTag,
    ],
  );

  const handleFilterClear = useCallback(() => {
    setCollectionId(null);
    clearFormatTags();
    clearDomainTags();
    clearSubtopicTags();
  }, [setCollectionId, clearFormatTags, clearDomainTags, clearSubtopicTags]);

  return { filterState, handleFilterChange, handleFilterClear };
}
