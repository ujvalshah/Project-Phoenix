import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.js';

/**
 * Extend Express Request to include user info
 */
export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
  userRole?: string;
}

/**
 * JWT Authentication Middleware
 * Validates JWT token and attaches user info to request
 * Token must include userId and role (validated by verifyToken)
 */
export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const decoded = verifyToken(token);
    req.userId = decoded.userId;
    req.userEmail = decoded.email;
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












