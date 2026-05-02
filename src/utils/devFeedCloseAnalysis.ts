/**
 * TEMPORARY dev-only instrumentation for desktop drawer-close → feed rerender diagnosis.
 * Delete this file and all imports after profiling.
 */

export const stats = {
  measureEffectRuns: 0,
  newsCardRenders: 0,
  bookmarkRenders: 0,
  bookmarkMounts: 0,
  memoMismatchCount: 0,
};

let windowEndMs = 0;
/** First memo mismatch field logged once per window (avoids spam). */
let firstMemoMismatchLogged: string | null = null;

function resetStats(): void {
  stats.measureEffectRuns = 0;
  stats.newsCardRenders = 0;
  stats.bookmarkRenders = 0;
  stats.bookmarkMounts = 0;
  stats.memoMismatchCount = 0;
  firstMemoMismatchLogged = null;
}

/** Start analysis window (call from HomeArticleFeed handleDrawerClose). */
export function beginFeedCloseAnalysisWindow(durationMs = 1200): void {
  if (!import.meta.env.DEV) return;
  resetStats();
  windowEndMs = performance.now() + durationMs;
  setTimeout(() => {
    console.log('[feed-close-instrument] summary', { ...stats });
  }, durationMs + 50);
}

export function isFeedCloseAnalysisWindowActive(): boolean {
  return import.meta.env.DEV && performance.now() < windowEndMs;
}

export function recordMeasureEffect(): void {
  if (!import.meta.env.DEV || !isFeedCloseAnalysisWindowActive()) return;
  stats.measureEffectRuns++;
}

export function recordNewsCardRender(): void {
  if (!import.meta.env.DEV || !isFeedCloseAnalysisWindowActive()) return;
  stats.newsCardRenders++;
}

export function recordBookmarkRender(): void {
  if (!import.meta.env.DEV || !isFeedCloseAnalysisWindowActive()) return;
  stats.bookmarkRenders++;
}

export function recordBookmarkMount(): void {
  if (!import.meta.env.DEV || !isFeedCloseAnalysisWindowActive()) return;
  stats.bookmarkMounts++;
}

/** Log first differing prop name once per window (memo comparator). */
export function recordNewsCardMemoMismatch(field: string): void {
  if (!import.meta.env.DEV || !isFeedCloseAnalysisWindowActive()) return;
  stats.memoMismatchCount++;
  if (firstMemoMismatchLogged === null) {
    firstMemoMismatchLogged = field;
    console.warn('[feed-close-instrument] first NewsCard memo inequality (field):', field);
  }
}
