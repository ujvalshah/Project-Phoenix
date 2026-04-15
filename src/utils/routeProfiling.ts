/**
 * SPA route-transition profiling.
 *
 * Captures three signals per navigation:
 *   1. nav-start    — the user gesture (link click or popstate). This is the
 *                     only honest "transition start"; useEffect post-commit is
 *                     too late.
 *   2. nav-commit   — React has rendered the new route's first paint.
 *   3. content-ready — page-specific signal that meaningful content is on
 *                     screen (pages opt in via `markRouteContentReady`).
 *
 * Pages that own a "first content" moment (e.g. the feed) should call
 * `markRouteContentReady('feed')` from the effect that fires when their data
 * becomes visible. Pages without that signal still get nav-start → nav-commit.
 */

interface PendingNav {
  start: number;
  fromPath: string;
  toPath: string | null; // null when target is unknown (popstate)
}

let pending: PendingNav | null = null;
let pendingExpiryTimer: number | null = null;
// Same-tick no-op clicks (preventDefault later in capture phase, same-path
// links, etc.) can leave `pending` set. If the next route transition doesn't
// consume it within this window, drop it so it doesn't get mis-attributed.
const PENDING_NAV_TTL_MS = 1000;

const clearPendingExpiry = () => {
  if (pendingExpiryTimer !== null) {
    window.clearTimeout(pendingExpiryTimer);
    pendingExpiryTimer = null;
  }
};

const schedulePendingExpiry = () => {
  clearPendingExpiry();
  pendingExpiryTimer = window.setTimeout(() => {
    pending = null;
    pendingExpiryTimer = null;
  }, PENDING_NAV_TTL_MS);
};

const isInternalLink = (href: string | null): boolean =>
  !!href && (href.startsWith('/') || href.startsWith('#')) && !href.startsWith('//');

const captureClickStart = (event: MouseEvent) => {
  // Only primary-button, unmodified clicks navigate via react-router.
  if (event.defaultPrevented) return;
  if (event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

  const target = event.target as Element | null;
  const anchor = target?.closest('a[href]') as HTMLAnchorElement | null;
  if (!anchor) return;
  const href = anchor.getAttribute('href');
  if (!isInternalLink(href)) return;
  if (anchor.target && anchor.target !== '_self') return;

  pending = {
    start: performance.now(),
    fromPath: window.location.pathname,
    toPath: href,
  };
  schedulePendingExpiry();
};

const capturePopStateStart = () => {
  pending = {
    start: performance.now(),
    fromPath: window.location.pathname,
    toPath: null,
  };
  schedulePendingExpiry();
};

let installed = false;
const installCaptureListeners = () => {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  document.addEventListener('click', captureClickStart, { capture: true });
  window.addEventListener('popstate', capturePopStateStart);
};

/**
 * Pulls the most recent pending navigation (if any) and clears it. Called by
 * RouteTransitionProfiler after the new route commits.
 */
export const consumePendingNavigation = (): PendingNav | null => {
  installCaptureListeners();
  const nav = pending;
  pending = null;
  clearPendingExpiry();
  // Drop no-op navigations (same-path clicks) so they don't attach to the
  // next real transition.
  if (nav && nav.fromPath === window.location.pathname) {
    return null;
  }
  return nav;
};

/**
 * Pages call this when their meaningful content is on screen. Emits a measure
 * from the originating gesture (if known) to the current frame.
 */
export const markRouteContentReady = (label: string): void => {
  const now = performance.now();
  const startMark = `route:start:${label}`;
  performance.mark(`route:content-ready:${label}`, { startTime: now });
  // If a measure-able start was recorded by the profiler, emit a full window.
  const entries = performance.getEntriesByName(startMark, 'mark');
  const start = entries.length > 0 ? entries[entries.length - 1].startTime : null;
  if (start != null) {
    try {
      performance.measure(`route:content-window:${label}`, {
        start,
        end: now,
      });
    } catch {
      // ignore — measure can throw if marks were cleared mid-flight
    }
  }
};

/**
 * Records a `route:start:<label>` mark when the profiler observes a commit.
 * Page code can later call `markRouteContentReady(label)` to close the window.
 */
export const recordRouteStartMark = (label: string, startTime: number): void => {
  try {
    performance.mark(`route:start:${label}`, { startTime });
  } catch {
    // ignore
  }
};
