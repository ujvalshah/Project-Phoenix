import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { shareWithFallback } from '@/sharing/shareOrchestrator';

const ORIGINAL_USER_AGENT = navigator.userAgent;

describe('sharing/shareOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(global.navigator, 'userAgent', {
      configurable: true,
      value: ORIGINAL_USER_AGENT,
    });
  });

  it('returns native_success when navigator.share succeeds', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(global.navigator, 'share', { configurable: true, value: share });

    const outcome = await shareWithFallback({
      title: 'Title',
      text: 'Text',
      url: 'https://nuggets.one/article/a1',
    });

    expect(outcome).toEqual({ status: 'native_success', method: 'native' });
    expect(share).toHaveBeenCalledWith({
      title: 'Title',
      text: 'Text',
      url: 'https://nuggets.one/article/a1',
    });
  });

  it('omits title from navigator.share payload when payload.title is undefined', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(global.navigator, 'share', { configurable: true, value: share });

    const outcome = await shareWithFallback({
      text: 'Text',
      url: 'https://nuggets.one/article/a1',
    });

    expect(outcome).toEqual({ status: 'native_success', method: 'native' });
    expect(share).toHaveBeenCalledWith({
      text: 'Text',
      url: 'https://nuggets.one/article/a1',
    });
    // Critical: the payload must not contain a `title` key, not even as undefined.
    const arg = share.mock.calls[0][0];
    expect(Object.prototype.hasOwnProperty.call(arg, 'title')).toBe(false);
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

  it('returns native_failed when native share rejects with non-cancel error', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(global.navigator, 'share', {
      configurable: true,
      value: vi.fn().mockRejectedValue(new Error('Share failed')),
    });
    Object.defineProperty(global.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    const outcome = await shareWithFallback({
      title: 'Title',
      text: 'Text',
      url: 'https://nuggets.one/article/a1',
    });

    expect(outcome).toMatchObject({
      status: 'native_failed',
      method: 'native',
      errorName: 'Error',
      errorMessage: 'Share failed',
    });
    // Critical: must not silently auto-copy on native failure.
    expect(writeText).not.toHaveBeenCalled();
  });

  it('treats NotAllowedError with cancel-message as user cancellation', async () => {
    Object.defineProperty(global.navigator, 'share', {
      configurable: true,
      value: vi
        .fn()
        .mockRejectedValue(new DOMException('The user cancelled', 'NotAllowedError')),
    });

    const outcome = await shareWithFallback({
      title: 'Title',
      text: 'Text',
      url: 'https://nuggets.one/article/a1',
    });

    expect(outcome).toEqual({ status: 'native_cancelled', method: 'native' });
  });

  it('skips native share when canShare rejects the payload, falls back to copy', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const canShare = vi.fn().mockReturnValue(false);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(global.navigator, 'share', { configurable: true, value: share });
    Object.defineProperty(global.navigator, 'canShare', { configurable: true, value: canShare });
    Object.defineProperty(global.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    const outcome = await shareWithFallback({
      title: 'Title',
      text: 'Text',
      url: 'https://nuggets.one/article/a1',
    });

    expect(canShare).toHaveBeenCalled();
    expect(share).not.toHaveBeenCalled();
    expect(writeText).toHaveBeenCalled();
    expect(outcome).toEqual({ status: 'copy_success', method: 'copy' });
  });

  it('falls back to copy when native share is unavailable', async () => {
    Object.defineProperty(global.navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(global.navigator, 'canShare', { configurable: true, value: undefined });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(global.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    const outcome = await shareWithFallback({
      title: 'Title',
      text: 'Text',
      url: 'https://nuggets.one/article/a1',
    });

    expect(writeText).toHaveBeenCalled();
    expect(outcome).toEqual({ status: 'copy_success', method: 'copy' });
  });

  it('uses execCommand textarea fallback when navigator.clipboard is missing', async () => {
    Object.defineProperty(global.navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(global.navigator, 'canShare', { configurable: true, value: undefined });
    Object.defineProperty(global.navigator, 'clipboard', { configurable: true, value: undefined });
    const execSpy = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execSpy });

    const outcome = await shareWithFallback({
      title: 'Title',
      text: 'Text',
      url: 'https://nuggets.one/article/a1',
    });

    expect(execSpy).toHaveBeenCalledWith('copy');
    expect(outcome).toEqual({ status: 'copy_success', method: 'copy' });
    // Cleanup invariant: the fallback textarea must not leak into the DOM.
    expect(document.querySelectorAll('textarea').length).toBe(0);

    Object.defineProperty(document, 'execCommand', { configurable: true, value: undefined });
  });

  it('uses execCommand textarea fallback when navigator.clipboard.writeText rejects', async () => {
    Object.defineProperty(global.navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(global.navigator, 'canShare', { configurable: true, value: undefined });
    Object.defineProperty(global.navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('not allowed')) },
    });
    const execSpy = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execSpy });

    const outcome = await shareWithFallback({
      title: 'Title',
      text: 'Text',
      url: 'https://nuggets.one/article/a1',
    });

    expect(execSpy).toHaveBeenCalledWith('copy');
    expect(outcome).toEqual({ status: 'copy_success', method: 'copy' });

    Object.defineProperty(document, 'execCommand', { configurable: true, value: undefined });
  });

  it('skips native share inside Instagram IAB and falls back to copy', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const canShare = vi.fn().mockReturnValue(true);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(global.navigator, 'share', { configurable: true, value: share });
    Object.defineProperty(global.navigator, 'canShare', { configurable: true, value: canShare });
    Object.defineProperty(global.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    Object.defineProperty(global.navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) Instagram 320.0.0.0',
    });

    const outcome = await shareWithFallback({
      title: 'Title',
      text: 'Text',
      url: 'https://nuggets.one/article/a1',
    });

    expect(share).not.toHaveBeenCalled();
    expect(writeText).toHaveBeenCalled();
    expect(outcome).toEqual({ status: 'copy_success', method: 'copy' });
  });

  it('returns copy_failed when both clipboard paths fail', async () => {
    Object.defineProperty(global.navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(global.navigator, 'canShare', { configurable: true, value: undefined });
    Object.defineProperty(global.navigator, 'clipboard', { configurable: true, value: undefined });
    const execSpy = vi.fn().mockReturnValue(false);
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execSpy });

    const outcome = await shareWithFallback({
      title: 'Title',
      text: 'Text',
      url: 'https://nuggets.one/article/a1',
    });

    expect(outcome).toEqual({ status: 'copy_failed', method: 'copy' });

    Object.defineProperty(document, 'execCommand', { configurable: true, value: undefined });
  });
});

