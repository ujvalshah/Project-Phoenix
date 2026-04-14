import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { normalizeDoc } from '../utils/db.js';
import {
  generateAccessToken,
  generateEmailVerificationToken,
  verifyEmailVerificationToken,
  generatePasswordResetToken,
  verifyPasswordResetToken,
  getTokenRemainingSeconds,
  TOKEN_CONFIG,
} from '../utils/jwt.js';
import { getEnv } from '../config/envValidation.js';
import { sendVerificationEmail, sendPasswordResetEmail, sendAccountExistsEmail } from '../services/emailService.js';
import crypto from 'crypto';
import { setAuthCookies, clearAuthCookies, setCsrfCookie } from '../utils/authCookies.js';
import {
  generateRefreshToken,
  storeRefreshToken,
  getUserIdFromRefreshToken,
  validateRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokens,
  blacklistToken,
  recordFailedLogin,
  clearFailedLogins,
  isAccountLocked,
  getUserSessions,
  isTokenServiceAvailable,
  RedisUnavailableError,
} from '../services/tokenService.js';
import { z } from 'zod';
import {
  sendErrorResponse,
  sendValidationError,
  sendUnauthorizedError,
  sendNotFoundError,
  sendInternalError
} from '../utils/errorResponse.js';
import { createRequestLogger } from '../utils/logger.js';

// Validation Schemas — email normalized for consistent lookups and user-enumeration resistance
const loginSchema = z.object({
  email: z.string().email('Invalid email format').transform((s) => s.toLowerCase().trim()),
  password: z.string().min(1, 'Password is required')
});

// Generic login failure message to prevent user enumeration
const LOGIN_FAILURE_MSG = 'Invalid email or password';
const isEmailVerificationEnabled = (): boolean => getEnv().ENABLE_EMAIL_VERIFICATION;
const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 30;
const USERNAME_RANDOM_BYTES = 3;

function normalizeUsernameSeed(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');

  if (!normalized) return 'user';
  return normalized.slice(0, USERNAME_MAX_LENGTH);
}

function deriveUsernameSeed(fullName: string, email: string): string {
  const fullNameSeed = normalizeUsernameSeed(fullName);
  if (fullNameSeed && fullNameSeed !== 'user') return fullNameSeed;
  const emailLocalPart = email.split('@')[0] || '';
  return normalizeUsernameSeed(emailLocalPart);
}

async function generateUniqueUsername(baseSeed: string): Promise<string> {
  const seed = normalizeUsernameSeed(baseSeed);
  const base = seed.length >= USERNAME_MIN_LENGTH ? seed : `${seed}_user`;
  const trimmedBase = base.slice(0, USERNAME_MAX_LENGTH);

  const existingBase = await User.exists({ 'profile.username': trimmedBase });
  if (!existingBase) return trimmedBase;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const suffix = crypto.randomBytes(USERNAME_RANDOM_BYTES).toString('hex');
    const maxBaseLength = USERNAME_MAX_LENGTH - suffix.length - 1;
    const basePart = trimmedBase.slice(0, Math.max(USERNAME_MIN_LENGTH, maxBaseLength));
    const candidate = `${basePart}_${suffix}`;
    const exists = await User.exists({ 'profile.username': candidate });
    if (!exists) return candidate;
  }

  throw new Error('Failed to generate a unique username');
}

function getZodIssues(error: z.ZodError): z.ZodIssue[] {
  const issuesFromV4 = (error as any).issues;
  if (Array.isArray(issuesFromV4)) {
    return issuesFromV4;
  }

  const issuesFromLegacy = (error as any).errors;
  if (Array.isArray(issuesFromLegacy)) {
    return issuesFromLegacy;
  }

  return [];
}

// Helper function to format validation errors into user-friendly messages
function formatValidationErrors(errors: z.ZodIssue[] | undefined): string {
  const errorMessages: string[] = [];
  
  (errors ?? []).forEach((error) => {
    const field = error.path.join('.');
    let message = error.message;
    
    // Customize messages for password field
    if (field === 'password') {
      if (error.code === 'too_small') {
        message = 'Password must be at least 8 characters long';
      } else if (error.message.includes('uppercase')) {
        message = 'Password must contain at least one uppercase letter (A-Z)';
      } else if (error.message.includes('lowercase')) {
        message = 'Password must contain at least one lowercase letter (a-z)';
      } else if (error.message.includes('number')) {
        message = 'Password must contain at least one number (0-9)';
      } else if (error.message.includes('special')) {
        message = 'Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)';
      }
    }
    
    // Format field names to be more readable
    const fieldName = field === 'fullName' ? 'Full name' :
                     field === 'phoneNumber' ? 'Phone number' :
                     field.charAt(0).toUpperCase() + field.slice(1);
    
    errorMessages.push(`${fieldName}: ${message}`);
  });
  
  return errorMessages.join('. ');
}

const signupSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  email: z.string().email('Invalid email format').transform((s) => s.toLowerCase().trim()),
  password: z.string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  pincode: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  gender: z.string().optional(),
  phoneNumber: z.string().optional(),
  // Optional DOB for rollout flexibility (UI may hide this field)
  dateOfBirth: z.string().optional(),
  // Legacy/alternate onboarding payload shapes accepted with safe defaults
  interestedCategories: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
  preferences: z.object({
    interestedCategories: z.array(z.string()).optional(),
  }).optional(),
  onboarding: z.object({
    completed: z.boolean().optional(),
  }).optional(),
}).strict();


/**
 * POST /api/auth/login
 * Login with email and password
 *
 * Security features:
 * - Account lockout after 5 failed attempts (15 min)
 * - Returns both access token (15 min) and refresh token (7 days)
 * - Generic error messages to prevent user enumeration
 */
export const login = async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger((req as any).id || 'unknown', undefined, req.path);

  try {
    // Validate input
    const validationResult = loginSchema.safeParse(req.body);
    if (!validationResult.success) {
      const issues = getZodIssues(validationResult.error);
      const formattedMessage = formatValidationErrors(issues);
      const errors = issues.map(err => ({
        path: err.path,
        message: err.message,
        code: err.code
      }));
      return sendValidationError(
        res,
        formattedMessage || 'Validation failed. Please check your input and try again.',
        errors
      );
    }

    const { email, password } = validationResult.data;

    // Check if account is locked
    const lockoutStatus = await isAccountLocked(email);
    if (lockoutStatus.isLocked) {
      requestLogger.warn({ msg: 'Login blocked - account locked', email: email.substring(0, 3) + '***' });
      return res.status(429).json({
        error: true,
        message: 'Account temporarily locked due to too many failed attempts. Please try again later.',
        code: 'ACCOUNT_LOCKED',
        lockoutEndsAt: lockoutStatus.lockoutEndsAt,
      });
    }

    // Find user by email (password field is excluded by default, so we need to select it)
    const user = await User.findOne({ 'auth.email': email })
      .select('+password');

    if (!user) {
      // Record failed attempt even for non-existent users (prevents enumeration timing)
      await recordFailedLogin(email);
      return sendUnauthorizedError(res, LOGIN_FAILURE_MSG);
    }

    // Check password (if user has one - social auth users may not)
    // bcrypt.compare is timing-safe
    if (user.password) {
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        // Record failed attempt
        const failStatus = await recordFailedLogin(email);
        if (failStatus.isLocked) {
          return res.status(429).json({
            error: true,
            message: 'Account temporarily locked due to too many failed attempts. Please try again later.',
            code: 'ACCOUNT_LOCKED',
            lockoutEndsAt: failStatus.lockoutEndsAt,
          });
        }
        return sendUnauthorizedError(res, LOGIN_FAILURE_MSG);
      }
    } else {
      // User exists but has no password (social auth only) — same generic message to avoid enumeration
      await recordFailedLogin(email);
      return sendUnauthorizedError(res, LOGIN_FAILURE_MSG);
    }

    // Successful login - clear failed attempts
    await clearFailedLogins(email);

    // Update last login time
    user.appState.lastLoginAt = new Date().toISOString();
    await user.save();

    // Generate tokens
    const accessToken = generateAccessToken(user._id.toString(), user.role, user.auth.email);

    // Generate and store refresh token (if token service available)
    let refreshToken: string | undefined;
    if (isTokenServiceAvailable()) {
      try {
        refreshToken = generateRefreshToken();
        const deviceInfo = req.headers['user-agent'] || 'Unknown device';
        const ipAddress = req.ip || req.socket.remoteAddress;
        // If storage failed, still proceed with login but without refresh token
        const stored = await storeRefreshToken(user._id.toString(), refreshToken, deviceInfo, ipAddress);
        if (!stored) {
          requestLogger.error({ 
            msg: 'CRITICAL: Failed to store refresh token during login', 
            userId: user._id.toString(),
            email: email.substring(0, 3) + '***'
          });
          refreshToken = undefined;
        } else {
          requestLogger.info({ 
            msg: 'Refresh token stored successfully during login', 
            userId: user._id.toString()
          });
        }
      } catch (error: any) {
        // If refresh token storage fails, continue without it (graceful degradation)
        requestLogger.warn({ 
          msg: 'Failed to store refresh token, continuing without it', 
          err: { message: error.message } 
        });
        refreshToken = undefined;
      }
    }

    // Return user data (without password) and tokens
    const userData = normalizeDoc(user);

    // Set HttpOnly auth cookies (primary auth mechanism)
    setAuthCookies(res, accessToken, refreshToken);
    const csrfToken = crypto.randomBytes(32).toString('hex');
    setCsrfCookie(res, csrfToken);

    res.json({
      user: userData,
      token: accessToken, // Legacy field name for backward compatibility
      accessToken,
      refreshToken, // Only present if Redis available
      csrfToken, // For double-submit CSRF pattern
      expiresIn: TOKEN_CONFIG.ACCESS_TOKEN_SECONDS, // Seconds until access token expires
    });
  } catch (error: any) {
    requestLogger.error({
      msg: 'Login failed',
      err: error instanceof Error ? { message: error.message, name: error.name } : { message: String(error) }
    });
    sendInternalError(res);
  }
};

