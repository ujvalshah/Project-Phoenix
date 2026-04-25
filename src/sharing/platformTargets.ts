import { buildXShareText } from './payloadBuilder';
import type { SharePayload } from './types';

function encode(value: string): string {
  return encodeURIComponent(value);
}

export function buildWhatsAppIntent(payload: SharePayload): string {
  const textParts = [payload.text, payload.url].filter(Boolean);
  return `https://wa.me/?text=${encode(textParts.join('\n\n'))}`;
}

export function buildXIntent(payload: SharePayload): string {
  const params = new URLSearchParams({
    text: buildXShareText(payload),
    url: payload.url,
  });
  return `https://twitter.com/intent/tweet?${params.toString()}`;
}

/**
 * LinkedIn preview content is derived from OG metadata on the destination URL.
 * Keep intent to URL-only.
 */
export function buildLinkedInIntent(payload: SharePayload): string {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encode(payload.url)}`;
}

