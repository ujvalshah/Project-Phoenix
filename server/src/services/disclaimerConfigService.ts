import { DisclaimerConfig } from '../models/DisclaimerConfig.js';
import { LRUCache } from '../utils/lruCache.js';

const CACHE_KEY = 'disclaimer_config';
const CACHE_TTL_MS = 60 * 1000; // 60 seconds
const cache = new LRUCache<DisclaimerConfigData>(5, CACHE_TTL_MS);

export interface DisclaimerConfigData {
  defaultText: string;
  enableByDefault: boolean;
}

const DEFAULTS: DisclaimerConfigData = {
  defaultText: 'This content is sourced from across the web and may be summarized or adapted. For full context, refer to the original source.',
  enableByDefault: true
};

/**
 * Get effective disclaimer config (cached).
 * Returns DB document if present, otherwise defaults.
 */
export async function getDisclaimerConfig(): Promise<DisclaimerConfigData> {
  const cached = cache.get(CACHE_KEY);
  if (cached) {
    return cached;
  }

  const doc = await DisclaimerConfig.findOne({ id: 'default' }).lean();
  const config: DisclaimerConfigData = doc
    ? {
        defaultText: doc.defaultText,
        enableByDefault: doc.enableByDefault
      }
    : { ...DEFAULTS };

  cache.set(CACHE_KEY, config);
  return config;
}

/**
 * Invalidate cache after admin updates config.
 */
export function invalidateDisclaimerCache(): void {
  cache.delete(CACHE_KEY);
}

export { DEFAULTS };
