import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildArticleShareUrl,
  buildCanonicalShareUrl,
  buildCollectionShareUrl,
  getCanonicalSiteOrigin,
} from '@/sharing/urlBuilder';

describe('sharing/urlBuilder', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('prefers configured canonical origin when provided', () => {
    vi.stubEnv('VITE_PUBLIC_SITE_URL', 'https://nuggets.one/');

    expect(getCanonicalSiteOrigin()).toBe('https://nuggets.one');
    expect(buildCanonicalShareUrl('/article/abc')).toBe('https://nuggets.one/article/abc');
  });

  it('builds canonical article and collection urls', () => {
    vi.stubEnv('VITE_PUBLIC_SITE_URL', 'https://nuggets.one');

    expect(buildArticleShareUrl('a1')).toBe('https://nuggets.one/article/a1');
    expect(buildCollectionShareUrl('c1')).toBe('https://nuggets.one/collections/c1');
  });
});

