/**
 * Helpers for Redis-backed GET JSON response caches (public read paths only).
 *
 * Bypass auth/mutation upstream — callers must enforce policy before invoking.
 */
import { getLogger } from '../utils/logger.js';
import { buildApiCacheKey, getOrSetCachedJsonWithDisposition, } from '../services/apiResponseCacheService.js';
export const PUBLIC_READ_RESPONSE_CACHE_HEADER = 'x-public-read-cache';
export async function sendJsonViaPublicReadRedisCache(opts) {
    const requestIdStr = typeof opts.req.id === 'string' || typeof opts.req.id === 'number'
        ? String(opts.req.id)
        : undefined;
    const logFields = {
        route: opts.routeLabel,
        requestId: requestIdStr,
        namespace: opts.namespace,
        cacheLayer: 'public_read_redis_mw',
    };
    const bypass = opts.bypass ?? false;
    if (bypass) {
        getLogger().debug({
            msg: '[PublicReadRedisCache] bypass',
            reasonCode: opts.bypassReason ?? 'explicit',
            ...logFields,
        });
        const body = await opts.loader();
        opts.res.setHeader(PUBLIC_READ_RESPONSE_CACHE_HEADER, 'BYPASS');
        opts.res.json(body);
        return;
    }
    const key = buildApiCacheKey(opts.namespace, [...opts.keyParts]);
    const { data, fromCache } = await getOrSetCachedJsonWithDisposition(key, opts.ttlSeconds, opts.loader, {
        route: opts.routeLabel,
        namespace: opts.namespace,
        requestId: requestIdStr,
    });
    opts.res.setHeader(PUBLIC_READ_RESPONSE_CACHE_HEADER, fromCache ? 'HIT' : 'MISS');
    opts.res.json(data);
}
//# sourceMappingURL=publicReadRedisCache.js.map