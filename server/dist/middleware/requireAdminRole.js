/**
 * Requires a valid JWT (via prior authenticateToken) and role === 'admin'.
 * Returns 401 if not authenticated, 403 if not admin.
 *
 * IMPORTANT: Must be chained AFTER authenticateToken middleware so that
 * the blacklist check has already happened.
 */
export function requireAdminRole(req, res, next) {
    const user = req.user;
    if (!user?.userId) {
        res.status(401).json({ error: true, message: 'Authentication required', code: 'TOKEN_REQUIRED' });
        return;
    }
    if (user.role !== 'admin') {
        res.status(403).json({ error: true, message: 'Admin access required', code: 'FORBIDDEN_ADMIN' });
        return;
    }
    // Backward compatibility: set flat fields for controllers using AdminRequest
    req.userId = user.userId;
    req.userRole = user.role;
    next();
}
//# sourceMappingURL=requireAdminRole.js.map