/**
 * POST /api/auth/signup
 * Create new user account
 */
export const signup = async (req: Request, res: Response) => {
  // Declare variables outside try block for error handler access
  let normalizedEmail: string = '';
  let normalizedUsername: string = '';
  let existingUser: any = null;
  
  try {
    // Validate input
    const validationResult = signupSchema.safeParse(req.body);
    if (!validationResult.success) {
      const issues = getZodIssues(validationResult.error);
      const formattedMessage = formatValidationErrors(issues);
      const errors = issues.map(err => ({
        path: err.path,
        message: err.message,
        code: err.code
      }));
      return sendValidationError(
        res,
        formattedMessage || 'Validation failed. Please check your input and try again.',
        errors
      );
    }

    const data = validationResult.data;
    const now = new Date().toISOString();

    // Schema already normalizes email
    normalizedEmail = data.email;

    // Check if email already exists — return identical 201 to prevent enumeration
    existingUser = await User.findOne({ 'auth.email': normalizedEmail });
    if (existingUser) {
      // Send "account already exists" email (fire-and-forget) so the user knows
      const baseUrl = getEnv().FRONTEND_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
      const loginUrl = `${baseUrl.replace(/\/$/, '')}/login`;
      sendAccountExistsEmail(normalizedEmail, loginUrl).catch((err: Error) => {
        createRequestLogger((req as any).id || 'unknown', undefined, req.path).warn({
          msg: 'Failed to send account-exists email',
          err: { message: err.message, name: err.name }
        });
      });
      // Return same status + shape as successful signup (without tokens)
      return res.status(201).json({
        message: 'Account created. You can now sign in.',
      });
    }

    // Generate a unique username server-side so signup can stay minimal.
    normalizedUsername = await generateUniqueUsername(deriveUsernameSeed(data.fullName, normalizedEmail));

    // Hash password (bcrypt 12 rounds for production security)
    // 12 rounds ≈ 250ms on modern hardware - good balance of security and performance
    let hashedPassword: string | undefined;
    if (data.password) {
      hashedPassword = await bcrypt.hash(data.password, 12);
    }

    // Normalize category preference inputs across accepted payload variants.
    // Keep this defensive so omitted arrays default safely to [].
    const interestedCategories =
      data.preferences?.interestedCategories ??
      data.interestedCategories ??
      data.categories ??
      [];

    // Create new user with nested modular structure
    const newUser = new User({
      role: 'user',
      password: hashedPassword,
      auth: {
        email: data.email,
        emailVerified: !isEmailVerificationEnabled(),
        provider: 'email',
        createdAt: now,
        updatedAt: now
      },
      profile: {
        displayName: data.fullName,
        username: normalizedUsername,
        avatarColor: 'blue',
        phoneNumber: data.phoneNumber,
        pincode: data.pincode,
        city: data.city,
        country: data.country,
        gender: data.gender,
        dateOfBirth: data.dateOfBirth
      },
      security: {
        mfaEnabled: false
      },
      preferences: {
        theme: 'system',
        interestedCategories,
        notifications: {
          emailDigest: true,
          productUpdates: false,
          newFollowers: true
        }
      },
      appState: {
        onboardingCompleted: data.onboarding?.completed ?? false
      }
    });

    await newUser.save();

    // Send verification email only when explicitly enabled (fire-and-forget; do not block signup)
    if (isEmailVerificationEnabled() && process.env.RESEND_API_KEY && newUser.auth.provider === 'email') {
      const baseUrl = getEnv().FRONTEND_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
      const verificationToken = generateEmailVerificationToken(newUser._id.toString(), newUser.auth.email);
      const verificationUrl = `${baseUrl.replace(/\/$/, '')}/verify-email?token=${encodeURIComponent(verificationToken)}`;
      sendVerificationEmail(newUser.auth.email, verificationUrl).catch((err: Error) => {
        createRequestLogger((req as any).id || 'unknown', undefined, req.path).warn({
          msg: 'Failed to send verification email',
          err: { message: err.message, name: err.name }
        });
      });
    }

    // Generate tokens
    const accessToken = generateAccessToken(newUser._id.toString(), newUser.role, newUser.auth.email);

    // Generate and store refresh token (if token service available)
    let refreshToken: string | undefined;
    if (isTokenServiceAvailable()) {
      refreshToken = generateRefreshToken();
      const deviceInfo = req.headers['user-agent'] || 'Unknown device';
      const ipAddress = req.ip || req.socket.remoteAddress;
      await storeRefreshToken(newUser._id.toString(), refreshToken, deviceInfo, ipAddress);
    }

    // Return user data (without password) and tokens
    const userData = normalizeDoc(newUser);

    // Set HttpOnly auth cookies (primary auth mechanism)
    setAuthCookies(res, accessToken, refreshToken);
    const csrfToken = crypto.randomBytes(32).toString('hex');
    setCsrfCookie(res, csrfToken);

    res.status(201).json({
      message: 'Account created. You can now sign in.',
      user: userData,
      token: accessToken, // Legacy field name for backward compatibility
      accessToken,
      refreshToken, // Only present if Redis available
      csrfToken, // For double-submit CSRF pattern
      expiresIn: TOKEN_CONFIG.ACCESS_TOKEN_SECONDS,
    });
  } catch (error: any) {
    // Handle duplicate key error (MongoDB unique constraint)
    // This catches:
    // 1. Race conditions where another request created the user between our checks
    // 2. Stale index entries from deleted users (index not cleaned up)
    if (error.code === 11000) {
      const keyPattern = error.keyPattern || {};
      // Email race condition: return uniform 201 to prevent enumeration
      if (keyPattern['auth.email']) {
        const requestLogger = createRequestLogger((req as any).id || 'unknown', undefined, req.path);
        requestLogger.warn({ msg: 'Signup duplicate key race: auth.email. If unexpected, run: npm run fix-indexes' });
        // Send account-exists email (fire-and-forget)
        if (normalizedEmail) {
          const baseUrl = getEnv().FRONTEND_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
          const loginUrl = `${baseUrl.replace(/\/$/, '')}/login`;
          sendAccountExistsEmail(normalizedEmail, loginUrl).catch(() => {});
        }
        return res.status(201).json({
          message: 'Account created. You can now sign in.',
        });
      }
      // Retry with a fresh generated username in the rare event of race collisions.
      if (keyPattern['profile.username']) {
        const requestLogger = createRequestLogger((req as any).id || 'unknown', undefined, req.path);
        requestLogger.warn({ msg: 'Signup duplicate key race on generated profile.username - retrying once' });
        try {
          const retryData = signupSchema.parse(req.body);
          const now = new Date().toISOString();
          const retryUsername = await generateUniqueUsername(deriveUsernameSeed(retryData.fullName, retryData.email));
          const interestedCategories =
            retryData.preferences?.interestedCategories ??
            retryData.interestedCategories ??
            retryData.categories ??
            [];
          const hashedPassword = retryData.password ? await bcrypt.hash(retryData.password, 12) : undefined;
          const retryUser = new User({
            role: 'user',
            password: hashedPassword,
            auth: {
              email: retryData.email,
              emailVerified: !isEmailVerificationEnabled(),
              provider: 'email',
              createdAt: now,
              updatedAt: now
            },
            profile: {
              displayName: retryData.fullName,
              username: retryUsername,
              avatarColor: 'blue',
              phoneNumber: retryData.phoneNumber,
              pincode: retryData.pincode,
              city: retryData.city,
              country: retryData.country,
              gender: retryData.gender,
              dateOfBirth: retryData.dateOfBirth
            },
            security: { mfaEnabled: false },
            preferences: {
              theme: 'system',
              interestedCategories,
              notifications: { emailDigest: true, productUpdates: false, newFollowers: true }
            },
            appState: { onboardingCompleted: retryData.onboarding?.completed ?? false }
          });
          await retryUser.save();
          const accessToken = generateAccessToken(retryUser._id.toString(), retryUser.role, retryUser.auth.email);
          let refreshToken: string | undefined;
          if (isTokenServiceAvailable()) {
            refreshToken = generateRefreshToken();
            const deviceInfo = req.headers['user-agent'] || 'Unknown device';
            const ipAddress = req.ip || req.socket.remoteAddress;
            await storeRefreshToken(retryUser._id.toString(), refreshToken, deviceInfo, ipAddress);
          }
          setAuthCookies(res, accessToken, refreshToken);
          const csrfToken = crypto.randomBytes(32).toString('hex');
          setCsrfCookie(res, csrfToken);
          const userData = normalizeDoc(retryUser);
          return res.status(201).json({
            message: 'Account created. You can now sign in.',
            user: userData,
            token: accessToken,
            accessToken,
            refreshToken,
            csrfToken,
            expiresIn: TOKEN_CONFIG.ACCESS_TOKEN_SECONDS,
          });
        } catch (retryError) {
          requestLogger.error({ err: retryError }, 'Signup retry after username collision failed');
          return sendInternalError(res, 'Something went wrong on our end. Please try again in a moment.');
        }
      }
    }

    const requestLogger = createRequestLogger((req as any).id || 'unknown', undefined, req.path);
    requestLogger.error({
      msg: 'Signup failed',
      err: error instanceof Error ? { message: error.message, name: error.name } : { message: String(error) }
    });
    sendInternalError(res, 'Something went wrong on our end. Please try again in a moment.');
  }
};

