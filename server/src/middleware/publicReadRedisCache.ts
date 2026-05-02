/**
 * Helpers for Redis-backed GET JSON response caches (public read paths only).
 *
 * Bypass auth/mutation upstream — callers must enforce policy before invoking.
 */

import type { Request, Response } from 'express';
import { getLogger } from '../utils/logger.js';
import {
  buildApiCacheKey,
  getOrSetCachedJsonWithDisposition,
} from '../services/apiResponseCacheService.js';

export const PUBLIC_READ_RESPONSE_CACHE_HEADER = 'x-public-read-cache' as const;

export async function sendJsonViaPublicReadRedisCache<T>(opts: {
  req: Request;
  res: Response;
  namespace: string;
  ttlSeconds: number;
  routeLabel: string;
  keyParts: ReadonlyArray<string | number | boolean | null | undefined>;
  bypass?: boolean;
  bypassReason?: string;
  loader: () => Promise<T>;
}): Promise<void> {
  const requestIdStr =
    typeof opts.req.id === 'string' || typeof opts.req.id === 'number'
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
