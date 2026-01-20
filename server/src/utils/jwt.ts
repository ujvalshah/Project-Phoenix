import jwt from 'jsonwebtoken';
import { getEnv } from '../config/envValidation.js';

/**
 * JWT token payload structure
 * All tokens must include userId and role for consistency
 */
export interface JWTPayload {
  userId: string;
  role: string;
  email?: string;
  type?: 'access' | 'refresh'; // Token type for validation
  iat?: number; // Issued at
  exp?: number; // Expiration
}

/**
 * Token expiration configuration
 * Access tokens: short-lived for security
 * Refresh tokens: longer-lived for convenience
 */
export const TOKEN_CONFIG = {
  ACCESS_TOKEN_EXPIRY: '15m',    // 15 minutes
  REFRESH_TOKEN_EXPIRY: '7d',    // 7 days
  ACCESS_TOKEN_SECONDS: 15 * 60, // For Redis TTL
  REFRESH_TOKEN_SECONDS: 7 * 24 * 60 * 60,
} as const;

/**
 * Get JWT secret from validated environment
 * Throws if environment validation hasn't been executed
 */
function getJwtSecret(): string {
  const env = getEnv();
  return env.JWT_SECRET;
}

/**
 * Generate short-lived access token (15 minutes)
 * Used for API authentication
 *
 * @param userId - User ID
 * @param role - User role (e.g., 'user', 'admin')
 * @param email - User email
 * @returns JWT access token string
 */
export function generateAccessToken(
  userId: string,
  role: string,
  email?: string
): string {
  const payload: JWTPayload = {
    userId,
    role,
    type: 'access',
  };

  if (email) {
    payload.email = email;
  }

  const secret = getJwtSecret();
  return jwt.sign(payload, secret, {
    expiresIn: TOKEN_CONFIG.ACCESS_TOKEN_EXPIRY,
    algorithm: 'HS256',
  });
}

/**
 * Generate JWT token with consistent payload structure (legacy support)
 * Now defaults to access token behavior
 *
 * @param userId - User ID
 * @param role - User role (e.g., 'user', 'admin')
 * @param email - Optional email (for backward compatibility)
 * @param expiresIn - Token expiration (default: 15m for access tokens)
 * @returns JWT token string
 */
export function generateToken(
  userId: string,
  role: string,
  email?: string,
  expiresIn: string = TOKEN_CONFIG.ACCESS_TOKEN_EXPIRY
): string {
  const payload: JWTPayload = {
    userId,
    role,
    type: 'access',
  };

  // Include email if provided (for backward compatibility)
  if (email) {
    payload.email = email;
  }

  const secret = getJwtSecret();
  return jwt.sign(payload, secret, { expiresIn, algorithm: 'HS256' });
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
  const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] }) as JWTPayload;

  // Ensure required fields exist
  if (!decoded.userId || !decoded.role) {
    throw new Error('Invalid token: missing required fields (userId, role)');
  }

  return decoded;
}

/**
 * Decode token without verification (to get expiry for blacklisting)
 * WARNING: Do not trust the payload - this is only for extracting exp claim
 */
export function decodeTokenUnsafe(token: string): JWTPayload | null {
  try {
    const decoded = jwt.decode(token) as JWTPayload | null;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Get remaining seconds until token expiry
 */
export function getTokenRemainingSeconds(token: string): number {
  const decoded = decodeTokenUnsafe(token);
  if (!decoded || !decoded.exp) {
    return 0;
  }
  const now = Math.floor(Date.now() / 1000);
  return Math.max(0, decoded.exp - now);
}

// --- Email verification tokens (purpose-specific, short-lived) ---

export interface EmailVerificationPayload {
  purpose: 'email_verification';
  userId: string;
  email: string;
}

/**
 * Generate a short-lived JWT for email verification links.
 * Expires in 24 hours. Do not use for auth; verify with verifyEmailVerificationToken.
 */
export function generateEmailVerificationToken(userId: string, email: string): string {
  const secret = getJwtSecret();
  const payload: EmailVerificationPayload = { purpose: 'email_verification', userId, email };
  return jwt.sign(payload, secret, { expiresIn: '24h', algorithm: 'HS256' });
}

/**
 * Verify an email verification token. Returns userId and email.
 * @throws If token is invalid, expired, or has wrong purpose
 */
export function verifyEmailVerificationToken(token: string): { userId: string; email: string } {
  const secret = getJwtSecret();
  const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] }) as EmailVerificationPayload & { purpose?: string };
  if (decoded.purpose !== 'email_verification' || !decoded.userId || !decoded.email) {
    throw new Error('Invalid verification token');
  }
  return { userId: decoded.userId, email: decoded.email };
}

// --- Password reset tokens ---

export interface PasswordResetPayload {
  purpose: 'password_reset';
  userId: string;
  email: string;
}

/**
 * Generate a short-lived JWT for password reset links.
 * Expires in 1 hour for security.
 */
export function generatePasswordResetToken(userId: string, email: string): string {
  const secret = getJwtSecret();
  const payload: PasswordResetPayload = { purpose: 'password_reset', userId, email };
  return jwt.sign(payload, secret, { expiresIn: '1h', algorithm: 'HS256' });
}

/**
 * Verify a password reset token. Returns userId and email.
 * @throws If token is invalid, expired, or has wrong purpose
 */
export function verifyPasswordResetToken(token: string): { userId: string; email: string } {
  const secret = getJwtSecret();
  const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] }) as PasswordResetPayload & { purpose?: string };
  if (decoded.purpose !== 'password_reset' || !decoded.userId || !decoded.email) {
    throw new Error('Invalid password reset token');
  }
  return { userId: decoded.userId, email: decoded.email };
}








