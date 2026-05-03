/**
 * Dev-only Performance.mark / measure helpers for header surfaces.
 * Stripped in production via `__NUGGETS_DEV_PERF_MARKS__` (see vite.config.ts).
 */

declare const __NUGGETS_DEV_PERF_MARKS__: boolean;

const PREFIX = 'nuggets-perf';

export const HEADER_PERF_SURFACES = {
  BELL_DROPDOWN: 'bell-dropdown',
  NAV_DRAWER: 'nav-drawer',
  MOBILE_SEARCH_OVERLAY: 'mobile-search-overlay',
  MOBILE_FILTER_SHEET: 'mobile-filter-sheet',
} as const;

export type HeaderPerfSurfaceId = (typeof HEADER_PERF_SURFACES)[keyof typeof HEADER_PERF_SURFACES];

/** Normalized keys on `window.__DEV_PERF_RESULTS__` for automation (Playwright, etc.). */
export const DEV_PERF_RESULT_KEYS = {
  INITIAL_IDLE_SETTLED: 'initial-idle-settled',
  BELL_FIRST_OPEN: 'bell-dropdown-first-open',
  NAV_DRAWER_FIRST_OPEN: 'nav-drawer-first-open',
  MOBILE_SEARCH_FIRST_OPEN: 'mobile-search-overlay-first-open',
  MOBILE_FILTER_FIRST_OPEN: 'mobile-filter-sheet-first-open',
} as const;

export type DevPerfResultEntry = {
  duration?: number;
  status: 'ok' | 'missing' | 'skipped';
  reason?: string;
  meta?: Record<string, string | number | boolean>;
};

const SURFACE_TO_RESULT_KEY: Record<HeaderPerfSurfaceId, string> = {
  'bell-dropdown': DEV_PERF_RESULT_KEYS.BELL_FIRST_OPEN,
  'nav-drawer': DEV_PERF_RESULT_KEYS.NAV_DRAWER_FIRST_OPEN,
  'mobile-search-overlay': DEV_PERF_RESULT_KEYS.MOBILE_SEARCH_FIRST_OPEN,
  'mobile-filter-sheet': DEV_PERF_RESULT_KEYS.MOBILE_FILTER_FIRST_OPEN,
};

function ensureDevPerfResults(): Record<string, DevPerfResultEntry> {
  if (typeof window === 'undefined') return {};
  const w = window as Window & { __DEV_PERF_RESULTS__?: Record<string, DevPerfResultEntry> };
  if (!w.__DEV_PERF_RESULTS__) {
    w.__DEV_PERF_RESULTS__ = {};
  }
  return w.__DEV_PERF_RESULTS__;
}

function storeDevPerfResult(key: string, entry: DevPerfResultEntry): void {
  if (!active() || typeof window === 'undefined') return;
  ensureDevPerfResults()[key] = entry;
}

function active(): boolean {
  return typeof __NUGGETS_DEV_PERF_MARKS__ !== 'undefined' && __NUGGETS_DEV_PERF_MARKS__;
}

/** Log once per page load: confirms dev define + perf helpers are live. */
export function logDevPerfMarksStartup(): void {
  if (!active()) return;
  console.log('[perf] dev perf marks enabled', {
    __NUGGETS_DEV_PERF_MARKS__: __NUGGETS_DEV_PERF_MARKS__,
  });
}

/** Surfaces that have already completed a first-open measurement (session lifetime). */
const firstOpenDone = new Set<string>();

/** First-fire wins for initial-idle-settled (requestIdleCallback vs setTimeout 250). */
let initialIdleSettledRecorded = false;

/**
 * Call synchronously when the user initiates opening (click / tap / keyboard).
 * No-op after first successful first-open measure for that surface.
 */
export function headerPerfSurfaceTrigger(surfaceId: HeaderPerfSurfaceId): void {
  if (!active()) return;
  if (firstOpenDone.has(surfaceId)) return;
  const name = `${PREFIX}:${surfaceId}:trigger`;
  performance.mark(name);
}

/**
 * Call from useLayoutEffect when lazy/open UI has committed (first time only per surface).
 */
export function headerPerfSurfaceReady(
  surfaceId: HeaderPerfSurfaceId,
  meta?: Record<string, string | number | boolean>,
): void {
  if (!active()) return;
  if (firstOpenDone.has(surfaceId)) return;

  const triggerName = `${PREFIX}:${surfaceId}:trigger`;
  if (performance.getEntriesByName(triggerName, 'mark').length === 0) return;

  const readyName = `${PREFIX}:${surfaceId}:ready`;
  performance.mark(readyName);

  const measureName = `${PREFIX}:${surfaceId}:first-open`;
  try {
    performance.measure(measureName, triggerName, readyName);
    const entries = performance.getEntriesByName(measureName, 'measure');
    const m = entries[entries.length - 1];
    if (m) {
      const resultKey = SURFACE_TO_RESULT_KEY[surfaceId];
      storeDevPerfResult(resultKey, {
        status: 'ok',
        duration: Math.round(m.duration),
        ...(meta && Object.keys(meta).length > 0 ? { meta } : {}),
      });
      firstOpenDone.add(surfaceId);
      console.groupCollapsed(`[perf] ${surfaceId}-first-open: ${Math.round(m.duration)}ms`);
      if (meta && Object.keys(meta).length > 0) console.log(meta);
      console.groupEnd();
    }
  } catch {
    // ignore invalid measure (missing marks)
  } finally {
    performance.clearMarks(triggerName);
    performance.clearMarks(readyName);
    performance.clearMeasures(measureName);
  }
}

