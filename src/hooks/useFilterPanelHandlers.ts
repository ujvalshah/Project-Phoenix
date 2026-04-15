import { useCallback, useMemo } from 'react';
import { shallowEqual, useFilterSelector } from '@/context/FilterStateContext';
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
    setFilterPanelState,
  } = useFilterSelector(
    (s) => ({
      collectionId: s.collectionId,
      formatTagIds: s.formatTagIds,
      domainTagIds: s.domainTagIds,
      subtopicTagIds: s.subtopicTagIds,
      setFilterPanelState: s.setFilterPanelState,
    }),
    shallowEqual,
  );

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
      setFilterPanelState({
        collectionId: newFilters.collectionId,
        formatTagIds: newFilters.formatTagIds || [],
        domainTagIds: newFilters.domainTagIds || [],
        subtopicTagIds: newFilters.subtopicTagIds || [],
      });
    },
    [setFilterPanelState],
  );

  const handleFilterClear = useCallback(() => {
    setFilterPanelState({
      collectionId: null,
      formatTagIds: [],
      domainTagIds: [],
      subtopicTagIds: [],
    });
  }, [setFilterPanelState]);

  return { filterState, handleFilterChange, handleFilterClear };
}
