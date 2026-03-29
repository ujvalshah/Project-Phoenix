import { describe, expect, it } from 'vitest';
import {
  isImageUrl,
  looksLikeMultipleUrls,
  splitPastedUrlCandidates,
} from './urlUtils';

const SUBSTACK_IMGPROXY =
  'https://substackcdn.com/image/fetch/$s_!NJBe!,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F00bf09f1-e9b6-474a-b63f-6b638428d8e9_1776x1184.png';

const OUR_WORLD_IN_DATA_IMAGEDL =
  'https://ourworldindata.org/cdn-cgi/imagedelivery/qLq-8BTgXU8yG0N6HnOy8g/7c1b6c37-775b-4326-3bed-48a44e647f00/w=1350';

describe('splitPastedUrlCandidates', () => {
  it('keeps a single Substack imgproxy URL intact (commas in path)', () => {
    expect(splitPastedUrlCandidates(SUBSTACK_IMGPROXY)).toEqual([SUBSTACK_IMGPROXY]);
  });

  it('splits two https URLs on one line separated by space', () => {
    const a = 'https://a.com/x.png';
    const b = 'https://b.com/y.png';
    expect(splitPastedUrlCandidates(`${a} ${b}`)).toEqual([a, b]);
  });

  it('splits comma-separated list when comma precedes another scheme', () => {
    const a = 'https://a.com/x.png';
    const b = 'https://b.com/y.png';
    expect(splitPastedUrlCandidates(`${a}, ${b}`)).toEqual([a, b]);
  });
});

describe('looksLikeMultipleUrls', () => {
  it('is false for a single URL with commas in the path', () => {
    expect(looksLikeMultipleUrls(SUBSTACK_IMGPROXY)).toBe(false);
  });

  it('is true when two schemes appear', () => {
    expect(
      looksLikeMultipleUrls('https://a.com/x.png https://b.com/y.png')
    ).toBe(true);
  });
});

describe('isImageUrl', () => {
  it('classifies Substack imgproxy PNG URLs as images', () => {
    expect(isImageUrl(SUBSTACK_IMGPROXY)).toBe(true);
  });

  it('classifies Cloudflare imagedelivery URLs as images', () => {
    expect(isImageUrl(OUR_WORLD_IN_DATA_IMAGEDL)).toBe(true);
  });
});
