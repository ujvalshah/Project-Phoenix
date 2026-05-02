import { getRedisClientOrFallback } from '../utils/redisClient.js';
import { getLogger } from '../utils/logger.js';
import { incrementAppCounter } from '../utils/metrics.js';

// Do not call getLogger() at module load: ESM hoists imports, so index.ts transitively
// loads this file before initLogger() runs.

/** Optional structured fields for debug logging (default log level: debug). */
export type ApiResponseCacheObserveContext = {
  /** HTTP route or logical label, e.g. GET /api/legal */
  route?: string;
  requestId?: string;
  /** Redis key namespace (first segment before `:`); inferred from key if omitted */
  namespace?: string;
};

type CacheClient = {
  get: (key: string) => Promise<string | null>;
  setEx: (key: string, seconds: number, value: string) => Promise<unknown>;
  keys: (pattern: string) => Promise<string[]>;
  del: (...keys: string[]) => Promise<unknown>;
};

function getCacheClient(): CacheClient {
  return getRedisClientOrFallback() as unknown as CacheClient;
}

export function buildApiCacheKey(namespace: string, parts: Array<string | number | boolean | null | undefined>): string {
  const serialized = parts.map((part) => encodeURIComponent(String(part ?? ''))).join('|');
  return `${namespace}:${serialized}`;
}

function namespaceFromRedisKey(key: string): string {
  const i = key.indexOf(':');
  return i === -1 ? key : key.slice(0, i);
}

function keyPreview(key: string, max = 120): string {
  return key.length <= max ? key : `${key.slice(0, max)}…`;
}

function logApiResponseCacheObservation(
  outcome: 'hit' | 'miss' | 'set_ok' | 'write_error' | 'read_error' | 'invalidate_ok' | 'invalidate_error',
  fields: {
    namespace: string;
    keyPreview?: string;
    ttlSeconds?: number;
    route?: string;
    requestId?: string;
    prefix?: string;
    keysDeleted?: number;
    error?: string;
    /** Mutation or job that triggered invalidation (best-effort) */
    source?: string;
  },
): void {
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
] as const;

/**
 * Human-readable list of Redis key namespace prefixes used with this service (for operators / docs).
 * Does not include every possible key — see docs/CACHE_CONTRACT.md for full contract.
 */
export function summarizeApiResponseCacheNamespacePrefixes(): string {
  return API_RESPONSE_CACHE_REDIS_NAMESPACE_PREFIXES.join('\n');
}

function buildObserveCommonFields(
  key: string,
  ttlSeconds: number | undefined,
  observe?: ApiResponseCacheObserveContext,
) {
  const namespace = observe?.namespace ?? namespaceFromRedisKey(key);
  return {
    namespace,
    keyPreview: keyPreview(key),
    ttlSeconds,
    route: observe?.route,
    requestId: observe?.requestId,
  };
}

async function persistSerializedCacheEntry(
  key: string,
  ttlSeconds: number,
  serializedPayload: string,
  common: ReturnType<typeof buildObserveCommonFields>,
): Promise<void> {
  const client = getCacheClient();
  try {
    await client.setEx(key, ttlSeconds, serializedPayload);
    incrementAppCounter('api_response_cache_write_total', { result: 'ok' });
    logApiResponseCacheObservation('set_ok', common);
  } catch (error: unknown) {
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
export async function getOrSetCachedJsonWithDisposition<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
  observe?: ApiResponseCacheObserveContext,
): Promise<{ data: T; fromCache: boolean }> {
  const common = buildObserveCommonFields(key, ttlSeconds, observe);
  const client = getCacheClient();
  try {
    const cached = await client.get(key);
    if (cached) {
      incrementAppCounter('api_response_cache_access_total', { result: 'hit' });
      logApiResponseCacheObservation('hit', common);
      return { data: JSON.parse(cached) as T, fromCache: true };
    }
    incrementAppCounter('api_response_cache_access_total', { result: 'miss' });
    logApiResponseCacheObservation('miss', common);
  } catch (error: unknown) {
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

export async function getOrSetCachedJson<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
  observe?: ApiResponseCacheObserveContext,
): Promise<T> {
  const { data } = await getOrSetCachedJsonWithDisposition(key, ttlSeconds, loader, observe);
  return data;
}

export async function peekCachedParsedJson<T>(
  key: string,
  observe?: ApiResponseCacheObserveContext,
): Promise<T | null> {
  const common = buildObserveCommonFields(key, undefined, observe);
  const client = getCacheClient();
  try {
    const cached = await client.get(key);
    if (!cached) return null;
    incrementAppCounter('api_response_cache_access_total', { result: 'hit' });
    logApiResponseCacheObservation('hit', common);
    return JSON.parse(cached) as T;
  } catch (error: unknown) {
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

export async function persistApiResponseJsonCache<T>(
  key: string,
  ttlSeconds: number,
  payload: T,
  observe?: ApiResponseCacheObserveContext,
): Promise<void> {
  const common = buildObserveCommonFields(key, ttlSeconds, observe);
  await persistSerializedCacheEntry(key, ttlSeconds, JSON.stringify(payload), common);
}

export async function invalidateApiResponseCachePrefix(
  prefix: string,
  observe?: Pick<ApiResponseCacheObserveContext, 'requestId'> & { source?: string },
): Promise<void> {
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
  } catch (error: unknown) {
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
