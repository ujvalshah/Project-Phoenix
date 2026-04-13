import React, { createContext, useContext } from 'react';
import { useFilterState, UseFilterStateReturn } from '@/hooks/useFilterState';

const FilterStateContext = createContext<UseFilterStateReturn | null>(null);

/**
 * Provides filter state (search, categories, sort, tags, etc.) to the entire
 * component tree. Replaces the previous pattern of calling useFilterState() in
 * AppContent and drilling ~30 props through Header and HomePage.
 *
 * Place this provider inside the Router (it depends on useSearchParams).
 */
export const FilterStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const filters = useFilterState();
  return (
    <FilterStateContext.Provider value={filters}>
      {children}
    </FilterStateContext.Provider>
  );
};

/**
 * Consume the full filter state object. Throws if used outside FilterStateProvider.
 */
export function useFilters(): UseFilterStateReturn {
  const ctx = useContext(FilterStateContext);
  if (!ctx) {
    throw new Error('useFilters must be used within a FilterStateProvider');
  }
  return ctx;
}
