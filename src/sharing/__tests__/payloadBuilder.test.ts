import { describe, expect, it } from 'vitest';
import { buildBaseSharePayload, buildXShareText } from '@/sharing/payloadBuilder';

describe('sharing/payloadBuilder', () => {
  it('omits title when source has no real title (no Android placeholder subject)', () => {
    const payload = buildBaseSharePayload(
      { type: 'nugget', id: 'a1', shareUrl: 'https://nuggets.one/article/a1' },
      { text: 'Some excerpt' },
    );
    expect(payload.title).toBeUndefined();
    expect(payload.url).toBe('https://nuggets.one/article/a1');
    expect(payload.text).toContain('Some excerpt');
  });

  it('preserves a real title', () => {
    const payload = buildBaseSharePayload(
      { type: 'nugget', id: 'a1', title: 'Real Title', shareUrl: 'https://nuggets.one/article/a1' },
      { text: 'excerpt' },
    );
    expect(payload.title).toBe('Real Title');
  });

  it('treats whitespace-only title as missing', () => {
    const payload = buildBaseSharePayload(
      { type: 'nugget', id: 'a1', title: '   ', shareUrl: 'https://nuggets.one/article/a1' },
    );
    expect(payload.title).toBeUndefined();
  });

  it('buildXShareText still falls back to a placeholder when text and title are empty', () => {
    // X / Twitter intent must always have *some* tweet text — empty-tweet
    // intents render as broken share dialogs.
    const text = buildXShareText({ text: '', url: 'https://nuggets.one/article/a1' });
    expect(text.length).toBeGreaterThan(0);
  });
});
