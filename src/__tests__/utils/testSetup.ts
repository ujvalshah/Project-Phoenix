/**
 * Test Setup Utilities
 * 
 * Provides mocks for browser APIs used in infinite scroll tests
 */

import { vi } from 'vitest';

/**
 * Mock IntersectionObserver for testing infinite scroll
 * 
 * Usage:
 * ```ts
 * const { mockObserve, mockUnobserve, triggerIntersection } = setupIntersectionObserver();
 * // ... render component
 * triggerIntersection(); // Simulate scroll trigger
 * ```
 */
export function setupIntersectionObserver() {
  const observe = vi.fn();
  const unobserve = vi.fn();
  const disconnect = vi.fn();
  
  let callback: IntersectionObserverCallback | null = null;
  let options: IntersectionObserverInit | null = null;

  const MockIntersectionObserver = vi.fn((cb: IntersectionObserverCallback, opts?: IntersectionObserverInit) => {
    callback = cb;
    options = opts || null;
    return {
      observe,
      unobserve,
      disconnect,
      root: null,
      rootMargin: '',
      thresholds: [],
    };
  });

  // Replace global IntersectionObserver
  global.IntersectionObserver = MockIntersectionObserver as any;

  /**
   * Trigger intersection observer callback
   * @param isIntersecting - Whether the element is intersecting (default: true)
   */
  const triggerIntersection = (isIntersecting: boolean = true) => {
    if (callback) {
      const mockEntry: IntersectionObserverEntry = {
        boundingClientRect: {} as DOMRectReadOnly,
        intersectionRatio: isIntersecting ? 1 : 0,
        intersectionRect: {} as DOMRectReadOnly,
        isIntersecting,
        rootBounds: null,
        target: {} as Element,
        time: Date.now(),
      };
      callback([mockEntry], {} as IntersectionObserver);
    }
  };

  return {
    observe,
    unobserve,
    disconnect,
    triggerIntersection,
    MockIntersectionObserver,
  };
}

/**
 * Setup React Query test environment
 * Provides QueryClient with default options for testing
 */
export function setupReactQuery() {
  const { QueryClient, QueryClientProvider } = require('@tanstack/react-query');
  
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0, // Disable garbage collection for tests
      },
      mutations: {
        retry: false,
      },
    },
  });

  return { QueryClient, QueryClientProvider, queryClient };
}

/**
 * Wait for React Query to finish loading
 * Useful for waiting for async queries to complete
 */
export async function waitForQueryToFinish() {
  // Wait for next tick to allow React Query to process
  await new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * Advance timers and wait for React updates
 */
export async function advanceTimersAndWait(ms: number = 0) {
  vi.advanceTimersByTime(ms);
  await waitForQueryToFinish();
}