/**
 * GET /api/auth/me
 * Get current user from token (requires authentication middleware)
 */
export const getMe = async (req: Request, res: Response) => {
  try {
    // This assumes req.user is set by authentication middleware
    const userId = (req as any).user?.userId;
    if (!userId) {
      return sendUnauthorizedError(res);
    }

    const user = await User.findById(userId).select('-password');
    if (!user) {
      return sendNotFoundError(res, 'User not found');
    }

    const userData = normalizeDoc(user);
    res.json(userData);
  } catch (error: any) {
    const requestLogger = createRequestLogger((req as any).id || 'unknown', (req as any).user?.userId, req.path);
    requestLogger.error({
      msg: 'Get me failed',
      err: error instanceof Error ? { message: error.message, name: error.name } : { message: String(error) }
    });
    sendInternalError(res);
  }
};

const resendVerificationSchema = z.object({
  email: z.string().email('Invalid email format').transform((s) => s.toLowerCase().trim())
});

/**
 * GET /api/auth/verify-email?token=...
 * Verify email using the token from the verification link.
 */
export const verifyEmail = async (req: Request, res: Response) => {
  try {
    if (!isEmailVerificationEnabled()) {
      return res.status(200).json({ message: 'Email verification is currently disabled.' });
    }

    const token = typeof req.query.token === 'string' ? req.query.token : undefined;
    if (!token) {
      return sendErrorResponse(res, 400, 'Verification token is required.', 'MISSING_TOKEN');
    }

    let payload: { userId: string; email: string };
    try {
      payload = verifyEmailVerificationToken(token);
    } catch {
      return sendErrorResponse(res, 400, 'Invalid or expired verification link.', 'INVALID_VERIFICATION_TOKEN');
    }

    const user = await User.findById(payload.userId);
    if (!user) {
      return sendErrorResponse(res, 400, 'Invalid or expired verification link.', 'INVALID_VERIFICATION_TOKEN');
    }
    if (user.auth.email !== payload.email) {
      return sendErrorResponse(res, 400, 'Invalid or expired verification link.', 'INVALID_VERIFICATION_TOKEN');
    }

    if (user.auth.emailVerified) {
      return res.status(200).json({ message: 'Email already verified.' });
    }

    user.auth.emailVerified = true;
    user.auth.updatedAt = new Date().toISOString();
    await user.save();

    res.status(200).json({ message: 'Email verified successfully.' });
  } catch (error: any) {
    const requestLogger = createRequestLogger((req as any).id || 'unknown', undefined, req.path);
    requestLogger.error({
      msg: 'Verify email failed',
      err: error instanceof Error ? { message: error.message, name: error.name } : { message: String(error) }
    });
    sendInternalError(res);
  }
};

