import { useState, useLayoutEffect, useMemo, useCallback, useRef } from 'react';

/**
 * Breakpoint configuration for responsive column calculation
 */
export interface BreakpointConfig {
  minWidth: number;
  columnCount: number;
}

/**
 * Configuration for useMasonry hook
 */
export interface MasonryConfig {
  /**
   * Breakpoints sorted by minWidth (ascending)
   * Example: [{ minWidth: 0, columnCount: 1 }, { minWidth: 768, columnCount: 2 }, ...]
   */
  breakpoints: BreakpointConfig[];
  /**
   * Default column count for SSR (must match expected initial render)
   */
  defaultColumns: number;
  /**
   * Debounce delay for resize handling (ms)
   * @default 100
   */
  debounceMs?: number;
}

/**
 * Return type from useMasonry hook
 */
export interface MasonryResult<T> {
  /**
   * Items distributed into columns (columns[columnIndex][itemIndex])
   */
  columns: T[][];
  /**
   * Current column count (may differ from config.defaultColumns after client mount)
   */
  columnCount: number;
}

/**
 * Deterministic Round-Robin Masonry Hook
 * 
 * Architecture Rules:
 * - Uses index % columnCount for distribution (deterministic)
 * - Computes columnCount ONLY on client (SSR-safe)
 * - Uses useLayoutEffect for client measurement (prevents flash)
 * - Debounces resize handling (performance)
 * - NO height measurement
 * - NO shortest-column logic
 * - NO CSS columns
 * 
 * @template T - Type of items in the array
 * @param items - Array of items to distribute
 * @param config - Configuration for breakpoints and defaults
 * @returns { columns, columnCount }
 */
export function useMasonry<T>(
  items: T[],
  config: MasonryConfig
): MasonryResult<T> {
  const { breakpoints, defaultColumns, debounceMs = 100 } = config;

  // #1: Normalize and validate breakpoints (sort, filter invalid entries)
  const normalizedBreakpoints = useMemo(() => {
    // Filter invalid entries (minWidth < 0, columnCount < 1)
    const valid = breakpoints.filter(
      (bp) => bp.minWidth >= 0 && bp.columnCount >= 1
    );

    // Warn in development if breakpoints were invalid
    if (process.env.NODE_ENV === 'development' && valid.length !== breakpoints.length) {
      console.warn(
        '[useMasonry] Invalid breakpoints filtered out. Ensure minWidth >= 0 and columnCount >= 1.'
      );
    }

    // Sort by minWidth ascending (required for correct matching logic)
    return [...valid].sort((a, b) => a.minWidth - b.minWidth);
  }, [breakpoints]);

  // #3: Ensure defaultColumns is at least 1 (safety guard)
  const safeDefaultColumns = Math.max(1, defaultColumns);

  // SSR-safe initial state (matches server render)
  const [columnCount, setColumnCount] = useState<number>(safeDefaultColumns);
  const [isClient, setIsClient] = useState<boolean>(false);

  // #5: Store timeout ID in ref to prevent memory leaks
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate column count from viewport width
  const calculateColumnCount = useCallback((): number => {
    // Guard against SSR
    if (typeof window === 'undefined') {
      return safeDefaultColumns;
    }

    const width = window.innerWidth;
    
    // Find the highest breakpoint that matches
    // Breakpoints are now guaranteed to be sorted by minWidth ascending
    let matchedColumns = safeDefaultColumns;
    for (let i = normalizedBreakpoints.length - 1; i >= 0; i--) {
      if (width >= normalizedBreakpoints[i].minWidth) {
        matchedColumns = normalizedBreakpoints[i].columnCount;
        break;
      }
    }

    // #3: Ensure columnCount is at least 1 (safety guard)
    return Math.max(1, matchedColumns);
  }, [normalizedBreakpoints, safeDefaultColumns]);

  // Client-side column calculation (runs after mount)
  useLayoutEffect(() => {
    // Mark as client-side
    setIsClient(true);

    // Calculate initial column count
    const initialColumns = calculateColumnCount();
    setColumnCount(initialColumns);

    // Debounced resize handler
    // #5: Use ref for timeout ID to prevent stale closures and ensure cleanup
    const handleResize = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        const newColumnCount = calculateColumnCount();
        setColumnCount(newColumnCount);
        timeoutRef.current = null;
      }, debounceMs);
    };

    window.addEventListener('resize', handleResize);
    
    return () => {
      // #5: Always clear timeout on cleanup to prevent memory leaks
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      window.removeEventListener('resize', handleResize);
    };
  }, [calculateColumnCount, debounceMs]);

  // Distribute items deterministically using round-robin
  const columns = useMemo(() => {
    // #3: Early return for empty items (safety + clarity)
    if (items.length === 0) {
      return [] as T[][];
    }

    // Use safeDefaultColumns during SSR, actual columnCount after client mount
    const activeColumnCount = isClient ? columnCount : safeDefaultColumns;
    
    // #3: Ensure columnCount is at least 1 (prevent Array.from({ length: 0 }))
    const safeColumnCount = Math.max(1, activeColumnCount);
    
    const cols: T[][] = Array.from({ length: safeColumnCount }, () => []);
    
    items.forEach((item, index) => {
      const columnIndex = index % safeColumnCount;
      cols[columnIndex].push(item);
    });
    
    return cols;
  }, [items, columnCount, safeDefaultColumns, isClient]);

  // #3: Ensure returned columnCount is at least 1
  const safeColumnCount = Math.max(1, isClient ? columnCount : safeDefaultColumns);

  return {
    columns,
    columnCount: safeColumnCount,
  };
}











