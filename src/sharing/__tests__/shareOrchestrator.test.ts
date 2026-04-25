import { beforeEach, describe, expect, it, vi } from 'vitest';
import { shareWithFallback } from '@/sharing/shareOrchestrator';

describe('sharing/shareOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns native_success when navigator.share succeeds', async () => {
    Object.defineProperty(global.navigator, 'share', {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });

    const outcome = await shareWithFallback({
      title: 'Title',
      text: 'Text',
      url: 'https://nuggets.one/article/a1',
    });

    expect(outcome).toEqual({ status: 'native_success', method: 'native' });
  });

  it('returns native_cancelled on AbortError', async () => {
    Object.defineProperty(global.navigator, 'share', {
      configurable: true,
      value: vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError')),
    });

    const outcome = await shareWithFallback({
      title: 'Title',
      text: 'Text',
      url: 'https://nuggets.one/article/a1',
    });

    expect(outcome).toEqual({ status: 'native_cancelled', method: 'native' });
  });

  it('falls back to copy when native share fails', async () => {
    Object.defineProperty(global.navigator, 'share', {
      configurable: true,
      value: vi.fn().mockRejectedValue(new Error('Share failed')),
    });
    Object.defineProperty(global.navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });

    const outcome = await shareWithFallback({
      title: 'Title',
      text: 'Text',
      url: 'https://nuggets.one/article/a1',
    });

    expect(outcome).toEqual({ status: 'copy_success', method: 'copy' });
  });
});

