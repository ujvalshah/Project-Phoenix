import { describe, expect, it } from 'vitest';
import {
  dedupeUrlsByNormalized,
  normalizeUrlForComparison,
  toFinalValidatedUrl,
} from '@/utils/composerUrlNormalization';

const HTTP_PREFIX_RE = /^https?:\/\//i;

function legacyNormalizeForComparison(url: string): string {
  let normalized = url.toLowerCase().trim();
  if (!HTTP_PREFIX_RE.test(normalized)) {
    normalized = `https://${normalized}`;
  }
  return normalized;
}

function legacyToFinalUrl(rawInput: string): string {
  const trimmed = rawInput.trim();
  const withProtocol = HTTP_PREFIX_RE.test(trimmed) ? trimmed : `https://${trimmed}`;
  new URL(withProtocol);
  return HTTP_PREFIX_RE.test(trimmed) ? trimmed : withProtocol;
}

function legacyDedupeAgainstExisting(
  candidateUrls: string[],
  existingUrls: string[],
  extraExistingUrls: string[] = [],
): string[] {
  const normalizedExisting = new Set(
    [...existingUrls, ...extraExistingUrls].map((url) => legacyNormalizeForComparison(url)),
  );

  const unique: string[] = [];
  for (const candidate of candidateUrls) {
    const normalized = legacyNormalizeForComparison(candidate);
    if (normalizedExisting.has(normalized)) continue;
    normalizedExisting.add(normalized);
    unique.push(candidate);
  }
  return unique;
}

describe('Nugget composer URL behavior contract (pre-extraction)', () => {
  it('normalizes protocol, case, and whitespace for duplicate comparison', () => {
    expect(legacyNormalizeForComparison(' Example.COM/Path ')).toBe('https://example.com/path');
    expect(legacyNormalizeForComparison('HTTP://Example.COM')).toBe('http://example.com');
  });

  it('single-add path keeps explicit protocol and auto-adds missing protocol', () => {
    expect(legacyToFinalUrl('example.com/article')).toBe('https://example.com/article');
    expect(legacyToFinalUrl('http://example.com/article')).toBe('http://example.com/article');
  });

  it('dedupes multi-add candidates against existing URLs (case-insensitive)', () => {
    const unique = legacyDedupeAgainstExisting(
      ['HTTPS://Example.com/A', 'example.com/b'],
      ['https://example.com/a'],
    );
    expect(unique).toEqual(['example.com/b']);
  });

  it('dedupes single-add candidate against existing edit images', () => {
    const unique = legacyDedupeAgainstExisting(
      ['Example.com/a'],
      ['https://example.com/z'],
      ['https://example.com/a'],
    );
    expect(unique).toEqual([]);
  });

  it('dedupes paste multi-url candidates against current URL list', () => {
    const unique = legacyDedupeAgainstExisting(
      ['example.com/one', 'https://example.com/two', 'EXAMPLE.COM/ONE'],
      ['https://example.com/one'],
    );
    expect(unique).toEqual(['https://example.com/two']);
  });

  it('does not mark genuinely distinct URLs as duplicates', () => {
    const unique = legacyDedupeAgainstExisting(
      ['https://example.com/a?x=1', 'https://example.com/a?x=2'],
      [],
    );
    expect(unique).toEqual(['https://example.com/a?x=1', 'https://example.com/a?x=2']);
  });
});

describe('Nugget composer URL helper parity', () => {
  it('matches legacy normalization behavior', () => {
    const input = ' Example.COM/Path ';
    expect(normalizeUrlForComparison(input)).toBe(legacyNormalizeForComparison(input));
  });

  it('matches legacy single-add final URL behavior', () => {
    expect(toFinalValidatedUrl('example.com/article')).toBe(legacyToFinalUrl('example.com/article'));
    expect(toFinalValidatedUrl('http://example.com/article')).toBe(legacyToFinalUrl('http://example.com/article'));
  });

  it('matches legacy dedupe for multi-add and single-add checks', () => {
    const candidateUrls = ['HTTPS://Example.com/A', 'example.com/b', 'EXAMPLE.COM/B'];
    const existingUrls = ['https://example.com/a'];
    const extraExistingUrls = ['https://example.com/c'];

    expect(
      dedupeUrlsByNormalized(candidateUrls, existingUrls, {
        extraExistingUrls,
      }),
    ).toEqual(legacyDedupeAgainstExisting(candidateUrls, existingUrls, extraExistingUrls));
  });

  it('supports paste-path semantics where existing URLs are compared without protocol coercion', () => {
    const pasted = ['example.com/new', 'https://example.com/already-there'];
    const existing = ['https://example.com/already-there'];
    expect(
      dedupeUrlsByNormalized(pasted, existing, {
        existingOptions: { addProtocolIfMissing: false },
      }),
    ).toEqual(['example.com/new']);
  });
});
