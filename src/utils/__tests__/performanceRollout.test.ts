import { afterEach, describe, expect, it, vi } from 'vitest';
import { stableBucket0to99 } from '@/utils/performanceRollout';

describe('performanceRollout', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('stableBucket0to99 is deterministic for the same id', () => {
    const a = stableBucket0to99('user-123');
    const b = stableBucket0to99('user-123');
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(100);
  });

  it('disables modal preload when VITE_FEATURE_NUGGET_MODAL_CHUNK_PRELOAD=false', async () => {
    vi.stubEnv('VITE_FEATURE_NUGGET_MODAL_CHUNK_PRELOAD', 'false');
    vi.resetModules();
    const { shouldEnableNuggetModalPreloadForUser } = await import('@/utils/performanceRollout');
    expect(shouldEnableNuggetModalPreloadForUser('any-id')).toBe(false);
  });
});
