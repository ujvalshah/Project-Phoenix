import { Request, Response, NextFunction } from 'express';

/**
 * Requires a valid JWT (via prior authenticateToken) and role === 'admin'.
 * Returns 401 if not authenticated, 403 if not admin.
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
  next();
}
