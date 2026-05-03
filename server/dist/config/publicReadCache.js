import { invalidateApiResponseCachePrefix, buildApiCacheKey, getOrSetCachedJson, summarizeApiResponseCacheNamespacePrefixes, } from '../services/apiResponseCacheService.js';
import { getLogger } from '../utils/logger.js';
/** Redis key prefix for invalidateApiResponseCachePrefix(...) — keys are `${ns}:${parts}`. */
export const ARTICLES_LIST_CACHE_NS = 'articles:list:v1';
export const ARTICLES_DETAIL_CACHE_NS = 'articles:detail:v1';
export const COLLECTIONS_LIST_CACHE_NS = 'collections:list:v1';
export const COLLECTION_ARTICLES_CACHE_NS = 'collections:articles:v1';
export const ONBOARDING_BUNDLE_CACHE_NS = 'config:onboarding-bundle:v1';
export const SEARCH_SUGGEST_CACHE_NS = 'search:suggest:v1';
export const ARTICLES_LIST_CACHE_TTL_SECONDS = 45;
/** Mirrors `ArticleDetail.tsx` staleTime (`1000 * 60 * 5`). */
export const ARTICLES_DETAIL_CACHE_TTL_SECONDS = 300;
export const COLLECTIONS_LIST_CACHE_TTL_SECONDS = 120;
export const COLLECTION_ARTICLES_CACHE_TTL_SECONDS = 60;
export const ONBOARDING_BUNDLE_CACHE_TTL_SECONDS = 120;
/** Mirrors `useSearchSuggestions` staleTime (`1000 * 20`). */
export const SEARCH_SUGGEST_CACHE_TTL_SECONDS = 20;
/** JSON.serialize replacer: RegExp/ObjectId/bigint-safe for Mongo query fingerprints. */
function mongoCacheReplacer(_key, value) {
    if (value instanceof RegExp)
        return { __t: 're', p: value.source, f: value.flags };
    const maybeHex = typeof value?.toHexString === 'function'
        ? value.toHexString()
        : '';
    // Mongoose/ObjectId-compatible without importing mongoose models for instanceof edge cases:
    if (typeof value === 'object' &&
        value !== null &&
        typeof value.toHexString === 'function' &&
        maybeHex !== '' &&
        maybeHex.length === 24 &&
        /^[a-fA-F0-9]{24}$/.test(maybeHex)) {
        return { __t: 'oid', h: maybeHex };
    }
    return value;
}
/**
 * Stable string for hashing/fingerprinting dynamic Mongo-shaped objects (queries, sorts).
 */
export function stableSerializeForArticlesCache(payload) {
    return JSON.stringify(payload, mongoCacheReplacer);
}
/**
 * Cached GET /api/articles (Redis layer): anonymous-only response cache.
 * Logged-in users may receive richer future shaping; bypass for correctness.
 */
export function shouldUseArticlesListRedisCache(req, currentUserId) {
    if (typeof currentUserId === 'string' && currentUserId.length > 0)
        return false;
    if (req.query.favorites === '1')
        return false;
    if (req.query.unread === '1')
        return false;
    return true;
}
/** Aligns with `shouldUseArticlesListRedisCache` for bypass logging reasons only. */
export function describeArticlesListRedisBypassReason(req, currentUserId) {
    if (typeof currentUserId === 'string' && currentUserId.length > 0) {
        return { reasonCode: 'authenticated_session', detail: 'redis list cache is anon-only' };
    }
    if (req.query.favorites === '1')
        return { reasonCode: 'favorites_query' };
    if (req.query.unread === '1')
        return { reasonCode: 'unread_query' };
    return { reasonCode: 'unknown_skip' };
}
/**
 * Cached GET /api/collections: omit private listings (caller-specific / auth-required).
 */
