/**
 * Dev-only Performance.mark / measure helpers for header surfaces.
 *
 * Production: `vite.config.ts` sets `__NUGGETS_DEV_PERF_MARKS__` to `false`; `active()` is always false,
 * so no marks/measures run and `window.__DEV_PERF_RESULTS__` is never written. Remaining code is inert;
 * minifiers may drop dead branches after constant folding.
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
  HOME_PHASEA_FIRST_CARDS: 'home-phasea-first-cards',
  HOME_PHASEA_TO_PHASEB: 'home-phasea-to-phaseb',
  HOME_FEED_DATA_READY_TO_LCP_REQUEST: 'home-feed-data-ready-to-lcp-request',
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
  try {
    const w = window as Window & { __DEV_PERF_RESULTS__?: Record<string, DevPerfResultEntry> };
    if (!w.__DEV_PERF_RESULTS__) {
      w.__DEV_PERF_RESULTS__ = {};
    }
    return w.__DEV_PERF_RESULTS__;
  } catch {
    return {};
  }
}

function storeDevPerfResult(key: string, entry: DevPerfResultEntry): void {
  if (!active() || typeof window === 'undefined') return;
  try {
    ensureDevPerfResults()[key] = entry;
  } catch {
    // Ignore (e.g. sealed window in exotic environments); dev-only path.
  }
}

/**
 * Generic dev perf result sink for custom local prototype metrics.
 * No-op in production builds.
 */
