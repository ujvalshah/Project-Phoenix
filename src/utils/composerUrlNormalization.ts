export interface UrlNormalizationOptions {
  addProtocolIfMissing?: boolean;
}

const HTTP_PREFIX_RE = /^https?:\/\//i;

function ensureHttpProtocol(url: string): string {
  return HTTP_PREFIX_RE.test(url) ? url : `https://${url}`;
}

export function normalizeUrlForComparison(
  url: string,
  options: UrlNormalizationOptions = {},
): string {
  const { addProtocolIfMissing = true } = options;
  let normalized = url.toLowerCase().trim();
  if (addProtocolIfMissing) {
    normalized = ensureHttpProtocol(normalized);
  }
  return normalized;
}

export function buildNormalizedUrlSet(
  urls: string[],
  options: UrlNormalizationOptions = {},
): Set<string> {
  const normalized = new Set<string>();
  for (const url of urls) {
    normalized.add(normalizeUrlForComparison(url, options));
  }
  return normalized;
}

export interface DedupeUrlOptions {
  existingOptions?: UrlNormalizationOptions;
  candidateOptions?: UrlNormalizationOptions;
  extraExistingUrls?: string[];
}

export function dedupeUrlsByNormalized(
  candidateUrls: string[],
  existingUrls: string[],
  options: DedupeUrlOptions = {},
): string[] {
  const {
    existingOptions = {},
    candidateOptions = {},
    extraExistingUrls = [],
  } = options;

  const seen = buildNormalizedUrlSet(
    [...existingUrls, ...extraExistingUrls],
    existingOptions,
  );

  const unique: string[] = [];
  for (const candidate of candidateUrls) {
    const normalized = normalizeUrlForComparison(candidate, candidateOptions);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(candidate);
  }
  return unique;
}

export function toFinalValidatedUrl(input: string): string {
  const trimmed = input.trim();
  const withProtocol = ensureHttpProtocol(trimmed);
  new URL(withProtocol);
  return HTTP_PREFIX_RE.test(trimmed) ? trimmed : withProtocol;
}
