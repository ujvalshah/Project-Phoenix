import React, { createContext, useContext, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useFilterState, UseFilterStateReturn } from '@/hooks/useFilterState';
import { shallowEqual } from '@/utils/shallowEqual';

export { shallowEqual };

interface FilterStateStore {
  getSnapshot: () => UseFilterStateReturn;
  subscribe: (listener: () => void) => () => void;
}

const FilterStateContext = createContext<FilterStateStore | null>(null);

/**
 * Provides filter state (search, categories, sort, tags, etc.) to the entire
 * component tree. The provider owns React state via useFilterState; consumers
 * subscribe through useFilterSelector with a custom equality fn so they only
 * re-render when their slice changes.
 *
 * Notification runs in useLayoutEffect so subscribers update in the same
 * paint as the provider — no one-frame lag, no tearing window.
 */
export const FilterStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const filters = useFilterState();
  const snapshotRef = useRef(filters);
  const listenersRef = useRef(new Set<() => void>());

  useLayoutEffect(() => {
    snapshotRef.current = filters;
    listenersRef.current.forEach((listener) => listener());
  }, [filters]);

  const store = useMemo<FilterStateStore>(
    () => ({
      getSnapshot: () => snapshotRef.current,
      subscribe: (listener: () => void) => {
        listenersRef.current.add(listener);
        return () => {
          listenersRef.current.delete(listener);
        };
      },
    }),
    [],
  );

  return (
    <FilterStateContext.Provider value={store}>
      {children}
    </FilterStateContext.Provider>
  );
};

export function useFilterSelector<T>(
  selector: (state: UseFilterStateReturn) => T,
  isEqual: (prev: T, next: T) => boolean = Object.is,
): T {
  const store = useContext(FilterStateContext);
  if (!store) {
    throw new Error('useFilterSelector must be used within a FilterStateProvider');
  }
  const selectorRef = useRef(selector);
  const isEqualRef = useRef(isEqual);
  selectorRef.current = selector;
  isEqualRef.current = isEqual;

  const selectionRef = useRef<{ value: T } | null>(null);

  const getSelection = () => {
    const next = selectorRef.current(store.getSnapshot());
    const prev = selectionRef.current;
    if (prev && isEqualRef.current(prev.value, next)) {
      return prev.value;
    }
    selectionRef.current = { value: next };
    return next;
  };

  // getServerSnapshot returns the same selection as getSnapshot — the app is
  // an SPA with no SSR, but React requires the arg to be defined to avoid a
  // hydration warning if a server renderer is ever introduced.
  return useSyncExternalStore(store.subscribe, getSelection, getSelection);
}

/**
 * Consume the full filter state object. Uses shallow equality so broad
 * consumers only re-render when an actual field changes.
 */
export function useFilters(): UseFilterStateReturn {
  return useFilterSelector((state) => state, shallowEqual);
}