/**
 * Mark immediately after `root.render` returns (sync point for “post React commit”).
 * Pair with {@link scheduleInitialIdleSettledFromPostRoot}.
 */
export function markPostReactRootForPerf(): void {
  if (!active()) return;
  performance.mark(`${PREFIX}:initial:post-react-root`);
  console.log('[perf] post-react-root marked');
}

/**
 * After {@link markPostReactRootForPerf}, schedules requestIdleCallback (if available) and
 * setTimeout(250); whichever runs first records exactly one measurement.
 */
export function scheduleInitialIdleSettledFromPostRoot(): void {
  if (!active()) return;

  const postRootMark = `${PREFIX}:initial:post-react-root`;
  if (performance.getEntriesByName(postRootMark, 'mark').length === 0) {
    console.warn('[perf] scheduleInitialIdleSettledFromPostRoot: missing post-react-root mark (was markPostReactRootForPerf skipped?)');
    return;
  }

  console.log('[perf] initial idle: scheduling started');

  const settledMark = `${PREFIX}:initial:settled`;
  const measureName = `${PREFIX}:initial-idle-settled`;

  let idleCallbackHandle: number | undefined;
  let timeout250Handle: ReturnType<typeof globalThis.setTimeout> | undefined;
  let watchdogHandle: ReturnType<typeof globalThis.setTimeout> | undefined;

  const cleanupTimers = (): void => {
    if (idleCallbackHandle !== undefined && typeof window.cancelIdleCallback === 'function') {
      window.cancelIdleCallback(idleCallbackHandle);
      idleCallbackHandle = undefined;
    }
    if (timeout250Handle !== undefined) {
      globalThis.clearTimeout(timeout250Handle);
      timeout250Handle = undefined;
    }
    if (watchdogHandle !== undefined) {
      globalThis.clearTimeout(watchdogHandle);
      watchdogHandle = undefined;
    }
  };

  const recordSettledOnce = (source: 'requestIdleCallback' | 'setTimeout-250'): void => {
    if (initialIdleSettledRecorded) return;
    initialIdleSettledRecorded = true;
    cleanupTimers();

    performance.mark(settledMark);
    try {
      performance.measure(measureName, postRootMark, settledMark);
      const m = performance.getEntriesByName(measureName, 'measure').pop();
      if (m) {
        storeDevPerfResult(DEV_PERF_RESULT_KEYS.INITIAL_IDLE_SETTLED, {
          status: 'ok',
          duration: Math.round(m.duration),
          meta: { source },
        });
        console.groupCollapsed(`[perf] initial-idle-settled: ${Math.round(m.duration)}ms (${source})`);
        console.log({
          span: 'post-react-root → first idle callback or 250ms fallback (whichever first)',
          source,
          note: 'Heuristic only; not browser network idle or TTI.',
        });
        console.groupEnd();
      } else {
        console.warn('[perf] initial-idle-settled: measure entry missing after measure()');
      }
    } catch (err) {
      console.warn('[perf] initial-idle-settled: measure failed', err);
    } finally {
      performance.clearMarks(postRootMark);
      performance.clearMarks(settledMark);
      performance.clearMeasures(measureName);
    }
  };

  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    idleCallbackHandle = (
      window as Window & {
        requestIdleCallback: (
          cb: (deadline: IdleDeadline) => void,
          opts?: { timeout?: number },
        ) => number;
      }
    ).requestIdleCallback(() => {
      if (initialIdleSettledRecorded) return;
      console.log('[perf] initial idle: requestIdleCallback fired');
      recordSettledOnce('requestIdleCallback');
    });
  } else {
    console.log('[perf] initial idle: requestIdleCallback unavailable, using 250ms fallback only');
  }

  timeout250Handle = globalThis.setTimeout(() => {
    if (initialIdleSettledRecorded) return;
    console.log('[perf] initial idle: timeout fallback fired (250ms)');
    recordSettledOnce('setTimeout-250');
  }, 250);

  watchdogHandle = globalThis.setTimeout(() => {
    if (!initialIdleSettledRecorded) {
      console.warn('[perf] initial-idle-settled missing');
    }
  }, 2000);
}
