import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * “Cold” = first `loadCreateNuggetModalModule()` in a process creates the shared import() promise.
 * “Warm” = every subsequent call reuses the same promise (no duplicate in-flight work).
 */
describe('createNuggetModalChunk shared promise (cold vs warm)', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('reuses the same module promise on repeated loadCreateNuggetModalModule calls (warm path)', async () => {
    const { loadCreateNuggetModalModule } = await import('../createNuggetModalChunk');
    const a = loadCreateNuggetModalModule();
    const b = loadCreateNuggetModalModule();
    expect(a).toBe(b);
  });

  it('after resetModules, a fresh import still dedupes within the new instance', async () => {
    const m = await import('../createNuggetModalChunk');
    const first = m.loadCreateNuggetModalModule();
    expect(m.loadCreateNuggetModalModule()).toBe(first);
  });
});
