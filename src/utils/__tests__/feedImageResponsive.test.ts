import { describe, expect, it } from 'vitest';
import {
  FEED_IMAGE_SRCSET_WIDTHS,
  buildFeedImageResponsiveProps,
  cloudinaryImageUrlWithMaxDimension,
} from '@/utils/feedImageResponsive';

describe('feedImageResponsive', () => {
  const rawCloudinary =
    'https://res.cloudinary.com/demo/image/upload/v1698123456/folder/sample.jpg';

  it('builds srcset for raw Cloudinary image/upload URLs', () => {
    const r = buildFeedImageResponsiveProps(rawCloudinary);
    expect(r.usesResponsiveDerivatives).toBe(true);
    expect(r.srcSet).toBeTruthy();
    FEED_IMAGE_SRCSET_WIDTHS.forEach((w) => {
      expect(r.srcSet).toContain(`${w}w`);
      expect(r.srcSet).toContain(`w_${w},`);
    });
    expect(r.src).toContain('w_960,');
  });

  it('does not mutate URLs that already have a transformation chain after upload/', () => {
    const transformed =
      'https://res.cloudinary.com/demo/image/upload/w_800,c_fill,q_auto/sample.jpg';
    expect(cloudinaryImageUrlWithMaxDimension(transformed, 320)).toBeNull();
    const r = buildFeedImageResponsiveProps(transformed);
    expect(r.usesResponsiveDerivatives).toBe(false);
    expect(r.src).toBe(transformed);
    expect(r.srcSet).toBeUndefined();
  });

  it('falls back to plain src for non-Cloudinary feed URLs', () => {
    const yt = 'https://img.youtube.com/vi/abc123/hqdefault.jpg';
    const r = buildFeedImageResponsiveProps(yt);
    expect(r.usesResponsiveDerivatives).toBe(false);
    expect(r.src).toBe(yt);
    expect(r.srcSet).toBeUndefined();
  });

  it('does not treat image/fetch remote URLs as upload transforms', () => {
    const fetchRemote =
      'https://res.cloudinary.com/demo/image/fetch/https://example.com/a.jpg';
    const r = buildFeedImageResponsiveProps(fetchRemote);
    expect(r.usesResponsiveDerivatives).toBe(false);
    expect(r.src).toBe(fetchRemote);
  });
});
