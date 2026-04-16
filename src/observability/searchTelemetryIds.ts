/**
 * Correlates search analytics across a browser tab session (searchSessionId)
 * and a single search funnel (searchQueryId).
 *
 * - Active draft id: used while typing / suggesting before a commit.
 * - Committed id: snapshot at explicit submit; reused for request / results / zero / click.
 */

const SESSION_STORAGE_KEY = 'nuggets_search_session_v1';

/** Used when sessionStorage is unavailable or throws (private mode, quota, SSR quirks). */
let memoryFallbackSearchSessionId: string | null = null;

let activeSearchQueryId: string | null = null;
let committedSearchQueryId: string | null = null;

/** Suggestion article id set immediately before commit from a suggestion row (desktop/mobile). */
let pendingSuggestionArticleId: string | null = null;

function getMemoryFallbackSearchSessionId(): string {
  if (!memoryFallbackSearchSessionId) {
    memoryFallbackSearchSessionId = `sns_mem_${crypto.randomUUID()}`;
  }
  return memoryFallbackSearchSessionId;
}

/**
 * Stable per-tab session id for analytics correlation. Prefers sessionStorage;
 * never throws — falls back to an in-memory id for the lifetime of the page.
 */
export function getSearchSessionId(): string {
  if (typeof window === 'undefined') {
    return 'ssr';
  }
  try {
    const storage = window.sessionStorage;
    if (!storage) {
      return getMemoryFallbackSearchSessionId();
    }
    let id = storage.getItem(SESSION_STORAGE_KEY);
    if (!id) {
      id = `sns_${crypto.randomUUID()}`;
      storage.setItem(SESSION_STORAGE_KEY, id);
    }
    return id;
  } catch {
    return getMemoryFallbackSearchSessionId();
  }
}

export function ensureActiveSearchQueryId(): string {
  if (!activeSearchQueryId) {
    activeSearchQueryId = `sq_${crypto.randomUUID()}`;
  }
  return activeSearchQueryId;
}

/** Starts a new draft trace (e.g. opening mobile search or the compact desktop trigger). */
export function forceNewSearchQueryId(): string {
  activeSearchQueryId = `sq_${crypto.randomUUID()}`;
  return activeSearchQueryId;
}

export function peekActiveSearchQueryId(): string | null {
  return activeSearchQueryId;
}

/** Called on explicit submit — ties draft + results to one id. */
export function markSearchCommitted(): string {
  const id = ensureActiveSearchQueryId();
  committedSearchQueryId = id;
  return id;
}

export function getCommittedSearchQueryId(): string | null {
  return committedSearchQueryId;
}

/** After results settle, allow a new draft id on the next keystroke while keeping committed for clicks. */
export function endActiveSearchDraft(): void {
  activeSearchQueryId = null;
}

export function resetSearchTelemetryForAbandon(): void {
  activeSearchQueryId = null;
  committedSearchQueryId = null;
}

export function setPendingSuggestionArticleId(id: string | null): void {
  pendingSuggestionArticleId = id;
}

export function takePendingSuggestionArticleId(): string | null {
  const v = pendingSuggestionArticleId;
  pendingSuggestionArticleId = null;
  return v;
}
