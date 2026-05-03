import { verifyToken } from '../utils/jwt.js';
import { isTokenBlacklisted } from '../services/tokenService.js';
import { createRequestLogger } from '../utils/logger.js';
/**
 * Best-effort auth middleware:
 * - If no token is present, continue as anonymous request.
 * - If token is valid, attach req.user.
 * - If token is invalid/revoked, continue as anonymous request.
 */
export async function optionalAuthenticateToken(req, _res, next) {
    const authHeader = req.headers['authorization'];
    const headerToken = authHeader && authHeader.split(' ')[1];
    const cookieToken = req.cookies?.access_token;
    const token = cookieToken || headerToken;
    if (!token) {
        return next();
    }
    try {
        const blacklisted = await isTokenBlacklisted(token);
        if (blacklisted) {
            return next();
        }
        const decoded = verifyToken(token);
        req.user = decoded;
        req.token = token;
        return next();
    }
    catch (error) {
        const requestLogger = createRequestLogger(req.id || 'unknown', undefined, req.path);
        requestLogger.warn({
            msg: '[OptionalAuth] Ignoring invalid auth token for optional route',
            error: error instanceof Error
                ? { name: error.name, message: error.message }
                : { message: String(error) },
        });
        return next();
    }
}
//# sourceMappingURL=optionalAuthenticateToken.js.map