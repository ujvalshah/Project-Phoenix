import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.js';

export interface AdminRequest extends Request {
  userId?: string;
  userRole?: string;
}

/**
 * Middleware to require admin role
 * Must be used after authenticateToken middleware
 * Token must include userId and role (validated by verifyToken)
 */
export const requireAdmin = (req: AdminRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const decoded = verifyToken(token);
    
    // Check if user has admin role
    if (decoded.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    req.userId = decoded.userId;
    req.userRole = decoded.role;
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    return res.status(401).json({ message: 'Authentication failed' });
  }
};








