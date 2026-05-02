import { afterEach, describe, expect, it, vi } from 'vitest';

describe('VITE_NUGGET_COMPOSER_V2 rollout', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function loadPct(): Promise<number> {
    const { NUGGET_PERFORMANCE } = await import('@/config/nuggetPerformanceConfig');
    return NUGGET_PERFORMANCE.composerV2RolloutPercent;
  }

  it('treats unset / empty env as 0% (legacy only)', async () => {
    vi.stubEnv('VITE_NUGGET_COMPOSER_V2', '');
    vi.resetModules();
    expect(await loadPct()).toBe(0);
  });

  it('parses 0 and false as off', async () => {
    vi.stubEnv('VITE_NUGGET_COMPOSER_V2', '0');
    vi.resetModules();
    expect(await loadPct()).toBe(0);

    vi.stubEnv('VITE_NUGGET_COMPOSER_V2', 'false');
    vi.resetModules();
    expect(await loadPct()).toBe(0);
  });

  it('parses 1, true, and 100 as full rollout', async () => {
    vi.stubEnv('VITE_NUGGET_COMPOSER_V2', '1');
    vi.resetModules();
    expect(await loadPct()).toBe(100);

    vi.stubEnv('VITE_NUGGET_COMPOSER_V2', 'true');
    vi.resetModules();
    expect(await loadPct()).toBe(100);

    vi.stubEnv('VITE_NUGGET_COMPOSER_V2', '100');
    vi.resetModules();
    expect(await loadPct()).toBe(100);
  });

  it('parses 0.01 as 1%', async () => {
    vi.stubEnv('VITE_NUGGET_COMPOSER_V2', '0.01');
    vi.resetModules();
    expect(await loadPct()).toBe(1);
  });

  it('parses 0.1 as 10%', async () => {
    vi.stubEnv('VITE_NUGGET_COMPOSER_V2', '0.1');
    vi.resetModules();
    expect(await loadPct()).toBe(10);
  });

  it('parses 10 as 10%', async () => {
    vi.stubEnv('VITE_NUGGET_COMPOSER_V2', '10');
    vi.resetModules();
    expect(await loadPct()).toBe(10);
  });

  it('shouldEnableNuggetComposerV2ForUser is false at 0%', async () => {
    vi.stubEnv('VITE_NUGGET_COMPOSER_V2', '0');
    vi.resetModules();
    const { shouldEnableNuggetComposerV2ForUser } = await import('@/utils/performanceRollout');
    expect(shouldEnableNuggetComposerV2ForUser('any-user')).toBe(false);
  });

  it('shouldEnableNuggetComposerV2ForUser is false when env empty (safe default)', async () => {
    vi.stubEnv('VITE_NUGGET_COMPOSER_V2', '');
    vi.resetModules();
    const { shouldEnableNuggetComposerV2ForUser } = await import('@/utils/performanceRollout');
    expect(shouldEnableNuggetComposerV2ForUser('any-user')).toBe(false);
  });

  it('shouldEnableNuggetComposerV2ForUser is true at 100%', async () => {
    vi.stubEnv('VITE_NUGGET_COMPOSER_V2', '1');
    vi.resetModules();
    const { shouldEnableNuggetComposerV2ForUser } = await import('@/utils/performanceRollout');
    expect(shouldEnableNuggetComposerV2ForUser('any-user')).toBe(true);
  });
});
