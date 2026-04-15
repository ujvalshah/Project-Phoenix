import type { Article } from '@/types';

function hostFromUrl(url: string): string | null {
  try {
    const h = new URL(url).hostname.replace(/^www\./, '');
    return h || null;
  } catch {
    return null;
  }
}

export function getNuggetSourceLabel(article: Article): string {
  const primaryLink = article.externalLinks?.find((l) => l.isPrimary);
  if (primaryLink?.domain?.trim()) return primaryLink.domain.trim();
  if (primaryLink?.url) {
    const h = hostFromUrl(primaryLink.url);
    if (h) return h;
  }
  const pm = article.primaryMedia?.previewMetadata ?? article.media?.previewMetadata;
  if (pm?.siteName?.trim()) return pm.siteName.trim();
  if (pm?.url) {
    const h = hostFromUrl(pm.url);
    if (h) return h;
  }
  if (pm?.providerName?.trim()) return pm.providerName.trim();
  const st = article.source_type?.trim();
  if (st) return st.replace(/_/g, ' ');
  return 'Nugget';
}

export function getNuggetPrimaryHref(article: Article): string | null {
  const primaryLink = article.externalLinks?.find((l) => l.isPrimary);
  if (primaryLink?.url) return primaryLink.url;
  const pm = article.primaryMedia?.previewMetadata ?? article.media?.previewMetadata;
  if (pm?.url) return pm.url;
  if (article.primaryMedia?.type === 'youtube') return article.primaryMedia.url;
  if (article.media?.type === 'youtube') return article.media.url;
  return null;
}
