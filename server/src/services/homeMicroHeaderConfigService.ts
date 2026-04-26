import { HomeMicroHeaderConfig } from '../models/HomeMicroHeaderConfig.js';
import { LRUCache } from '../utils/lruCache.js';

const CACHE_KEY = 'home_micro_header_config';
const CACHE_TTL_MS = 60 * 1000; // 60 seconds
const cache = new LRUCache<HomeMicroHeaderConfigData>(5, CACHE_TTL_MS);

export interface HomeMicroHeaderConfigData {
  title: string;
  body: string;
}

const DEFAULTS: HomeMicroHeaderConfigData = {
  title: 'Nuggets is a curated knowledge feed for markets, AI, technology, and geopolitics.',
  body: 'High-signal updates, organized without the noise.'
};

/**
 * Get effective home micro-header config (cached).
 * Returns DB document if present, otherwise defaults.
 */
export async function getHomeMicroHeaderConfig(): Promise<HomeMicroHeaderConfigData> {
  const cached = cache.get(CACHE_KEY);
  if (cached) {
    return cached;
  }

  const doc = await HomeMicroHeaderConfig.findOne({ id: 'default' }).lean();
  const config: HomeMicroHeaderConfigData = doc
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
export function invalidateHomeMicroHeaderCache(): void {
  cache.delete(CACHE_KEY);
}

export { DEFAULTS };
