import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { normalizeDoc } from '../utils/db.js';
import { generateToken } from '../utils/jwt.js';
import { z } from 'zod';
import {
  sendErrorResponse,
  sendValidationError,
  sendUnauthorizedError,
  sendNotFoundError,
  sendConflictError,
  sendInternalError,
  handleDuplicateKeyError
} from '../utils/errorResponse.js';
import { createRequestLogger } from '../utils/logger.js';

// Validation Schemas — email normalized for consistent lookups and user-enumeration resistance
const loginSchema = z.object({
  email: z.string().email('Invalid email format').transform((s) => s.toLowerCase().trim()),
  password: z.string().min(1, 'Password is required')
});

// Generic login failure message to prevent user enumeration
const LOGIN_FAILURE_MSG = 'Invalid email or password';

// Helper function to format validation errors into user-friendly messages
function formatValidationErrors(errors: z.ZodError['errors']): string {
  const errorMessages: string[] = [];
  
  errors.forEach((error) => {
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
  username: z.string().min(3, 'Username must be at least 3 characters').transform((val) => val.toLowerCase().trim()),
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
  phoneNumber: z.string().optional()
}).strict();


/**
 * POST /api/auth/login
 * Login with email and password
 */
export const login = async (req: Request, res: Response) => {
  try {
    // Validate input
    const validationResult = loginSchema.safeParse(req.body);
    if (!validationResult.success) {
      const formattedMessage = formatValidationErrors(validationResult.error.errors);
      const errors = validationResult.error.errors.map(err => ({
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

    // Find user by email (password field is excluded by default, so we need to select it)
    const user = await User.findOne({ 'auth.email': email })
      .select('+password');

    if (!user) {
      return sendUnauthorizedError(res, LOGIN_FAILURE_MSG);
    }

    // Check password (if user has one - social auth users may not)
    // bcrypt.compare is timing-safe
    if (user.password) {
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return sendUnauthorizedError(res, LOGIN_FAILURE_MSG);
      }
    } else {
      // User exists but has no password (social auth only) — same generic message to avoid enumeration
      return sendUnauthorizedError(res, LOGIN_FAILURE_MSG);
    }

    // Update last login time
    user.appState.lastLoginAt = new Date().toISOString();
    await user.save();

    // Generate token with userId and role
    const token = generateToken(user._id.toString(), user.role, user.auth.email);

    // Return user data (without password) and token
    const userData = normalizeDoc(user);
    res.json({ user: userData, token });
  } catch (error: any) {
    const requestLogger = createRequestLogger((req as any).id || 'unknown', undefined, req.path);
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
  let existingUsername: any = null;
  
  try {
    // Validate input
    const validationResult = signupSchema.safeParse(req.body);
    if (!validationResult.success) {
      const formattedMessage = formatValidationErrors(validationResult.error.errors);
      const errors = validationResult.error.errors.map(err => ({
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

    // Schema already normalizes email and username
    normalizedEmail = data.email;
    normalizedUsername = data.username;

    // Check if email already exists
    existingUser = await User.findOne({ 'auth.email': normalizedEmail });
    if (existingUser) {
      return sendConflictError(res, 'Email already registered', 'EMAIL_ALREADY_EXISTS');
    }

    // Check if username already exists (case-insensitive)
    existingUsername = await User.findOne({ 'profile.username': normalizedUsername });
    if (existingUsername) {
      return sendConflictError(res, 'Username already taken', 'USERNAME_ALREADY_EXISTS');
    }

    // Hash password (bcrypt 10 rounds; NIST-acceptable; consider 12 for higher security)
    let hashedPassword: string | undefined;
    if (data.password) {
      hashedPassword = await bcrypt.hash(data.password, 10);
    }

    // Create new user with nested modular structure
    const newUser = new User({
      role: 'user',
      password: hashedPassword,
      auth: {
        email: data.email,
        emailVerified: false,
        provider: 'email',
        createdAt: now,
        updatedAt: now
      },
      profile: {
        displayName: data.fullName,
        username: normalizedUsername, // Already normalized above
        avatarColor: 'blue',
        phoneNumber: data.phoneNumber,
        pincode: data.pincode,
        city: data.city,
        country: data.country,
        gender: data.gender
      },
      security: {
        mfaEnabled: false
      },
      preferences: {
        theme: 'system',
        interestedCategories: [],
        notifications: {
          emailDigest: true,
          productUpdates: false,
          newFollowers: true
        }
      },
      appState: {
        onboardingCompleted: false
      }
    });

    await newUser.save();

    // Generate token with userId and role
    const token = generateToken(newUser._id.toString(), newUser.role, newUser.auth.email);

    // Return user data (without password) and token
    const userData = normalizeDoc(newUser);
    res.status(201).json({ user: userData, token });
  } catch (error: any) {
    // Handle duplicate key error (MongoDB unique constraint)
    // This catches:
    // 1. Race conditions where another request created the user between our checks
    // 2. Stale index entries from deleted users (index not cleaned up)
    if (error.code === 11000) {
      const keyPattern = error.keyPattern || {};
      const handled = handleDuplicateKeyError(res, error, {
        'auth.email': { message: 'Email already registered', code: 'EMAIL_ALREADY_EXISTS' },
        'profile.username': { message: 'Username already taken', code: 'USERNAME_ALREADY_EXISTS' }
      });
      if (handled) {
        // Log only field names for stale-index diagnostics; no PII
        if (keyPattern['auth.email']) {
          const requestLogger = createRequestLogger((req as any).id || 'unknown', undefined, req.path);
          requestLogger.warn({ msg: 'Signup duplicate key: auth.email. If unexpected, run: npm run fix-indexes' });
        }
        if (keyPattern['profile.username']) {
          const requestLogger = createRequestLogger((req as any).id || 'unknown', undefined, req.path);
          requestLogger.warn({ msg: 'Signup duplicate key: profile.username. If unexpected, run: npm run fix-indexes' });
        }
        return;
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
