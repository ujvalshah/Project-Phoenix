import { describe, expect, it } from 'vitest';
import { buildBaseSharePayload } from '@/sharing/payloadBuilder';
import {
  buildLinkedInIntent,
  buildWhatsAppIntent,
  buildXIntent,
} from '@/sharing/platformTargets';

describe('sharing/platformTargets', () => {
  const payload = buildBaseSharePayload(
    {
      type: 'nugget',
      id: 'a1',
      title: 'A concise title',
      shareUrl: 'https://nuggets.one/article/a1',
    },
    { text: 'Short context for sharing' },
  );

  it('builds simple WhatsApp intent payload', () => {
    const url = buildWhatsAppIntent(payload);
    expect(url).toContain('https://wa.me/?text=');
    expect(decodeURIComponent(url.split('text=')[1])).toContain('https://nuggets.one/article/a1');
  });

  it('builds encoded concise X intent payload', () => {
    const url = buildXIntent(payload);
    expect(url).toContain('https://twitter.com/intent/tweet?');
    expect(url).toContain('url=https%3A%2F%2Fnuggets.one%2Farticle%2Fa1');
    expect(url).toContain('text=');
  });

  it('builds LinkedIn URL-only offsite intent', () => {
    const url = buildLinkedInIntent(payload);
    expect(url).toBe(
      'https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fnuggets.one%2Farticle%2Fa1',
    );
  });
});

