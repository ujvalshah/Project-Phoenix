import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { getEnv } from '../config/envValidation.js';
// JWT audience and issuer — prevents token confusion across services
const JWT_ISSUER = 'nuggets-api';
const JWT_AUDIENCE = 'nuggets-app';
/**
 * Derive a purpose-specific signing key from the base JWT_SECRET using HMAC.
 * Even if one derived key leaks, other token types remain safe.
 * Each purpose gets a cryptographically distinct key.
 */
function deriveKey(purpose) {
    return crypto.createHmac('sha256', getJwtSecret()).update(purpose).digest('hex');
}
/**
 * Token expiration configuration
 * Access tokens: short-lived for security
 * Refresh tokens: longer-lived for convenience
 */
export const TOKEN_CONFIG = {
    ACCESS_TOKEN_EXPIRY: '15m', // 15 minutes — short-lived to limit stolen-token window
    REFRESH_TOKEN_EXPIRY: '7d', // 7 days
    ACCESS_TOKEN_SECONDS: 15 * 60, // 900s — for Redis TTL and client expiresIn
    REFRESH_TOKEN_SECONDS: 7 * 24 * 60 * 60,
};
/**
 * Get JWT secret from validated environment
 * Throws if environment validation hasn't been executed
 */
function getJwtSecret() {
    const env = getEnv();
    return env.JWT_SECRET;
}
/**
 * Generate short-lived access token (1 hour)
 * Used for API authentication
 *
 * @param userId - User ID
 * @param role - User role (e.g., 'user', 'admin')
 * @param email - User email
 * @returns JWT access token string
 */
export function generateAccessToken(userId, role, email, tokenVersion) {
    const payload = {
        userId,
        role,
        type: 'access',
    };
    if (email) {
        payload.email = email;
    }
    if (tokenVersion !== undefined) {
        payload.tokenVersion = tokenVersion;
    }
    const secret = deriveKey('access');
    return jwt.sign(payload, secret, {
        expiresIn: TOKEN_CONFIG.ACCESS_TOKEN_EXPIRY,
        algorithm: 'HS256',
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
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
export function generateToken(userId, role, email, expiresIn = TOKEN_CONFIG.ACCESS_TOKEN_EXPIRY, tokenVersion) {
    const payload = {
        userId,
        role,
        type: 'access',
    };
    // Include email if provided (for backward compatibility)
    if (email) {
        payload.email = email;
    }
    if (tokenVersion !== undefined) {
        payload.tokenVersion = tokenVersion;
    }
    const secret = deriveKey('access');
    return jwt.sign(payload, secret, {
        expiresIn,
        algorithm: 'HS256',
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
    });
}
/**
 * Verify JWT token and return decoded payload
 *
 * @param token - JWT token string
 * @returns Decoded payload with userId and role
 * @throws If token is invalid or expired
 */
export function verifyToken(token) {
    const secret = deriveKey('access');
    const decoded = jwt.verify(token, secret, {
        algorithms: ['HS256'],
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
    });
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
export function decodeTokenUnsafe(token) {
    try {
        const decoded = jwt.decode(token);
        return decoded;
    }
    catch {
        return null;
    }
}
/**
 * Get remaining seconds until token expiry
 */
export function getTokenRemainingSeconds(token) {
    const decoded = decodeTokenUnsafe(token);
    if (!decoded || !decoded.exp) {
        return 0;
    }
    const now = Math.floor(Date.now() / 1000);
    return Math.max(0, decoded.exp - now);
}
/**
 * Generate a short-lived JWT for email verification links.
 * Expires in 24 hours. Do not use for auth; verify with verifyEmailVerificationToken.
 */
export function generateEmailVerificationToken(userId, email) {
    const secret = deriveKey('email_verification');
    const payload = { purpose: 'email_verification', userId, email };
    return jwt.sign(payload, secret, { expiresIn: '24h', algorithm: 'HS256' });
}
/**
 * Verify an email verification token. Returns userId and email.
 * @throws If token is invalid, expired, or has wrong purpose
 */
export function verifyEmailVerificationToken(token) {
    const secret = deriveKey('email_verification');
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
    if (decoded.purpose !== 'email_verification' || !decoded.userId || !decoded.email) {
        throw new Error('Invalid verification token');
    }
    return { userId: decoded.userId, email: decoded.email };
}
/**
 * Generate a short-lived JWT for password reset links.
 * Expires in 1 hour for security.
 */
export function generatePasswordResetToken(userId, email) {
    const secret = deriveKey('password_reset');
    const payload = { purpose: 'password_reset', userId, email };
    return jwt.sign(payload, secret, { expiresIn: '1h', algorithm: 'HS256' });
}
/**
 * Verify a password reset token. Returns userId and email.
 * @throws If token is invalid, expired, or has wrong purpose
 */
export function verifyPasswordResetToken(token) {
    const secret = deriveKey('password_reset');
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
    if (decoded.purpose !== 'password_reset' || !decoded.userId || !decoded.email) {
        throw new Error('Invalid password reset token');
    }
    return { userId: decoded.userId, email: decoded.email };
}
//# sourceMappingURL=jwt.js.map