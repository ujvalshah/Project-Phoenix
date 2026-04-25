import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveCommittedSearchMode } from '@/utils/searchMode';

describe('resolveCommittedSearchMode', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    localStorage.clear();
  });

  it('returns undefined for short queries', () => {
    expect(resolveCommittedSearchMode('ai')).toBeUndefined();
  });

  it('defaults to relevance when no hybrid flags are enabled', () => {
    vi.stubEnv('VITE_SEARCH_HYBRID_ENABLED', 'false');
    vi.stubEnv('VITE_SEARCH_HYBRID_ROLLOUT_PERCENT', '0');
    expect(resolveCommittedSearchMode('iconiq')).toBe('relevance');
  });

  it('uses hybrid when global env flag is enabled', () => {
    vi.stubEnv('VITE_SEARCH_HYBRID_ENABLED', 'true');
    expect(resolveCommittedSearchMode('iconiq')).toBe('hybrid');
  });

  it('uses hybrid when cohort allowlist matches local cohort key', () => {
    vi.stubEnv('VITE_SEARCH_HYBRID_ENABLED', 'false');
    vi.stubEnv('VITE_SEARCH_HYBRID_COHORTS', 'beta-search,internal');
    localStorage.setItem('nuggets.search.cohort', 'beta-search');
    expect(resolveCommittedSearchMode('iconiq')).toBe('hybrid');
  });

  it('respects runtime override from localStorage', () => {
    vi.stubEnv('VITE_SEARCH_HYBRID_ENABLED', 'false');
    localStorage.setItem('nuggets.search.mode.override', 'hybrid');
    expect(resolveCommittedSearchMode('iconiq')).toBe('hybrid');
  });
});

