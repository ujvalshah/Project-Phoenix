import type { Article, ExternalLink } from '@/types';
import { DEFAULT_LAYOUT_VISIBILITY } from '@/types';
import { isFeatureEnabled } from '@/constants/featureFlags';

export interface DuplicatePrefillPayload {
  article: Article;
  sourceUrls: string[];
}

function getDuplicateTitle(title: string | undefined): string | undefined {
  const trimmed = title?.trim();
  if (!trimmed) return title;
  if (!isFeatureEnabled('DUPLICATE_NUGGET_TITLE_SUFFIX')) return trimmed;
  if (/\(copy\)$/i.test(trimmed)) return trimmed;
  return `${trimmed} (Copy)`;
}

function normalizeUrlForDedup(url: string): string {
  return url.trim().toLowerCase();
}

function dedupeUrls(urls: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const candidate of urls) {
    if (!candidate || typeof candidate !== 'string') continue;
    const trimmed = candidate.trim();
    if (!trimmed) continue;
    const key = normalizeUrlForDedup(trimmed);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(trimmed);
  }

  return output;
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

function regenerateExternalLinks(links: ExternalLink[] | undefined): ExternalLink[] {
  if (!Array.isArray(links) || links.length === 0) return [];

  const now = new Date().toISOString();
  const dedupedLinks = dedupeUrls(links.map((l) => l.url));

  const originalByUrl = new Map<string, ExternalLink>();
  for (const link of links) {
    if (!link?.url) continue;
    const key = normalizeUrlForDedup(link.url);
    if (!originalByUrl.has(key)) {
      originalByUrl.set(key, link);
    }
  }

  const hydrated = dedupedLinks.map((url, index) => {
    const original = originalByUrl.get(normalizeUrlForDedup(url));
    return {
      id: `link-${Date.now()}-${index}`,
      url,
      label: original?.label,
      isPrimary: Boolean(original?.isPrimary),
      domain: original?.domain || getDomain(url),
      favicon: original?.favicon,
      addedAt: now,
    } satisfies ExternalLink;
  });

  if (!hydrated.some((l) => l.isPrimary) && hydrated.length > 0) {
    hydrated[0] = { ...hydrated[0], isPrimary: true };
  }

  return hydrated;
}

function collectSourceUrls(source: Article): string[] {
  return dedupeUrls([
    source.primaryMedia?.url,
    source.media?.previewMetadata?.url,
    source.media?.url,
    source.video,
    ...(source.supportingMedia?.map((item) => item.url) || []),
    ...(source.images || []),
  ]);
}

/**
 * Build safe duplicate prefill data.
 *
 * The result is intentionally NOT persistence-ready. It is used only to hydrate
 * create-mode UI state and must never carry identity/timestamp fields into create payloads.
 */
export function buildDuplicatePrefill(source: Article): DuplicatePrefillPayload {
  const sourceUrls = collectSourceUrls(source);
  const externalLinks = regenerateExternalLinks(source.externalLinks);

  const article: Article = {
    ...source,
    id: `duplicate-${source.id}-${Date.now()}`,
    title: getDuplicateTitle(source.title),
    status: 'draft',
    publishedAt: null,
    created_at: undefined,
    updated_at: undefined,
    engagement: undefined,
    mediaIds: undefined,
    displayImageIndex: undefined,
    customCreatedAt: undefined,
    isCustomCreatedAt: undefined,
    addedBy: undefined,
    displayAuthor: undefined,
    externalLinks,
    layoutVisibility: source.layoutVisibility || DEFAULT_LAYOUT_VISIBILITY,
  };

  return { article, sourceUrls };
}

