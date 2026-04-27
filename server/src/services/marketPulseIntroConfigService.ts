import { MarketPulseIntroConfig } from '../models/MarketPulseIntroConfig.js';
import { LRUCache } from '../utils/lruCache.js';

const CACHE_KEY = 'market_pulse_intro_config';
const CACHE_TTL_MS = 60 * 1000; // 60 seconds
const cache = new LRUCache<MarketPulseIntroConfigData>(5, CACHE_TTL_MS);

export interface MarketPulseIntroConfigData {
  title: string;
  body: string;
  enabled: boolean;
}

const DEFAULTS: MarketPulseIntroConfigData = {
  title: 'Market Pulse',
  body: 'Daily stream of high-signal market updates and macro intelligence. Refreshed every day.',
  enabled: true
};

/**
 * Get effective Market Pulse intro config (cached).
 * Returns DB document if present, otherwise defaults.
 */
export async function getMarketPulseIntroConfig(): Promise<MarketPulseIntroConfigData> {
  const cached = cache.get(CACHE_KEY);
  if (cached) {
    return cached;
  }

  const doc = await MarketPulseIntroConfig.findOne({ id: 'default' }).lean();
  const config: MarketPulseIntroConfigData = doc
    ? {
        title: doc.title,
        body: doc.body,
        enabled: doc.enabled !== false
      }
    : { ...DEFAULTS };

  cache.set(CACHE_KEY, config);
  return config;
}

/**
 * Invalidate cache after admin updates config.
 */
export function invalidateMarketPulseIntroCache(): void {
  cache.delete(CACHE_KEY);
}

export { DEFAULTS };
