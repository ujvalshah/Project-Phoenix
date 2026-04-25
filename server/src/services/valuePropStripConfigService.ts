import { ValuePropStripConfig } from '../models/ValuePropStripConfig.js';
import { LRUCache } from '../utils/lruCache.js';

const CACHE_KEY = 'value_prop_strip_config';
const CACHE_TTL_MS = 60 * 1000; // 60 seconds
const cache = new LRUCache<ValuePropStripConfigData>(5, CACHE_TTL_MS);

export interface ValuePropStripConfigData {
  title: string;
  body: string;
}

const DEFAULTS: ValuePropStripConfigData = {
  title: 'Nuggets: The Knowledge App',
  body: 'Curated high-signal insights across Markets, Geopolitics, AI, and Tech. Save time — follow signal, not noise.'
};

/**
 * Get effective value-prop strip config (cached).
 * Returns DB document if present, otherwise defaults.
 */
export async function getValuePropStripConfig(): Promise<ValuePropStripConfigData> {
  const cached = cache.get(CACHE_KEY);
  if (cached) {
    return cached;
  }

  const doc = await ValuePropStripConfig.findOne({ id: 'default' }).lean();
  const config: ValuePropStripConfigData = doc
    ? {
        title: doc.title,
        body: doc.body
      }
    : { ...DEFAULTS };

  cache.set(CACHE_KEY, config);
  return config;
}

/**
 * Invalidate cache after admin updates config.
 */
export function invalidateValuePropStripCache(): void {
  cache.delete(CACHE_KEY);
}

export { DEFAULTS };
