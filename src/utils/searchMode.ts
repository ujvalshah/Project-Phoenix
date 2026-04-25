import { FilterState } from '@/types';
import { MIN_RELEVANCE_SEARCH_LENGTH } from '@/utils/searchQuery';

export const SEARCH_MODE_OVERRIDE_STORAGE_KEY = 'nuggets.search.mode.override';
export const SEARCH_COHORT_STORAGE_KEY = 'nuggets.search.cohort';
const SEARCH_BUCKET_ID_KEY = 'nuggets.search.bucket.id';

type CommittedSearchMode = Exclude<FilterState['searchMode'], 'latest'>;

function parseBooleanEnv(value: string | undefined): boolean {
  return value === '1' || value === 'true';
}

function parseRolloutPercentEnv(value: string | undefined): number {
  const n = Number(value ?? '0');
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function hashToBucket(value: string): number {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) + hash) + value.charCodeAt(i);
  }
  return Math.abs(hash) % 100;
}

function getSearchModeOverride(): CommittedSearchMode | null {
  if (typeof window === 'undefined') return null;
  const fromUrl = new URLSearchParams(window.location.search).get('searchMode');
  if (fromUrl === 'hybrid' || fromUrl === 'relevance') return fromUrl;

  const fromStorage = window.localStorage.getItem(SEARCH_MODE_OVERRIDE_STORAGE_KEY);
  if (fromStorage === 'hybrid' || fromStorage === 'relevance') return fromStorage;
  return null;
}

function getBucketId(): string {
  if (typeof window === 'undefined') return 'server';
  const existing = window.localStorage.getItem(SEARCH_BUCKET_ID_KEY);
  if (existing && existing.trim()) return existing;
  const created = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(SEARCH_BUCKET_ID_KEY, created);
  return created;
}

function isHybridEnabledForCohort(): boolean {
  const envEnabled = parseBooleanEnv(import.meta.env.VITE_SEARCH_HYBRID_ENABLED);
  const rolloutPercent = parseRolloutPercentEnv(import.meta.env.VITE_SEARCH_HYBRID_ROLLOUT_PERCENT);
  const allowlistRaw = String(import.meta.env.VITE_SEARCH_HYBRID_COHORTS || '').trim();
  const allowlist = new Set(
    allowlistRaw
      .split(',')
      .map((token) => token.trim())
      .filter(Boolean),
  );

  if (typeof window === 'undefined') {
    return envEnabled;
  }

  if (envEnabled) return true;

  const cohort = window.localStorage.getItem(SEARCH_COHORT_STORAGE_KEY);
  if (cohort && allowlist.has(cohort)) {
    return true;
  }

  if (rolloutPercent > 0) {
    return hashToBucket(getBucketId()) < rolloutPercent;
  }

  return false;
}

/**
 * Chooses committed search mode:
 * - short queries: no mode (legacy behavior)
 * - default: relevance
 * - hybrid when explicitly enabled for selected cohort
 */
export function resolveCommittedSearchMode(normalizedQuery: string): FilterState['searchMode'] {
  if (normalizedQuery.length < MIN_RELEVANCE_SEARCH_LENGTH) {
    return undefined;
  }

  const override = getSearchModeOverride();
  if (override) return override;

  return isHybridEnabledForCohort() ? 'hybrid' : 'relevance';
}

