import { MarketPulseMicroHeaderConfig } from '../models/MarketPulseMicroHeaderConfig.js';
import { LRUCache } from '../utils/lruCache.js';
const CACHE_KEY = 'market_pulse_micro_header_config';
const CACHE_TTL_MS = 60 * 1000; // 60 seconds
const cache = new LRUCache(5, CACHE_TTL_MS);
const DEFAULTS = {
    title: 'Market Pulse: high-signal updates for investors and operators',
    body: 'High-signal updates, organized without the noise.'
};
/**
 * Get effective Market Pulse micro-header config (cached).
 * Returns DB document if present, otherwise defaults.
 */
export async function getMarketPulseMicroHeaderConfig() {
    const cached = cache.get(CACHE_KEY);
    if (cached) {
        return cached;
    }
    const doc = await MarketPulseMicroHeaderConfig.findOne({ id: 'default' }).lean();
    const config = doc
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
export function invalidateMarketPulseMicroHeaderCache() {
    cache.delete(CACHE_KEY);
}
export { DEFAULTS };
//# sourceMappingURL=marketPulseMicroHeaderConfigService.js.map