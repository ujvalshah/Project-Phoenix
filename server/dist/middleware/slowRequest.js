/**
 * Slow Request Detection Middleware
 *
 * Measures request duration and logs requests exceeding threshold (default: 1000ms)
 * Does not block requests - only observes
 */
import { getLogger } from '../utils/logger.js';
const SLOW_REQUEST_THRESHOLD_MS = 1000;
/**
 * Middleware to detect and log slow requests
 */
export function slowRequestMiddleware(req, res, next) {
    const startTime = Date.now();
    // Override res.end to measure duration
    const originalEnd = res.end.bind(res);
    res.end = function (chunk, encoding) {
        const duration = Date.now() - startTime;
        if (duration >= SLOW_REQUEST_THRESHOLD_MS) {
            const logger = getLogger();
            logger.warn({
                msg: 'Slow request detected',
                method: req.method,
                route: req.route?.path || req.path,
                status: res.statusCode,
                duration: `${duration}ms`,
                requestId: req.id,
            });
        }
        // Call original end
        originalEnd(chunk, encoding);
    };
    next();
}
//# sourceMappingURL=slowRequest.js.map