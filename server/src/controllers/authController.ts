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

// Validation Schemas
const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required')
});

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
  username: z.string().min(3, 'Username must be at least 3 characters').transform(val => val.toLowerCase().trim()),
  email: z.string().email('Invalid email format'),
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
    const user = await User.findOne({ 'auth.email': email.toLowerCase() })
      .select('+password');
    
    if (!user) {
      return sendUnauthorizedError(res, 'Invalid email or password');
    }

    // Check password (if user has one - social auth users may not)
    if (user.password) {
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return sendUnauthorizedError(res, 'Invalid email or password');
      }
    } else {
      // User exists but has no password (social auth only)
      return sendUnauthorizedError(res, 'This account was created with social login. Please use social login to continue.');
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
    console.error('[Auth] Login error:', error);
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

    // Normalize email and username for checking
    normalizedEmail = data.email.toLowerCase().trim();
    normalizedUsername = data.username.toLowerCase().trim();
    
    // Check if email already exists
    // Try exact match first, then case-insensitive regex as fallback
    existingUser = await User.findOne({ 
      'auth.email': normalizedEmail
    });
    
    // If not found with exact match, try case-insensitive search (handles edge cases)
    if (!existingUser) {
      existingUser = await User.findOne({
        $expr: {
          $eq: [
            { $toLower: { $trim: { input: '$auth.email' } } },
            normalizedEmail
          ]
        }
      });
    }
    
    // Log for debugging
    if (existingUser) {
      console.log('[Signup] Email conflict - Found existing user:', {
        id: existingUser._id.toString(),
        email: existingUser.auth?.email,
        username: existingUser.profile?.username,
        requestedEmail: normalizedEmail
      });
    }
    
    if (existingUser) {
      return sendConflictError(res, 'Email already registered', 'EMAIL_ALREADY_EXISTS');
    }

    // Check if username already exists (case-insensitive)
    existingUsername = await User.findOne({ 
      'profile.username': normalizedUsername
    });
    
    if (existingUsername) {
      console.log('[Signup] Username conflict - Found existing user:', {
        id: existingUsername._id.toString(),
        email: existingUsername.auth?.email,
        username: existingUsername.profile?.username,
        requestedUsername: normalizedUsername
      });
      
      return sendConflictError(res, 'Username already taken', 'USERNAME_ALREADY_EXISTS');
    }

    // Hash password if provided
    let hashedPassword: string | undefined;
    if (data.password) {
      hashedPassword = await bcrypt.hash(data.password, 10);
    }

    // Create new user with nested modular structure
    const newUser = new User({
      role: 'user',
      password: hashedPassword,
      auth: {
        email: data.email.toLowerCase(),
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
        defaultVisibility: 'public',
        interestedCategories: [],
        compactMode: false,
        richMediaPreviews: true,
        autoFollowCollections: true,
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
    console.error('[Auth] Signup error:', error);
    
    // Handle duplicate key error (MongoDB unique constraint)
    // This catches:
    // 1. Race conditions where another request created the user between our checks
    // 2. Stale index entries from deleted users (index not cleaned up)
    if (error.code === 11000) {
      const keyPattern = error.keyPattern || {};
      const keyValue = error.keyValue || {};
      
      // Enhanced logging for debugging stale index issues
      console.log('[Auth] MongoDB duplicate key error (11000):', {
        keyPattern,
        keyValue,
        attemptedEmail: normalizedEmail,
        attemptedUsername: normalizedUsername,
        findOneFoundUser: !!existingUser,
        findOneFoundUsername: !!existingUsername
      });
      
      // Use helper to handle duplicate key error
      const handled = handleDuplicateKeyError(res, error, {
        'auth.email': { message: 'Email already registered', code: 'EMAIL_ALREADY_EXISTS' },
        'profile.username': { message: 'Username already taken', code: 'USERNAME_ALREADY_EXISTS' }
      });
      
      if (handled) {
        // Check for stale index issues
        if (keyPattern['auth.email'] && !existingUser) {
          console.warn('[Auth] STALE INDEX DETECTED: MongoDB index blocks email but no user found in database.');
          console.warn('[Auth] Email in index:', keyValue['auth.email']);
          console.warn('[Auth] This indicates a stale index entry. Run: npm run fix-indexes');
        }
        if (keyPattern['profile.username'] && !existingUsername) {
          console.warn('[Auth] STALE INDEX DETECTED: MongoDB index blocks username but no user found in database.');
          console.warn('[Auth] Username in index:', keyValue['profile.username']);
          console.warn('[Auth] This indicates a stale index entry. Run: npm run fix-indexes');
        }
        return;
      }
    }
    
    // Generic error handler - log full error for debugging
    console.error('[Auth] Signup error details:', {
      error: error.message,
      stack: error.stack,
      attemptedEmail: normalizedEmail || 'unknown',
      attemptedUsername: normalizedUsername || 'unknown',
      errorCode: error.code,
      errorName: error.name
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
    console.error('[Auth] Get me error:', error);
    sendInternalError(res);
  }
};