/**
 * POST /api/auth/resend-verification
 * Body: { email: string }
 * Resend verification email. Rate-limited.
 */
export const resendVerification = async (req: Request, res: Response) => {
  try {
    if (!isEmailVerificationEnabled()) {
      return res.status(200).json({ message: 'Email verification is currently disabled.' });
    }

    const validationResult = resendVerificationSchema.safeParse(req.body);
    if (!validationResult.success) {
      const issues = getZodIssues(validationResult.error);
      const formattedMessage = issues.map((e) => e.message).join('. ');
      return sendValidationError(res, formattedMessage, issues.map((err) => ({
        path: err.path,
        message: err.message,
        code: err.code
      })));
    }

    const { email } = validationResult.data;

    const user = await User.findOne({ 'auth.email': email });
    if (!user) {
      // Same response whether user exists or not, to avoid enumeration
      return res.status(200).json({ message: 'If an account exists with this email, a verification link has been sent.' });
    }

    if (user.auth.emailVerified) {
      return sendErrorResponse(res, 400, 'Email is already verified.', 'ALREADY_VERIFIED');
    }

    if (user.auth.provider !== 'email') {
      return res.status(200).json({ message: 'If an account exists with this email, a verification link has been sent.' });
    }

    if (!process.env.RESEND_API_KEY) {
      return sendErrorResponse(res, 503, 'Email service is not configured. Please try again later.', 'EMAIL_NOT_CONFIGURED');
    }

    const baseUrl = getEnv().FRONTEND_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
    const verificationToken = generateEmailVerificationToken(user._id.toString(), user.auth.email);
    const verificationUrl = `${baseUrl.replace(/\/$/, '')}/verify-email?token=${encodeURIComponent(verificationToken)}`;

    await sendVerificationEmail(user.auth.email, verificationUrl);

    res.status(200).json({ message: 'If an account exists with this email, a verification link has been sent.' });
  } catch (error: any) {
    const requestLogger = createRequestLogger((req as any).id || 'unknown', undefined, req.path);
    requestLogger.error({
      msg: 'Resend verification failed',
      err: error instanceof Error ? { message: error.message, name: error.name } : { message: String(error) }
    });
    sendInternalError(res);
  }
};

