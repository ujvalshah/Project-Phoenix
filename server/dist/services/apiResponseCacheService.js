import { getRedisClientOrFallback } from '../utils/redisClient.js';
import { getLogger } from '../utils/logger.js';
import { incrementAppCounter } from '../utils/metrics.js';
function getCacheClient() {
    return getRedisClientOrFallback();
}
export function buildApiCacheKey(namespace, parts) {
    const serialized = parts.map((part) => encodeURIComponent(String(part ?? ''))).join('|');
    return `${namespace}:${serialized}`;
}
function namespaceFromRedisKey(key) {
    const i = key.indexOf(':');
    return i === -1 ? key : key.slice(0, i);
}
function keyPreview(key, max = 120) {
    return key.length <= max ? key : `${key.slice(0, max)}…`;
}
function logApiResponseCacheObservation(outcome, fields) {
    getLogger().debug({
        msg: '[ApiResponseCache]',
        cacheLayer: 'api_response_redis',
        outcome,
        ...fields,
    });
}
/**
 * Namespace prefixes stored in Redis for API JSON caches (SCAN / KEYS diagnostics).
 */
export const API_RESPONSE_CACHE_REDIS_NAMESPACE_PREFIXES = [
    'articles:list:v1',
    'articles:detail:v1',
    'collections:list:v1',
    'collections:articles:v1',
    'config:onboarding-bundle:v1',
    'legal:pages:v1',
    'tags:taxonomy:v1',
    'search:suggest:v1',
];
/**
 * Human-readable list of Redis key namespace prefixes used with this service (for operators / docs).
 * Does not include every possible key — see docs/CACHE_CONTRACT.md for full contract.
 */
export function summarizeApiResponseCacheNamespacePrefixes() {
    return API_RESPONSE_CACHE_REDIS_NAMESPACE_PREFIXES.join('\n');
}
function buildObserveCommonFields(key, ttlSeconds, observe) {
    const namespace = observe?.namespace ?? namespaceFromRedisKey(key);
    return {
        namespace,
        keyPreview: keyPreview(key),
        ttlSeconds,
        route: observe?.route,
        requestId: observe?.requestId,
    };
}
async function persistSerializedCacheEntry(key, ttlSeconds, serializedPayload, common) {
    const client = getCacheClient();
    try {
        await client.setEx(key, ttlSeconds, serializedPayload);
        incrementAppCounter('api_response_cache_write_total', { result: 'ok' });
        logApiResponseCacheObservation('set_ok', common);
    }
    catch (error) {
        incrementAppCounter('api_response_cache_write_total', { result: 'error' });
        const errMsg = error instanceof Error ? error.message : String(error);
        logApiResponseCacheObservation('write_error', { ...common, error: errMsg });
        getLogger().warn({
            msg: '[ApiResponseCache] Write failed; continuing without cache',
            key,
            error: errMsg,
        });
    }
}
/** Single-flight miss path is not enforced — concurrent MISSes may stampede Mongo (acceptable for TASK-017). */
export async function getOrSetCachedJsonWithDisposition(key, ttlSeconds, loader, observe) {
    const common = buildObserveCommonFields(key, ttlSeconds, observe);
    const client = getCacheClient();
    try {
        const cached = await client.get(key);
        if (cached) {
            incrementAppCounter('api_response_cache_access_total', { result: 'hit' });
            logApiResponseCacheObservation('hit', common);
            return { data: JSON.parse(cached), fromCache: true };
        }
        incrementAppCounter('api_response_cache_access_total', { result: 'miss' });
        logApiResponseCacheObservation('miss', common);
    }
    catch (error) {
        incrementAppCounter('api_response_cache_access_total', { result: 'read_error' });
        const errMsg = error instanceof Error ? error.message : String(error);
        logApiResponseCacheObservation('read_error', { ...common, error: errMsg });
        getLogger().warn({
            msg: '[ApiResponseCache] Read failed; falling back to source',
            key,
            error: errMsg,
        });
    }
    const data = await loader();
    await persistSerializedCacheEntry(key, ttlSeconds, JSON.stringify(data), common);
    return { data, fromCache: false };
}
export async function getOrSetCachedJson(key, ttlSeconds, loader, observe) {
    const { data } = await getOrSetCachedJsonWithDisposition(key, ttlSeconds, loader, observe);
    return data;
}
export async function peekCachedParsedJson(key, observe) {
    const common = buildObserveCommonFields(key, undefined, observe);
    const client = getCacheClient();
    try {
        const cached = await client.get(key);
        if (!cached)
            return null;
        incrementAppCounter('api_response_cache_access_total', { result: 'hit' });
        logApiResponseCacheObservation('hit', common);
        return JSON.parse(cached);
    }
    catch (error) {
        incrementAppCounter('api_response_cache_access_total', { result: 'read_error' });
        const errMsg = error instanceof Error ? error.message : String(error);
        logApiResponseCacheObservation('read_error', { ...common, error: errMsg });
        getLogger().warn({
            msg: '[ApiResponseCache] Peek/read failed — treating as miss',
            key,
            error: errMsg,
        });
        return null;
    }
}
export async function persistApiResponseJsonCache(key, ttlSeconds, payload, observe) {
    const common = buildObserveCommonFields(key, ttlSeconds, observe);
    await persistSerializedCacheEntry(key, ttlSeconds, JSON.stringify(payload), common);
}
export async function invalidateApiResponseCachePrefix(prefix, observe) {
    const invalidateMeta = observe;
    const client = getCacheClient();
    try {
        const keys = await client.keys(`${prefix}*`);
        if (keys.length === 0) {
            return;
        }
        await client.del(...keys);
        incrementAppCounter('api_response_cache_invalidation_total', { result: 'ok' });
        logApiResponseCacheObservation('invalidate_ok', {
            namespace: prefix,
            prefix,
            keysDeleted: keys.length,
            requestId: invalidateMeta?.requestId,
            source: invalidateMeta?.source,
        });
    }
    catch (error) {
        incrementAppCounter('api_response_cache_invalidation_total', { result: 'error' });
        const errMsg = error instanceof Error ? error.message : String(error);
        logApiResponseCacheObservation('invalidate_error', {
            namespace: prefix,
            prefix,
            error: errMsg,
            requestId: invalidateMeta?.requestId,
            source: invalidateMeta?.source,
        });
        getLogger().warn({
            msg: '[ApiResponseCache] Prefix invalidation failed',
            prefix,
            error: errMsg,
        });
    }
}
//# sourceMappingURL=apiResponseCacheService.js.map