export function recordDevPerfResult(
  key: string,
  durationMs: number,
  meta?: Record<string, string | number | boolean>,
): void {
  if (!active()) return;
  const rounded = roundMs(durationMs);
  storeDevPerfResult(key, {
    status: 'ok',
    duration: rounded,
    ...(meta && Object.keys(meta).length > 0 ? { meta } : {}),
  });
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

/**
 * Mobile search first-open only: `performance.now()` samples for stage breakdown (dev-only).
 * Cleared after interactive stage is recorded so the object stays easy to remove later.
 */
let mobileSearchStageTimes:
  | {
      triggerAt: number;
      chunkAt?: number;
      commitAt?: number;
      interactiveAt?: number;
    }
  | undefined;

/** Session lifetime: first double-rAF “interactive” sample for mobile search. */
let mobileSearchInteractiveDone = false;

/**
 * Nav drawer first-open only: same stage model as mobile search (dev-only).
 */
let navDrawerStageTimes:
  | {
      triggerAt: number;
      chunkAt?: number;
      commitAt?: number;
      interactiveAt?: number;
    }
  | undefined;

let navDrawerInteractiveDone = false;

/** First-fire wins for initial-idle-settled (requestIdleCallback vs setTimeout 250). */
let initialIdleSettledRecorded = false;

function roundMs(n: number): number {
  return Math.round(n);
}

function resetMobileSearchStageState(): void {
  mobileSearchStageTimes = undefined;
}

function resetNavDrawerStageState(): void {
  navDrawerStageTimes = undefined;
}

/** DevTools timeline (optional): cleared after interactive to avoid unbounded marks. */
const MOBILE_SEARCH_MARK_CHUNK = `${PREFIX}:mobile-search-overlay:chunk`;
const MOBILE_SEARCH_MARK_INTERACTIVE = `${PREFIX}:mobile-search-overlay:interactive`;
const NAV_DRAWER_MARK_CHUNK = `${PREFIX}:nav-drawer:chunk`;
const NAV_DRAWER_MARK_INTERACTIVE = `${PREFIX}:nav-drawer:interactive`;

function metaMobileSearchStagesAtCommit(durationMs: number): Record<string, string | number | boolean> {
  const s = mobileSearchStageTimes;
  const meta: Record<string, string | number | boolean> = {
    stage_breakdown: 'mobile-search-v1',
    ms_trigger_to_commit: durationMs,
  };
  if (!s) return meta;

  if (s.chunkAt !== undefined) {
    meta.ms_trigger_to_chunk = roundMs(s.chunkAt - s.triggerAt);
    if (s.commitAt !== undefined) {
      meta.ms_chunk_to_commit = roundMs(s.commitAt - s.chunkAt);
    }
  } else {
    meta.ms_trigger_to_chunk_missing = true;
  }
  return meta;
}

function metaNavDrawerStagesAtCommit(durationMs: number): Record<string, string | number | boolean> {
  const s = navDrawerStageTimes;
  const meta: Record<string, string | number | boolean> = {
    stage_breakdown: 'nav-drawer-v1',
    ms_trigger_to_commit: durationMs,
  };
  if (!s) return meta;

  if (s.chunkAt !== undefined) {
    meta.ms_trigger_to_chunk = roundMs(s.chunkAt - s.triggerAt);
    if (s.commitAt !== undefined) {
      meta.ms_chunk_to_commit = roundMs(s.commitAt - s.chunkAt);
    }
  } else {
    meta.ms_trigger_to_chunk_missing = true;
  }
  return meta;
}

/** Lazy NavigationDrawer `import().then` — chunk evaluated before drawer render. */
export function markNavDrawerChunkResolved(): void {
  if (!active()) return;
  if (firstOpenDone.has('nav-drawer')) return;
  if (!navDrawerStageTimes) return;

  performance.mark(NAV_DRAWER_MARK_CHUNK);
  navDrawerStageTimes.chunkAt = performance.now();
}

/** After first paint following drawer commit (double rAF). */
export function markNavDrawerInteractive(): void {
  if (!active()) return;
  if (navDrawerInteractiveDone) return;
  if (!firstOpenDone.has('nav-drawer')) return;
  const s = navDrawerStageTimes;
  const commitAt = s?.commitAt;
  const triggerAt = s?.triggerAt;
  if (commitAt === undefined || triggerAt === undefined) return;

  const key = DEV_PERF_RESULT_KEYS.NAV_DRAWER_FIRST_OPEN;
  const prev = ensureDevPerfResults()[key];
  if (!prev || prev.status !== 'ok' || typeof prev.duration !== 'number') {
    return;
  }

  navDrawerInteractiveDone = true;
  performance.mark(NAV_DRAWER_MARK_INTERACTIVE);

  const interactiveAt = performance.now();
  if (s) s.interactiveAt = interactiveAt;

  const meta: Record<string, string | number | boolean> = {
    ...(prev.meta ?? {}),
    ms_commit_to_interactive: roundMs(interactiveAt - commitAt),
    ms_trigger_to_interactive: roundMs(interactiveAt - triggerAt),
  };

  storeDevPerfResult(key, { ...prev, meta });

  console.groupCollapsed(
    `[perf] nav-drawer stages (ms): commit→interactive ${meta.ms_commit_to_interactive} · trigger→interactive ${meta.ms_trigger_to_interactive}`,
  );
  console.log({
    'trigger→chunk': prev.meta?.ms_trigger_to_chunk,
    'chunk→commit': prev.meta?.ms_chunk_to_commit,
    'commit→interactive': meta.ms_commit_to_interactive,
    'trigger→commit (total first-open)': prev.duration,
  });
  console.groupEnd();

  performance.clearMarks(NAV_DRAWER_MARK_CHUNK);
  performance.clearMarks(NAV_DRAWER_MARK_INTERACTIVE);

  resetNavDrawerStageState();
}

/**
 * Lazy `import()` callback: dynamic chunk parsed/evaluated (before overlay render).
 */
export function markMobileSearchChunkResolved(): void {
  if (!active()) return;
  if (firstOpenDone.has('mobile-search-overlay')) return;
  if (!mobileSearchStageTimes) return;

  performance.mark(MOBILE_SEARCH_MARK_CHUNK);
  mobileSearchStageTimes.chunkAt = performance.now();
}

/**
 * After first paint following overlay commit (double rAF). Approximates “shell is on-screen”.
 */
export function markMobileSearchInteractive(): void {
  if (!active()) return;
  if (mobileSearchInteractiveDone) return;
  if (!firstOpenDone.has('mobile-search-overlay')) return;
  const s = mobileSearchStageTimes;
  const commitAt = s?.commitAt;
  const triggerAt = s?.triggerAt;
  if (commitAt === undefined || triggerAt === undefined) return;

  const key = DEV_PERF_RESULT_KEYS.MOBILE_SEARCH_FIRST_OPEN;
  const prev = ensureDevPerfResults()[key];
  if (!prev || prev.status !== 'ok' || typeof prev.duration !== 'number') {
    return;
  }

  mobileSearchInteractiveDone = true;
  performance.mark(MOBILE_SEARCH_MARK_INTERACTIVE);

  const interactiveAt = performance.now();
  if (s) s.interactiveAt = interactiveAt;

  const meta: Record<string, string | number | boolean> = {
    ...(prev.meta ?? {}),
    ms_commit_to_interactive: roundMs(interactiveAt - commitAt),
    ms_trigger_to_interactive: roundMs(interactiveAt - triggerAt),
  };

  storeDevPerfResult(key, { ...prev, meta });

  console.groupCollapsed(
    `[perf] mobile-search-overlay stages (ms): commit→interactive ${meta.ms_commit_to_interactive} · trigger→interactive ${meta.ms_trigger_to_interactive}`,
  );
  console.log({
    'trigger→chunk': prev.meta?.ms_trigger_to_chunk,
    'chunk→commit': prev.meta?.ms_chunk_to_commit,
    'commit→interactive': meta.ms_commit_to_interactive,
    'trigger→commit (total first-open)': prev.duration,
  });
  console.groupEnd();

  performance.clearMarks(MOBILE_SEARCH_MARK_CHUNK);
  performance.clearMarks(MOBILE_SEARCH_MARK_INTERACTIVE);

  resetMobileSearchStageState();
}

/**
 * Call synchronously when the user initiates opening (click / tap / keyboard).
 * No-op after first successful first-open measure for that surface.
 */
export function headerPerfSurfaceTrigger(surfaceId: HeaderPerfSurfaceId): void {
  if (!active()) return;
  if (firstOpenDone.has(surfaceId)) return;
  if (surfaceId === 'mobile-search-overlay') {
    mobileSearchStageTimes = { triggerAt: performance.now() };
  }
  if (surfaceId === 'nav-drawer') {
    navDrawerStageTimes = { triggerAt: performance.now() };
  }
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

  if (surfaceId === 'mobile-search-overlay' && mobileSearchStageTimes) {
    mobileSearchStageTimes.commitAt = performance.now();
  }

  if (surfaceId === 'nav-drawer' && navDrawerStageTimes) {
    navDrawerStageTimes.commitAt = performance.now();
  }

  const readyName = `${PREFIX}:${surfaceId}:ready`;
  performance.mark(readyName);

  const measureName = `${PREFIX}:${surfaceId}:first-open`;
  try {
    performance.measure(measureName, triggerName, readyName);
    const entries = performance.getEntriesByName(measureName, 'measure');
    const m = entries[entries.length - 1];
    if (m) {
      const resultKey = SURFACE_TO_RESULT_KEY[surfaceId];
      const msExtra =
        surfaceId === 'mobile-search-overlay'
          ? metaMobileSearchStagesAtCommit(Math.round(m.duration))
          : surfaceId === 'nav-drawer'
            ? metaNavDrawerStagesAtCommit(Math.round(m.duration))
            : {};
      const mergedMeta =
        surfaceId === 'mobile-search-overlay' || surfaceId === 'nav-drawer'
          ? { ...(meta ?? {}), ...msExtra }
          : meta && Object.keys(meta).length > 0
            ? meta
            : undefined;
      storeDevPerfResult(resultKey, {
        status: 'ok',
        duration: Math.round(m.duration),
        ...(mergedMeta && Object.keys(mergedMeta).length > 0 ? { meta: mergedMeta } : {}),
      });
      firstOpenDone.add(surfaceId);
      console.groupCollapsed(`[perf] ${surfaceId}-first-open: ${Math.round(m.duration)}ms`);
      if (mergedMeta && Object.keys(mergedMeta).length > 0) console.log(mergedMeta);
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