// ============================================================================
// TOKEN REFRESH & LOGOUT
// ============================================================================

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

/**
 * POST /api/auth/refresh
 * Exchange a valid refresh token for new access and refresh tokens
 *
 * Security: Implements refresh token rotation - old token is invalidated
 */
export const refreshAccessToken = async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger((req as any).id || 'unknown', undefined, req.path);

  try {
    // Check if token service is available
    if (!isTokenServiceAvailable()) {
      return sendErrorResponse(res, 503, 'Token refresh service unavailable', 'SERVICE_UNAVAILABLE');
    }

    // Validate input — accept refresh token from body or HttpOnly cookie
    const bodyToken = req.body?.refreshToken;
    const cookieRefreshToken = (req as any).cookies?.refresh_token as string | undefined;
    const refreshTokenInput = bodyToken || cookieRefreshToken;

    if (!refreshTokenInput || typeof refreshTokenInput !== 'string' || refreshTokenInput.length === 0) {
      return sendValidationError(res, 'Refresh token is required', [{
        path: ['refreshToken'],
        message: 'Refresh token is required',
        code: 'too_small' as const,
      }]);
    }

    const oldRefreshToken = refreshTokenInput;

    // Resolve user identity from refresh token index first (refresh token is the source of truth).
    let userId = await getUserIdFromRefreshToken(oldRefreshToken);

    // Backward-compatibility fallback: older refresh tokens may not have an index entry.
    // In that case, attempt to decode access token if present.
    const authHeader = req.headers['authorization'];
    const headerAccessToken = authHeader && authHeader.split(' ')[1];
    const cookieAccessToken = (req as any).cookies?.access_token as string | undefined;
    const accessTokenForFallback = headerAccessToken || cookieAccessToken;
    if (!userId && accessTokenForFallback) {
      const { decodeTokenUnsafe } = await import('../utils/jwt.js');
      const decoded = decodeTokenUnsafe(accessTokenForFallback);
      if (decoded?.userId) {
        userId = decoded.userId;
      }
    }

    if (!userId) {
      return sendUnauthorizedError(res, 'Invalid or expired refresh token');
    }

    // Validate refresh token
    // CRITICAL: Distinguish between "token not found" (→ 401) and "Redis down" (→ 503)
    // Returning 503 prevents the frontend from misinterpreting a Redis outage as an invalid token
    let tokenData;
    try {
      tokenData = await validateRefreshToken(userId, oldRefreshToken);
    } catch (error: unknown) {
      const isRedisError =
        error instanceof RedisUnavailableError ||
        (error instanceof Error && error.message === 'Redis connection lost');

      if (isRedisError) {
        requestLogger.warn({
          msg: 'Redis unavailable during refresh token validation - retrying after delay',
          userId
        });
        // Wait briefly for Redis to recover, then retry once
        await new Promise(resolve => setTimeout(resolve, 1000));
        try {
          tokenData = await validateRefreshToken(userId, oldRefreshToken);
        } catch (retryError: unknown) {
          const retryMsg = retryError instanceof Error ? retryError.message : String(retryError);
          requestLogger.error({
            msg: 'Refresh token validation failed after retry - Redis still unavailable',
            userId,
            err: { message: retryMsg }
          });
          return sendErrorResponse(res, 503, 'Token service temporarily unavailable. Please try again in a moment.', 'SERVICE_UNAVAILABLE');
        }
      } else {
        const errMsg = error instanceof Error ? error.message : String(error);
        requestLogger.error({
          msg: 'Unexpected error during refresh token validation',
          userId,
          err: { message: errMsg }
        });
        return sendErrorResponse(res, 500, 'Token validation failed', 'VALIDATION_ERROR');
      }
    }

    if (!tokenData) {
      requestLogger.warn({
        msg: 'Invalid refresh token attempt',
        userId,
        hasRefreshToken: !!oldRefreshToken,
        tokenServiceAvailable: isTokenServiceAvailable()
      });
      return sendUnauthorizedError(res, 'Invalid or expired refresh token');
    }

    requestLogger.debug({ 
      msg: 'Refresh token validated', 
      userId,
      tokenCreatedAt: tokenData.createdAt,
      tokenExpiresAt: tokenData.expiresAt
    });

    // Rotate refresh token (invalidates old one, issues new one)
    const deviceInfo = req.headers['user-agent'] || 'Unknown device';
    const ipAddress = req.ip || req.socket.remoteAddress;
    
    requestLogger.debug({ msg: 'Attempting token rotation', userId });
    const newRefreshToken = await rotateRefreshToken(userId, oldRefreshToken, deviceInfo, ipAddress);

    if (!newRefreshToken) {
      requestLogger.error({ 
        msg: 'Token rotation failed', 
        userId,
        error: 'rotateRefreshToken returned null'
      });
      return sendErrorResponse(res, 500, 'Failed to rotate refresh token', 'TOKEN_ROTATION_FAILED');
    }

    requestLogger.debug({ msg: 'Token rotation successful', userId });

    // Fetch user to generate new access token
    const user = await User.findById(userId).select('role auth.email');
    if (!user) {
      return sendNotFoundError(res, 'User not found');
    }

    // Generate new access token
    const accessToken = generateAccessToken(user._id.toString(), user.role, user.auth.email);

    requestLogger.info({ msg: 'Token refreshed successfully', userId });

    // Set HttpOnly auth cookies with refreshed tokens
    setAuthCookies(res, accessToken, newRefreshToken);
    const csrfToken = crypto.randomBytes(32).toString('hex');
    setCsrfCookie(res, csrfToken);

    res.json({
      token: accessToken, // Legacy field
      accessToken,
      refreshToken: newRefreshToken,
      csrfToken,
      expiresIn: TOKEN_CONFIG.ACCESS_TOKEN_SECONDS,
    });
  } catch (error: any) {
    requestLogger.error({
      msg: 'Token refresh failed',
      err: error instanceof Error ? { message: error.message, name: error.name } : { message: String(error) },
    });
    sendInternalError(res);
  }
};

