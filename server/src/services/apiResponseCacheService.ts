import { getRedisClientOrFallback } from '../utils/redisClient.js';
import { getLogger } from '../utils/logger.js';
import { incrementAppCounter } from '../utils/metrics.js';

const logger = getLogger();

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

export async function getOrSetCachedJson<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<T> {
  const client = getCacheClient();
  try {
    const cached = await client.get(key);
    if (cached) {
      incrementAppCounter('api_response_cache_access_total', { result: 'hit' });
      return JSON.parse(cached) as T;
    }
    incrementAppCounter('api_response_cache_access_total', { result: 'miss' });
  } catch (error: unknown) {
    incrementAppCounter('api_response_cache_access_total', { result: 'read_error' });
    logger.warn({
      msg: '[ApiResponseCache] Read failed; falling back to source',
      key,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const data = await loader();

  try {
    await client.setEx(key, ttlSeconds, JSON.stringify(data));
    incrementAppCounter('api_response_cache_write_total', { result: 'ok' });
  } catch (error: unknown) {
    incrementAppCounter('api_response_cache_write_total', { result: 'error' });
    logger.warn({
      msg: '[ApiResponseCache] Write failed; continuing without cache',
      key,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return data;
}

export async function invalidateApiResponseCachePrefix(prefix: string): Promise<void> {
  const client = getCacheClient();
  try {
    const keys = await client.keys(`${prefix}*`);
    if (keys.length === 0) return;
    await client.del(...keys);
    incrementAppCounter('api_response_cache_invalidation_total', { result: 'ok' });
  } catch (error: unknown) {
    incrementAppCounter('api_response_cache_invalidation_total', { result: 'error' });
    logger.warn({
      msg: '[ApiResponseCache] Prefix invalidation failed',
      prefix,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
