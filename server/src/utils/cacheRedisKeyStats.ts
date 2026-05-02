/**
 * SCAN (or KEYS on in-memory Redis) counts for API response cache key namespaces.
 */

import { API_RESPONSE_CACHE_REDIS_NAMESPACE_PREFIXES } from '../services/apiResponseCacheService.js';
import { getRedisClientOrFallback } from './redisClient.js';

type MinimalRedisClient = {
  scanIterator?: (opts: { MATCH: string; COUNT: number }) => AsyncIterable<string>;
  keys: (pattern: string) => Promise<string[]>;
};

export async function countApiResponseCacheRedisKeysByPrefix(): Promise<{
  byPrefix: Record<string, number>;
  method: 'scan' | 'keys';
}> {
  const client = getRedisClientOrFallback() as unknown as MinimalRedisClient;
  const byPrefix: Record<string, number> = Object.create(null);

  if (typeof client.scanIterator === 'function') {
    for (const prefix of API_RESPONSE_CACHE_REDIS_NAMESPACE_PREFIXES) {
      let n = 0;
      for await (const _ of client.scanIterator({ MATCH: `${prefix}*`, COUNT: 256 })) {
        n += 1;
      }
      byPrefix[prefix] = n;
    }
    return { byPrefix, method: 'scan' };
  }

  for (const prefix of API_RESPONSE_CACHE_REDIS_NAMESPACE_PREFIXES) {
    const keys = await client.keys(`${prefix}*`);
    byPrefix[prefix] = keys.length;
  }
  return { byPrefix, method: 'keys' };
}
