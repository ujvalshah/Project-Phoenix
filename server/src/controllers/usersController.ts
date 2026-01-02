import { Request, Response } from 'express';
import { User } from '../models/User.js';
import { normalizeDoc, normalizeDocs } from '../utils/db.js';
import { Article } from '../models/Article.js';
import { updateUserSchema } from '../utils/validation.js';
import { createSearchRegex } from '../utils/escapeRegExp.js';
import { createRequestLogger } from '../utils/logger.js';
import { captureException } from '../utils/sentry.js';

export const getUsers = async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 25, 1), 100);
    const skip = (page - 1) * limit;

    const query: any = {};
    // SECURITY: createSearchRegex escapes user input to prevent ReDoS
    if (q && typeof q === 'string' && q.trim().length > 0) {
      const regex = createSearchRegex(q);
      query.$or = [
        { 'profile.displayName': regex },
        { 'profile.username': regex },
        { 'auth.email': regex }
      ];
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password')
        .sort({ 'auth.createdAt': -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(query)
    ]);

    res.json({
      data: normalizeDocs(users),
      total,
      page,
      limit,
      hasMore: page * limit < total
    });
  } catch (error: any) {
    // Audit Phase-1 Fix: Use structured logging and Sentry capture
    const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.userId, req.path);
    requestLogger.error({
      msg: '[Users] Get users error',
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
    captureException(error instanceof Error ? error : new Error(String(error)), { requestId: req.id, route: req.path });
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getUserById = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(normalizeDoc(user));
  } catch (error: any) {
    // Audit Phase-1 Fix: Use structured logging and Sentry capture
    const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.userId, req.path);
    requestLogger.error({
      msg: '[Users] Get user by ID error',
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
    captureException(error instanceof Error ? error : new Error(String(error)), { requestId: req.id, route: req.path });
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    // Validate input
    const validationResult = updateUserSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: validationResult.error.errors 
      });
    }

    // Don't allow password updates through this endpoint (use separate change password endpoint)
    const { password, ...updateData } = validationResult.data;
    
    const userId = req.params.id;
    
    // Check for email uniqueness if email is being updated
    if (updateData.email) {
      const normalizedEmail = updateData.email.toLowerCase();
      const existingUser = await User.findOne({ 
        'auth.email': normalizedEmail,
        _id: { $ne: userId } // Exclude current user
      });
      if (existingUser) {
        return res.status(409).json({ 
          message: 'Email already registered',
          code: 'EMAIL_ALREADY_EXISTS'
        });
      }
    }
    
    // Check for username uniqueness if username is being updated
    if (updateData.profile?.username) {
      const normalizedUsername = updateData.profile.username.toLowerCase().trim();
      const existingUsername = await User.findOne({ 
        'profile.username': normalizedUsername,
        _id: { $ne: userId } // Exclude current user
      });
      if (existingUsername) {
        return res.status(409).json({ 
          message: 'Username already taken',
          code: 'USERNAME_ALREADY_EXISTS'
        });
      }
      // Normalize username in update data
      updateData.profile.username = normalizedUsername;
    }
    
    // Build update object for nested structure
    const updateObj: any = {};
    
    // Handle flat fields that map to nested structure (for backward compatibility)
    if (updateData.name) {
      updateObj['profile.displayName'] = updateData.name;
    }
    if (updateData.email) {
      updateObj['auth.email'] = updateData.email.toLowerCase();
      updateObj['auth.updatedAt'] = new Date().toISOString();
    }
    if (updateData.role !== undefined) {
      updateObj.role = updateData.role;
    }
    if (updateData.preferences) {
      updateObj['preferences.interestedCategories'] = updateData.preferences.interestedCategories;
    }
    if (updateData.lastFeedVisit) {
      updateObj['appState.lastLoginAt'] = updateData.lastFeedVisit;
    }
    // Handle legacy flat profile fields
    if (updateData.bio !== undefined) {
      updateObj['profile.bio'] = updateData.bio;
    }
    if (updateData.location !== undefined) {
      updateObj['profile.location'] = updateData.location;
    }
    if (updateData.website !== undefined) {
      updateObj['profile.website'] = updateData.website;
    }
    if (updateData.avatarUrl !== undefined) {
      updateObj['profile.avatarUrl'] = updateData.avatarUrl;
    }
    if (updateData.title !== undefined) {
      updateObj['profile.title'] = updateData.title;
    }
    if (updateData.company !== undefined) {
      updateObj['profile.company'] = updateData.company;
    }
    if (updateData.twitter !== undefined) {
      updateObj['profile.twitter'] = updateData.twitter;
    }
    if (updateData.linkedin !== undefined) {
      updateObj['profile.linkedin'] = updateData.linkedin;
    }
    if (updateData.youtube !== undefined) {
      updateObj['profile.youtube'] = updateData.youtube;
    }
    if (updateData.instagram !== undefined) {
      updateObj['profile.instagram'] = updateData.instagram;
    }
    if (updateData.facebook !== undefined) {
      updateObj['profile.facebook'] = updateData.facebook;
    }
    
    // Handle direct nested updates if provided
    if (updateData.profile) {
      Object.assign(updateObj, Object.keys(updateData.profile).reduce((acc, key) => {
        acc[`profile.${key}`] = (updateData.profile as any)[key];
        return acc;
      }, {} as any));
    }
    if (updateData.preferences && typeof updateData.preferences === 'object') {
      Object.keys(updateData.preferences).forEach(key => {
        if (key === 'notifications') {
          Object.keys((updateData.preferences as any).notifications || {}).forEach(nKey => {
            updateObj[`preferences.notifications.${nKey}`] = (updateData.preferences as any).notifications[nKey];
          });
        } else {
          updateObj[`preferences.${key}`] = (updateData.preferences as any)[key];
        }
      });
    }
    
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updateObj },
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(normalizeDoc(user));
  } catch (error: any) {
    // Audit Phase-1 Fix: Use structured logging and Sentry capture
    const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.userId, req.path);
    requestLogger.error({
      msg: '[Users] Update user error',
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
    captureException(error instanceof Error ? error : new Error(String(error)), { requestId: req.id, route: req.path });
    
    // Handle duplicate key error (MongoDB unique constraint)
    if (error.code === 11000) {
      const keyPattern = error.keyPattern || {};
      let code = 'EMAIL_ALREADY_EXISTS';
      let message = 'Email already registered';
      
      if (keyPattern['auth.email']) {
        code = 'EMAIL_ALREADY_EXISTS';
        message = 'Email already registered';
      } else if (keyPattern['profile.username']) {
        code = 'USERNAME_ALREADY_EXISTS';
        message = 'Username already taken';
      }
      
      return res.status(409).json({ 
        message,
        code
      });
    }
    
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.status(204).send();
  } catch (error: any) {
    // Audit Phase-1 Fix: Use structured logging and Sentry capture
    const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.userId, req.path);
    requestLogger.error({
      msg: '[Users] Delete user error',
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
    captureException(error instanceof Error ? error : new Error(String(error)), { requestId: req.id, route: req.path });
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getPersonalizedFeed = async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get user's interested categories from nested preferences
    const categories = user.preferences?.interestedCategories || [];
    const lastVisit = user.appState?.lastLoginAt 
      ? new Date(user.appState.lastLoginAt) 
      : new Date(0);
    
    // Build MongoDB query for articles matching user's interests
    // PRIVACY FIX: Only show public articles in personalized feed
    // The $or was incorrectly structured - it would match ANY condition, including private articles
    const articleQuery: any = {
      visibility: 'public', // Only public articles in personalized feed
      $or: [
        { categories: { $in: categories } },
        { category: { $in: categories } }
      ]
    };
    
    // If user has no categories, show all public articles
    if (categories.length === 0) {
      delete articleQuery.$or;
      articleQuery.visibility = 'public';
    }
    
    // Find articles matching user's interests (only public)
    const articles = await Article.find(articleQuery)
      .sort({ publishedAt: -1 })
      .limit(50); // Limit to 50 articles

    // Count new articles since last feed visit using MongoDB query (more efficient)
    // PRIVACY FIX: Ensure privacy filter is applied to count query
    const countQuery = {
      ...articleQuery,
      publishedAt: { $gt: lastVisit.toISOString() }
    };
    const newCount = await Article.countDocuments(countQuery);

    // Update last feed visit using findByIdAndUpdate (atomic operation)
    await User.findByIdAndUpdate(
      userId,
      { $set: { 'appState.lastLoginAt': new Date().toISOString() } },
      { new: false } // Don't need to return updated document
    );

    res.json({ 
      articles: normalizeDocs(articles), 
      newCount 
    });
  } catch (error: any) {
    // Audit Phase-1 Fix: Use structured logging and Sentry capture
    const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.userId, req.path);
    requestLogger.error({
      msg: '[Users] Get personalized feed error',
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
    captureException(error instanceof Error ? error : new Error(String(error)), { requestId: req.id, route: req.path });
    res.status(500).json({ message: 'Internal server error' });
  }
};
