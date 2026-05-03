import { MediaQuotaConfig } from '../models/MediaQuotaConfig.js';
import { LRUCache } from '../utils/lruCache.js';
const CACHE_KEY = 'media_quota_config';
const CACHE_TTL_MS = 60 * 1000; // 60 seconds
const cache = new LRUCache(5, CACHE_TTL_MS);
const DEFAULTS = {
    maxFilesPerUser: 1000,
    maxStorageBytes: 500 * 1024 * 1024, // 500 MB
    maxDailyUploads: 100
};
/**
 * Get effective media quota limits (cached).
 * Returns DB document if present, otherwise defaults.
 */
export async function getMediaQuotaConfig() {
    const cached = cache.get(CACHE_KEY);
    if (cached) {
        return cached;
    }
    const doc = await MediaQuotaConfig.findOne({ id: 'default' }).lean();
    const limits = doc
        ? {
            maxFilesPerUser: doc.maxFilesPerUser,
            maxStorageBytes: doc.maxStorageBytes,
            maxDailyUploads: doc.maxDailyUploads
        }
        : { ...DEFAULTS };
    cache.set(CACHE_KEY, limits);
    return limits;
}
/**
 * Invalidate cache after admin updates config (so next upload sees new limits).
 */
export function invalidateMediaQuotaCache() {
    cache.delete(CACHE_KEY);
}
export { DEFAULTS };
//# sourceMappingURL=mediaQuotaConfigService.js.map