/**
 * POST /api/auth/logout
 * Logout current session - blacklists access token and revokes refresh token
 *
 * Requires authentication (access token in header)
 * Optional: refreshToken in body to revoke that specific refresh token
 */
export const logout = async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger((req as any).id || 'unknown', (req as any).user?.userId, req.path);

  try {
    const userId = (req as any).user?.userId;
    const currentToken = (req as any).token;

    if (!userId || !currentToken) {
      return sendUnauthorizedError(res, 'Authentication required');
    }

    // Blacklist the current access token
    const remainingSeconds = getTokenRemainingSeconds(currentToken);
    if (remainingSeconds > 0) {
      await blacklistToken(currentToken, remainingSeconds);
    }

    // Revoke refresh token — from body or HttpOnly cookie
    const bodyRefreshToken = req.body?.refreshToken;
    const cookieRefreshToken = (req as any).cookies?.refresh_token as string | undefined;
    const refreshToken = (typeof bodyRefreshToken === 'string' && bodyRefreshToken) || cookieRefreshToken;
    if (refreshToken) {
      await revokeRefreshToken(userId, refreshToken);
    }

    requestLogger.info({ msg: 'User logged out', userId });

    clearAuthCookies(res);
    res.json({
      message: 'Logged out successfully',
    });
  } catch (error: any) {
    requestLogger.error({
      msg: 'Logout failed',
      err: error instanceof Error ? { message: error.message, name: error.name } : { message: String(error) },
    });
    // Still return success - logout should be idempotent
    clearAuthCookies(res);
    res.json({
      message: 'Logged out successfully',
    });
  }
};

/**
 * POST /api/auth/logout-all
 * Logout from all devices - revokes all refresh tokens
 *
 * Requires authentication
 */
export const logoutAll = async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger((req as any).id || 'unknown', (req as any).user?.userId, req.path);

  try {
    const userId = (req as any).user?.userId;
    const currentToken = (req as any).token;

    if (!userId || !currentToken) {
      return sendUnauthorizedError(res, 'Authentication required');
    }

    // Blacklist current access token
    const remainingSeconds = getTokenRemainingSeconds(currentToken);
    if (remainingSeconds > 0) {
      await blacklistToken(currentToken, remainingSeconds);
    }

    // Revoke all refresh tokens for this user
    await revokeAllRefreshTokens(userId);

    requestLogger.info({ msg: 'User logged out from all devices', userId });

    clearAuthCookies(res);
    res.json({
      message: 'Logged out from all devices successfully',
    });
  } catch (error: any) {
    requestLogger.error({
      msg: 'Logout all failed',
      err: error instanceof Error ? { message: error.message, name: error.name } : { message: String(error) },
    });
    // Still return success
    clearAuthCookies(res);
    res.json({
      message: 'Logged out from all devices successfully',
    });
  }
};

/**
 * GET /api/auth/sessions
 * Get all active sessions for the current user
 *
 * Requires authentication
 */
export const getSessions = async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger((req as any).id || 'unknown', (req as any).user?.userId, req.path);

  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      return sendUnauthorizedError(res, 'Authentication required');
    }

    // Check if token service is available
    if (!isTokenServiceAvailable()) {
      return res.json({ sessions: [], message: 'Session tracking not available' });
    }

    const sessions = await getUserSessions(userId);

    res.json({
      sessions,
      count: sessions.length,
    });
  } catch (error: any) {
    requestLogger.error({
      msg: 'Get sessions failed',
      err: error instanceof Error ? { message: error.message, name: error.name } : { message: String(error) },
    });
    sendInternalError(res);
  }
};

