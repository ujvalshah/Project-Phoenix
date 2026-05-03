/**
 * Request ID Middleware
 *
 * Generates a unique request ID for each incoming request and:
 * - Attaches it to req.id
 * - Adds it to response headers (X-Request-Id)
 * - Makes it available for logging correlation
 */
import { randomUUID } from 'crypto';
/**
 * Middleware to generate and attach request ID
 */
export function requestIdMiddleware(req, res, next) {
    // Use existing request ID from header if present, otherwise generate new one
    const requestId = req.headers['x-request-id'] || randomUUID();
    // Attach to request object
    req.id = requestId;
    // Add to response headers for client correlation
    res.setHeader('X-Request-Id', requestId);
    next();
}
//# sourceMappingURL=requestId.js.map