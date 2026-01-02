/**
 * ============================================================================
 * FEED SCROLL STATE CONTEXT: Scroll Position Persistence for Modal Routes
 * ============================================================================
 * 
 * PURPOSE:
 * Persists scroll state (offset, virtual index, active item ID) across
 * modal route transitions to ensure zero visual jump when opening/closing
 * the detail view bottom sheet.
 * 
 * ARCHITECTURE:
 * - Stores scroll state in memory (React context)
 * - Can optionally persist to location.state for URL-addressable routes
 * - Restores scroll BEFORE virtualizer renders to prevent layout shifts
 * 
 * USAGE:
 * - FeedContainer saves scroll state on scroll events
 * - FeedContainer restores scroll state on mount (BEFORE render)
 * - Modal route pattern keeps FeedContainer mounted
 * 
 * ============================================================================
 */

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

export interface FeedScrollState {
  /** Scroll offset in pixels */
  scrollOffset: number;
  /** Virtual item index (for TanStack React Virtual) */
  virtualIndex: number;
  /** Active item ID (article ID that was clicked) */
  activeItemId: string | null;
}

interface FeedScrollStateContextType {
  /** Current scroll state */
  scrollState: FeedScrollState | null;
  /** Save scroll state */
  saveScrollState: (state: FeedScrollState) => void;
  /** Restore scroll state (returns null if no state saved) */
  restoreScrollState: () => FeedScrollState | null;
  /** Clear scroll state */
  clearScrollState: () => void;
}

const FeedScrollStateContext = createContext<FeedScrollStateContextType | undefined>(undefined);

/**
 * FeedScrollStateProvider
 * 
 * Provides scroll state persistence for feed virtualization.
 * State is stored in memory and persists across route transitions
 * as long as the provider remains mounted.
 */
export const FeedScrollStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Use ref to store state to avoid unnecessary re-renders
  const scrollStateRef = useRef<FeedScrollState | null>(null);
  const [scrollState, setScrollState] = useState<FeedScrollState | null>(null);

  const saveScrollState = useCallback((state: FeedScrollState) => {
    scrollStateRef.current = state;
    setScrollState(state);
  }, []);

  const restoreScrollState = useCallback((): FeedScrollState | null => {
    return scrollStateRef.current;
  }, []);

  const clearScrollState = useCallback(() => {
    scrollStateRef.current = null;
    setScrollState(null);
  }, []);

  return (
    <FeedScrollStateContext.Provider
      value={{
        scrollState,
        saveScrollState,
        restoreScrollState,
        clearScrollState,
      }}
    >
      {children}
    </FeedScrollStateContext.Provider>
  );
};

/**
 * useFeedScrollState Hook
 * 
 * Access feed scroll state context.
 * Must be used within FeedScrollStateProvider.
 */
export const useFeedScrollState = (): FeedScrollStateContextType => {
  const context = useContext(FeedScrollStateContext);
  if (!context) {
    throw new Error('useFeedScrollState must be used within FeedScrollStateProvider');
  }
  return context;
};