// ============================================================================
// PASSWORD RESET
// ============================================================================

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format').transform((s) => s.toLowerCase().trim()),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});

/**
 * POST /api/auth/forgot-password
 * Request a password reset email
 *
 * Security: Always returns success to prevent email enumeration
 */
export const forgotPassword = async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger((req as any).id || 'unknown', undefined, req.path);

  try {
    // Validate input
    const validationResult = forgotPasswordSchema.safeParse(req.body);
    if (!validationResult.success) {
      // Still return success to prevent enumeration
      return res.status(200).json({
        message: 'If an account exists with this email, a password reset link has been sent.',
      });
    }

    const { email } = validationResult.data;

    // Find user
    const user = await User.findOne({ 'auth.email': email });

    // Always return same response to prevent enumeration
    const successMessage = 'If an account exists with this email, a password reset link has been sent.';

    if (!user) {
      return res.status(200).json({ message: successMessage });
    }

    // Don't send reset emails to social auth users
    if (user.auth.provider !== 'email') {
      requestLogger.info({ msg: 'Password reset attempted for social auth user', provider: user.auth.provider });
      return res.status(200).json({ message: successMessage });
    }

    // Check if email service is configured
    if (!process.env.RESEND_API_KEY) {
      requestLogger.warn({ msg: 'Password reset requested but RESEND_API_KEY not configured' });
      return sendErrorResponse(res, 503, 'Email service is not configured. Please contact support.', 'EMAIL_NOT_CONFIGURED');
    }

    // Generate reset token
    const resetToken = generatePasswordResetToken(user._id.toString(), user.auth.email);
    const baseUrl = getEnv().FRONTEND_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${baseUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(resetToken)}`;

    // Send email (fire-and-forget to avoid timing attacks)
    sendPasswordResetEmail(user.auth.email, resetUrl).catch((err: Error) => {
      requestLogger.error({
        msg: 'Failed to send password reset email',
        err: { message: err.message, name: err.name },
      });
    });

    requestLogger.info({ msg: 'Password reset email sent', userId: user._id.toString() });

    res.status(200).json({ message: successMessage });
  } catch (error: any) {
    requestLogger.error({
      msg: 'Forgot password failed',
      err: error instanceof Error ? { message: error.message, name: error.name } : { message: String(error) },
    });
    // Still return success to prevent timing attacks
    res.status(200).json({
      message: 'If an account exists with this email, a password reset link has been sent.',
    });
  }
};

/**
 * POST /api/auth/reset-password
 * Reset password using the token from email
 */
export const resetPassword = async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger((req as any).id || 'unknown', undefined, req.path);

  try {
    // Validate input
    const validationResult = resetPasswordSchema.safeParse(req.body);
    if (!validationResult.success) {
      const issues = getZodIssues(validationResult.error);
      const formattedMessage = formatValidationErrors(issues);
      return sendValidationError(res, formattedMessage, issues.map(err => ({
        path: err.path,
        message: err.message,
        code: err.code,
      })));
    }

    const { token, password } = validationResult.data;

    // Verify token
    let payload: { userId: string; email: string };
    try {
      payload = verifyPasswordResetToken(token);
    } catch {
      return sendErrorResponse(res, 400, 'Invalid or expired reset link. Please request a new one.', 'INVALID_RESET_TOKEN');
    }

    // Find user
    const user = await User.findById(payload.userId).select('+password');
    if (!user) {
      return sendErrorResponse(res, 400, 'Invalid or expired reset link. Please request a new one.', 'INVALID_RESET_TOKEN');
    }

    // Verify email matches (prevents token reuse after email change)
    if (user.auth.email !== payload.email) {
      return sendErrorResponse(res, 400, 'Invalid or expired reset link. Please request a new one.', 'INVALID_RESET_TOKEN');
    }

    // Hash new password (12 rounds for security)
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update password
    user.password = hashedPassword;
    user.security.lastPasswordChangeAt = new Date().toISOString();
    user.auth.updatedAt = new Date().toISOString();
    await user.save();

    // Revoke all refresh tokens (force re-login on all devices)
    await revokeAllRefreshTokens(user._id.toString());

    requestLogger.info({ msg: 'Password reset successful', userId: user._id.toString() });

    res.status(200).json({
      message: 'Password reset successful. Please sign in with your new password.',
    });
  } catch (error: any) {
    requestLogger.error({
      msg: 'Reset password failed',
      err: error instanceof Error ? { message: error.message, name: error.name } : { message: String(error) },
    });
    sendInternalError(res);
  }
};