export function shouldRedisCacheCollectionsList(req) {
    const typeParam = typeof req.query.type === 'string' ? req.query.type : undefined;
    if (typeParam === 'private')
        return false;
    return true;
}
/**
 * Cached GET /api/collections/:id/articles: public editorial collections only, no inline search text, never admin-tailored payloads.
 */
export function shouldRedisCacheCollectionArticles(collectionType, userRole, q) {
    if (collectionType !== 'public')
        return false;
    const isAdmin = typeof userRole === 'string' && userRole.toLowerCase().trim() === 'admin';
    if (isAdmin)
        return false;
    if (typeof q === 'string' && q.trim().length > 0)
        return false;
    return true;
}
export async function invalidateRedisArticleDerivedReadCaches() {
    await Promise.all([
        invalidateApiResponseCachePrefix(ARTICLES_LIST_CACHE_NS),
        invalidateApiResponseCachePrefix(COLLECTION_ARTICLES_CACHE_NS),
        invalidateApiResponseCachePrefix(ARTICLES_DETAIL_CACHE_NS),
        invalidateApiResponseCachePrefix(SEARCH_SUGGEST_CACHE_NS),
    ]);
}
export async function invalidateRedisCollectionReadCaches() {
    await Promise.all([
        invalidateApiResponseCachePrefix(COLLECTIONS_LIST_CACHE_NS),
        invalidateApiResponseCachePrefix(COLLECTION_ARTICLES_CACHE_NS),
    ]);
}
export async function invalidateRedisOnboardingBundleCache() {
    await invalidateApiResponseCachePrefix(ONBOARDING_BUNDLE_CACHE_NS);
}
/** Debug: one-line printable summary for operators (namespaces wired through `publicReadCache`). */
export function formatPublicReadCacheRegistrySummary() {
    const lines = [
        `${ARTICLES_LIST_CACHE_NS} (${ARTICLES_LIST_CACHE_TTL_SECONDS}s) — GET /api/articles (anon-only)`,
        `${ARTICLES_DETAIL_CACHE_NS} (${ARTICLES_DETAIL_CACHE_TTL_SECONDS}s) — GET /api/articles/:id (published · non-private payloads only)`,
        `${SEARCH_SUGGEST_CACHE_NS} (${SEARCH_SUGGEST_CACHE_TTL_SECONDS}s) — GET /api/search/suggest`,
        `${COLLECTIONS_LIST_CACHE_NS} (${COLLECTIONS_LIST_CACHE_TTL_SECONDS}s) — GET /api/collections`,
        `${COLLECTION_ARTICLES_CACHE_NS} (${COLLECTION_ARTICLES_CACHE_TTL_SECONDS}s) — GET /api/collections/:id/articles`,
        `${ONBOARDING_BUNDLE_CACHE_NS} (${ONBOARDING_BUNDLE_CACHE_TTL_SECONDS}s) — GET /api/config/onboarding-bundle`,
        '—',
        'All Redis API response prefixes (cross-reference):',
        summarizeApiResponseCacheNamespacePrefixes(),
    ];
    return lines.join('\n');
}
/**
 * Structured debug log when a public read path skips the Redis response cache (correctness / policy).
 * Default log level: debug.
 */
export function logPublicReadCacheBypass(args) {
    getLogger().debug({
        msg: '[PublicReadCache] redis_bypass',
        cacheLayer: 'api_response_redis',
        ...args,
    });
}
/**
 * Canonical GET /api/config/onboarding-bundle response caching (aggregates micro-header payloads).
 */
export function fetchOnboardingBundleCached(load) {
    const key = buildApiCacheKey(ONBOARDING_BUNDLE_CACHE_NS, ['bundle']);
    return getOrSetCachedJson(key, ONBOARDING_BUNDLE_CACHE_TTL_SECONDS, load, {
        route: 'GET /api/config/onboarding-bundle',
        namespace: ONBOARDING_BUNDLE_CACHE_NS,
    });
}
//# sourceMappingURL=publicReadCache.js.map