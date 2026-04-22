import { normalizeImageUrl } from '@/shared/articleNormalization/imageDedup';

export interface OrderedMediaLike {
  url?: string;
  order?: number;
  position?: number;
}

const LARGE_ORDER_FALLBACK = Number.MAX_SAFE_INTEGER;

function getNumericPosition(item: OrderedMediaLike): number {
  if (typeof item.position === 'number' && Number.isFinite(item.position)) {
    return item.position;
  }
  if (typeof item.order === 'number' && Number.isFinite(item.order)) {
    return item.order;
  }
  return LARGE_ORDER_FALLBACK;
}

export function normalizeMediaOrder<T extends OrderedMediaLike>(items: T[]): T[] {
  return [...items].sort((a, b) => getNumericPosition(a) - getNumericPosition(b));
}

export function reindexMediaPositions<T extends OrderedMediaLike>(items: T[]): T[] {
  return items.map((item, index) => ({
    ...item,
    position: index,
    order: index,
  }));
}

export function reorderImageUrlsByCanonicalMediaOrder(
  imageUrls: string[],
  mediaItems: Array<OrderedMediaLike & { type?: string; source?: string }>
): string[] {
  if (imageUrls.length <= 1 || mediaItems.length === 0) {
    return imageUrls;
  }

  const imagesByNormalizedUrl = new Map<string, string>();
  imageUrls.forEach((url) => {
    imagesByNormalizedUrl.set(normalizeImageUrl(url), url);
  });

  const orderedImageCandidates = mediaItems.filter(
    (item) => item.type === 'image' && typeof item.url === 'string' && item.url.length > 0
  );
  const orderedItems = normalizeMediaOrder(orderedImageCandidates);

  const reordered: string[] = [];
  const added = new Set<string>();

  orderedItems.forEach((item) => {
    const normalized = normalizeImageUrl(item.url as string);
    const original = imagesByNormalizedUrl.get(normalized);
    if (original && !added.has(normalized)) {
      reordered.push(original);
      added.add(normalized);
    }
  });

  imageUrls.forEach((url) => {
    const normalized = normalizeImageUrl(url);
    if (!added.has(normalized)) {
      reordered.push(url);
      added.add(normalized);
    }
  });

  return reordered;
}
