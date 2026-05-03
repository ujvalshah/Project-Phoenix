/**
 * Logs `x-public-read-cache` disposition + request latency bucket after response completes.
 * Emits {@link incrementAppCounter} totals aligned with Prometheus `app_events_total`.
 */
import { incrementAppCounter, normalizeRouteForMetrics, httpLatencyBucketLabel, } from '../utils/metrics.js';
import { getLogger } from '../utils/logger.js';
import { PUBLIC_READ_RESPONSE_CACHE_HEADER } from './publicReadRedisCache.js';
export function publicReadCacheObserveMiddleware(req, res, next) {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
        const headerVal = res.getHeader(PUBLIC_READ_RESPONSE_CACHE_HEADER);
        if (headerVal === undefined || headerVal === null) {
            return;
        }
        const disposition = Array.isArray(headerVal)
            ? String(headerVal[0] ?? '').trim()
            : String(headerVal).trim();
        if (!disposition) {
            return;
        }
        const end = process.hrtime.bigint();
        const durationMs = Number(end - start) / 1_000_000;
        const route = normalizeRouteForMetrics(req.path || req.originalUrl || 'unknown');
        const bucket = httpLatencyBucketLabel(durationMs);
        const method = req.method;
        incrementAppCounter('public_read_cache_response_total', {
            disposition,
            bucket,
            route,
        });
        getLogger().debug({
            msg: '[PublicReadCache] response_observed',
            observability: 'public_read_cache',
            disposition,
            latencyBucket: bucket,
            durationMs: Number(durationMs.toFixed(3)),
            route,
            method,
            statusCode: res.statusCode,
            requestId: String(req.id ?? ''),
        });
    });
    next();
}
//# sourceMappingURL=publicReadCacheObserveMiddleware.js.map