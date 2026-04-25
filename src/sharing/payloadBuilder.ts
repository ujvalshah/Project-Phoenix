import type { ShareItemData, ShareMeta, SharePayload } from './types';

function compact(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

/**
 * Build concise cross-platform share payload text.
 * Keep copy simple; previews come from OG/Twitter metadata on destination pages.
 */
export function buildBaseSharePayload(
  data: ShareItemData,
  meta?: ShareMeta,
): SharePayload {
  const title = (data.title || '').trim();
  const excerpt = (meta?.text || '').trim();

  const lines: string[] = [];
  if (title) lines.push(compact(title, 120));
  if (excerpt) lines.push(compact(excerpt, 160));

  return {
    title: title || 'Nuggets',
    text: lines.join('\n\n'),
    url: data.shareUrl,
  };
}

/**
 * X/Twitter has a 280-char constraint including URL length accounting.
 * Keep share text concise and leave room for URL expansion.
 */
export function buildXShareText(payload: SharePayload): string {
  const base = payload.text || payload.title || 'Nuggets';
  return compact(base.replace(/\s+/g, ' ').trim(), 220);
}

