import jwt from 'jsonwebtoken';
import { getEnv } from '../config/envValidation.js';

/**
 * JWT token payload structure
 * All tokens must include userId and role for consistency
 */
export interface JWTPayload {
  userId: string;
  role: string;
  email?: string; // Optional for backward compatibility
}

/**
 * Get JWT secret from validated environment
 * Throws if environment validation hasn't been executed
 */
function getJwtSecret(): string {
  const env = getEnv();
  return env.JWT_SECRET;
}

/**
 * Generate JWT token with consistent payload structure
 * Always includes userId and role
 * 
 * @param userId - User ID
 * @param role - User role (e.g., 'user', 'admin')
 * @param email - Optional email (for backward compatibility)
 * @param expiresIn - Token expiration (default: 7d)
 * @returns JWT token string
 */
export function generateToken(
  userId: string,
  role: string,
  email?: string,
  expiresIn: string = '7d'
): string {
  const payload: JWTPayload = {
    userId,
    role,
  };
  
  // Include email if provided (for backward compatibility)
  if (email) {
    payload.email = email;
  }
  
  const secret = getJwtSecret();
  return jwt.sign(payload, secret, { expiresIn });
}

/**
 * Verify JWT token and return decoded payload
 * 
 * @param token - JWT token string
 * @returns Decoded payload with userId and role
 * @throws If token is invalid or expired
 */
export function verifyToken(token: string): JWTPayload {
  const secret = getJwtSecret();
  const decoded = jwt.verify(token, secret) as JWTPayload;
  
  // Ensure required fields exist
  if (!decoded.userId || !decoded.role) {
    throw new Error('Invalid token: missing required fields (userId, role)');
  }
  
  return decoded;
}





