import { Request, Response, NextFunction } from 'express';

/**
 * Extend Express Request for admin routes (backward compatibility).
 * authenticateToken sets req.user = { userId, role, email }.
 * This middleware additionally sets req.userId and req.userRole for
 * controllers that reference the old AdminRequest shape.
 */
export interface AdminRequest extends Request {
  userId?: string;
  userRole?: string;
}

/**
 * Requires a valid JWT (via prior authenticateToken) and role === 'admin'.
 * Returns 401 if not authenticated, 403 if not admin.
 *
 * IMPORTANT: Must be chained AFTER authenticateToken middleware so that
 * the blacklist check has already happened.
 */
export function requireAdminRole(req: Request, res: Response, next: NextFunction): void {
  const user = (req as Request & { user?: { userId?: string; role?: string } }).user;
  if (!user?.userId) {
    res.status(401).json({ error: true, message: 'Authentication required', code: 'TOKEN_REQUIRED' });
    return;
  }
  if (user.role !== 'admin') {
    res.status(403).json({ error: true, message: 'Admin access required', code: 'FORBIDDEN_ADMIN' });
    return;
  }

  // Backward compatibility: set flat fields for controllers using AdminRequest
  (req as AdminRequest).userId = user.userId;
  (req as AdminRequest).userRole = user.role;

  next();
}
