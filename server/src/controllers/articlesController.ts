import { Request, Response } from 'express';
import { Article } from '../models/Article.js';
import { Tag } from '../models/Tag.js';
import { normalizeDoc, normalizeDocs } from '../utils/db.js';
import { createArticleSchema, updateArticleSchema } from '../utils/validation.js';
import { cleanupCollectionEntries } from '../utils/collectionHelpers.js';
import { escapeRegExp, createSearchRegex, createExactMatchRegex } from '../utils/escapeRegExp.js';
import { verifyToken } from '../utils/jwt.js';
import { createRequestLogger } from '../utils/logger.js';
import { captureException } from '../utils/sentry.js';
import {
  sendErrorResponse,
  sendValidationError,
  sendUnauthorizedError,
  sendForbiddenError,
  sendNotFoundError,
  sendPayloadTooLargeError,
  sendInternalError
} from '../utils/errorResponse.js';

/**
 * Optionally extract user from token (for privacy filtering)
 * Returns userId if token is present and valid, otherwise undefined
 * Does not throw errors - silently fails if token is missing/invalid
 */
function getOptionalUserId(req: Request): string | undefined {
  // First check if middleware already set req.user
  if ((req as any).user?.userId) {
    return (req as any).user.userId;
  }
  
  // Try to extract from Authorization header
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  if (!token) {
    return undefined;
  }
  
  try {
    const decoded = verifyToken(token);
    return decoded.userId;
  } catch (error) {
    // Token invalid/expired - silently ignore (this is optional auth)
    return undefined;
  }
}

/**
 * Phase 2: Resolve tag IDs from category names
 * Maps category names to Tag ObjectIds for stable references
 */
async function resolveCategoryIds(categoryNames: string[]): Promise<string[]> {
  if (!categoryNames || categoryNames.length === 0) {
    return [];
  }

  try {
    // Find tags by canonical name (case-insensitive)
    const canonicalNames = categoryNames.map(name => name.trim().toLowerCase());
    const tags = await Tag.find({
      canonicalName: { $in: canonicalNames }
    }).lean();

    // Map found tags to their ObjectIds
    const tagMap = new Map(tags.map(tag => [tag.canonicalName, tag._id.toString()]));
    
    // Return IDs in the same order as input names
    const categoryIds = canonicalNames
      .map(canonical => tagMap.get(canonical))
      .filter((id): id is string => id !== undefined);

    // Audit Phase-3 Fix: Logging consistency - use structured logging (no req context here, so skip requestId)
    return categoryIds;
  } catch (error: any) {
    // Audit Phase-3 Fix: Logging consistency - use structured logger (no req context in helper function)
    const { getLogger } = await import('../utils/logger.js');
    getLogger().warn({ msg: 'Error resolving category IDs', error: { message: error.message } });
    return []; // Fail gracefully - categoryIds is optional
  }
}

export const getArticles = async (req: Request, res: Response) => {
  try {
    const { authorId, q, category, categories, sort } = req.query;
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 25, 1), 100);
    const skip = (page - 1) * limit;
    
    // Get current user from token (optional - for privacy filtering)
    // This allows authenticated users to see their own private articles
    const currentUserId = getOptionalUserId(req);
    
    // Build MongoDB query object
    const query: any = {};
    
    // Author filter
    if (authorId) {
      query.authorId = authorId;
    }
    
    // PRIVACY FILTER: Apply based on context
    // Rule 1: If filtering by authorId and it's the current user, show ALL their articles (public + private)
    // Rule 2: Otherwise, only show public articles (or articles without visibility set, defaulting to public)
    const isViewingOwnArticles = currentUserId && authorId === currentUserId;
    
    if (!isViewingOwnArticles) {
      // Public feed or viewing another user's articles: only show public
      // Handle undefined/null visibility as public (default behavior)
      query.$or = [
        { visibility: 'public' },
        { visibility: { $exists: false } }, // Default to public if field doesn't exist
        { visibility: null } // Handle null as public
      ];
    }
    // If isViewingOwnArticles is true, no privacy filter needed - user can see all their articles
    
    // Search query (case-insensitive regex with ReDoS protection)
    // SECURITY: escapeRegExp prevents malicious regex patterns
    if (q && typeof q === 'string' && q.trim().length > 0) {
      const regex = createSearchRegex(q);
      const searchConditions = [
        { title: regex },
        { excerpt: regex },
        { content: regex },
        { tags: regex }
      ];
      
      // Combine search with existing query conditions
      // If we already have a privacy $or, we need to use $and to combine both
      if (query.$or) {
        // We have privacy conditions - combine with search using $and
        query.$and = [
          { $or: query.$or }, // Privacy conditions
          { $or: searchConditions } // Search conditions
        ];
        delete query.$or; // Remove top-level $or, now nested in $and
      } else {
        // No privacy filter, just add search conditions
        query.$or = searchConditions;
      }
    }
    
    // Category filter (case-insensitive, supports both single and array)
    // SECURITY: createExactMatchRegex escapes user input to prevent ReDoS
    // SPECIAL CASE: "Today" category requires date filtering instead of category matching
    if (category && typeof category === 'string' && category === 'Today') {
      // "Today" category: filter by publishedAt date (start of today to end of today)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayEnd = new Date(today);
      todayEnd.setHours(23, 59, 59, 999);
      
      // Filter by publishedAt date range (ISO string comparison)
      query.publishedAt = {
        $gte: today.toISOString(),
        $lte: todayEnd.toISOString()
      };
    } else if (category && typeof category === 'string') {
      // Single category: case-insensitive exact match
      query.categories = { $in: [createExactMatchRegex(category)] };
    } else if (categories) {
      // Multiple categories: handle both string and array
      const categoryArray = Array.isArray(categories) 
        ? categories 
        : [categories];
      
      // Check if "Today" is in the array - if so, apply date filter
      const hasToday = categoryArray.some((cat: any) => 
        typeof cat === 'string' && cat === 'Today'
      );
      
      if (hasToday) {
        // If "Today" is in the array, apply date filter
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayEnd = new Date(today);
        todayEnd.setHours(23, 59, 59, 999);
        
        query.publishedAt = {
          $gte: today.toISOString(),
          $lte: todayEnd.toISOString()
        };
        
        // Also filter by other categories if any
        const otherCategories = categoryArray.filter((cat: any) => 
          typeof cat === 'string' && cat !== 'Today'
        );
        
        if (otherCategories.length > 0) {
          query.categories = { 
            $in: otherCategories.map((cat: string) => createExactMatchRegex(cat))
          };
        }
      } else {
        // No "Today" in array, apply normal category filter
        query.categories = { 
          $in: categoryArray
            .filter((cat): cat is string => typeof cat === 'string')
            .map((cat: string) => createExactMatchRegex(cat))
        };
      }
    }
    
    // Sort parameter (map frontend values to MongoDB sort)
    const sortMap: Record<string, any> = {
      'latest': { publishedAt: -1 },
      'oldest': { publishedAt: 1 },
      'title': { title: 1 },
      'title-desc': { title: -1 }
    };
    // Add secondary sort by _id for deterministic ordering when publishedAt values are identical
    const sortOrder = sortMap[sort as string] || { publishedAt: -1, _id: -1 }; // Default: latest first
    
    const [articles, total] = await Promise.all([
      Article.find(query)
        .sort(sortOrder)
        .skip(skip)
        .limit(limit)
        .lean(), // Use lean() for read-only queries
      Article.countDocuments(query)
    ]);

    res.json({
      data: normalizeDocs(articles),
      total,
      page,
      limit,
      hasMore: page * limit < total
    });
  } catch (error: any) {
    // Audit Phase-3 Fix: Logging consistency - use createRequestLogger with requestId + route
    const requestLogger = createRequestLogger(req.id || 'unknown', getOptionalUserId(req), '/api/articles');
    requestLogger.error({ msg: 'Get articles error', error: { message: error.message, stack: error.stack } });
    sendInternalError(res);
  }
};

export const getArticleById = async (req: Request, res: Response) => {
  try {
    const article = await Article.findById(req.params.id).lean();
    if (!article) return sendNotFoundError(res, 'Article not found');
    
    // PRIVACY CHECK: Verify user has access to this article
    const currentUserId = getOptionalUserId(req);
    const isPrivate = article.visibility === 'private';
    const isOwner = article.authorId === currentUserId;
    
    // If article is private and user is not the owner, deny access
    if (isPrivate && !isOwner) {
      return sendForbiddenError(res, 'This article is private');
    }
    
    // If article is private and no user is authenticated, deny access
    if (isPrivate && !currentUserId) {
      return sendUnauthorizedError(res, 'Authentication required to view private articles');
    }
    
    res.json(normalizeDoc(article));
  } catch (error: any) {
    // Audit Phase-3 Fix: Logging consistency - use createRequestLogger with requestId + route
    const requestLogger = createRequestLogger(req.id || 'unknown', getOptionalUserId(req), '/api/articles/:id');
    requestLogger.error({ msg: 'Get article by ID error', error: { message: error.message, stack: error.stack } });
    sendInternalError(res);
  }
};

export const createArticle = async (req: Request, res: Response) => {
  try {
    // Validate input
    const validationResult = createArticleSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(err => ({
        path: err.path,
        message: err.message,
        code: err.code
      }));
      return sendValidationError(res, 'Validation failed', errors);
    }

    const data = validationResult.data;
    
    // CRITICAL FIX: Deduplicate images array to prevent duplicates
    // Also log for debugging image creation flow
    if (data.images && Array.isArray(data.images)) {
      console.log(`[Articles] Create: Received ${data.images.length} images in payload`);
      const imageMap = new Map<string, string>();
      for (const img of data.images) {
        if (img && typeof img === 'string' && img.trim()) {
          const normalized = img.toLowerCase().trim();
          if (!imageMap.has(normalized)) {
            imageMap.set(normalized, img); // Keep original casing
          } else {
            console.log(`[Articles] Create: Duplicate image detected and removed: ${img}`);
          }
        }
      }
      const deduplicated = Array.from(imageMap.values());
      if (deduplicated.length !== data.images.length) {
        console.log(`[Articles] Create: Deduplicated ${data.images.length} → ${deduplicated.length} images`);
      }
      data.images = deduplicated;
    }
    
    // Log payload size for debugging (especially for images)
    const payloadSize = JSON.stringify(data).length;
    if (payloadSize > 1000000) { // > 1MB
      console.warn(`[Articles] Large payload detected: ${(payloadSize / 1024 / 1024).toFixed(2)}MB`);
      if (data.images && data.images.length > 0) {
        const imagesSize = data.images.reduce((sum: number, img: string) => sum + (img?.length || 0), 0);
        console.warn(`[Articles] Images total size: ${(imagesSize / 1024 / 1024).toFixed(2)}MB`);
      }
    }
    
    // Phase 2: Resolve categoryIds from category names
    const categoryIds = await resolveCategoryIds(data.categories || []);
    
    // Admin-only: Handle custom creation date
    const currentUserId = (req as any).user?.userId;
    const userRole = (req as any).user?.role;
    const isAdmin = userRole === 'admin';
    
    let publishedAt = data.publishedAt || new Date().toISOString();
    let isCustomCreatedAt = false;
    
    // Only allow customCreatedAt if user is admin and field is provided
    if (isAdmin && data.customCreatedAt) {
      try {
        const customDate = new Date(data.customCreatedAt);
        // Validate: reject invalid dates
        if (isNaN(customDate.getTime())) {
          return sendValidationError(res, 'Invalid customCreatedAt date', [{
            path: ['customCreatedAt'],
            message: 'Invalid date format',
            code: 'custom'
          }]);
        }
        
        // Optional: Reject future dates (uncomment if business rules require it)
        // const now = new Date();
        // if (customDate > now) {
        //   return sendValidationError(res, 'Custom date cannot be in the future', [{
        //     path: ['customCreatedAt'],
        //     message: 'Custom date cannot be in the future',
        //     code: 'custom'
        //   }]);
        // }
        
        publishedAt = customDate.toISOString();
        isCustomCreatedAt = true;
      } catch (error) {
        return sendValidationError(res, 'Invalid customCreatedAt date', [{
          path: ['customCreatedAt'],
          message: 'Invalid date format',
          code: 'custom'
        }]);
      }
    } else if (data.customCreatedAt && !isAdmin) {
      // Non-admin trying to set custom date - silently ignore (security: don't reveal this feature exists)
      // Just use default timestamp
    }
    
    const newArticle = await Article.create({
      ...data,
      categoryIds, // Add resolved Tag ObjectIds
      publishedAt,
      isCustomCreatedAt
    });
    
    res.status(201).json(normalizeDoc(newArticle));
  } catch (error: any) {
    // Audit Phase-3 Fix: Logging consistency - use createRequestLogger with requestId + route
    const requestLogger = createRequestLogger(req.id || 'unknown', (req as any).user?.userId, '/api/articles');
    requestLogger.error({ 
      msg: 'Create article error', 
      error: { 
        name: error.name,
        message: error.message, 
        stack: error.stack 
      } 
    });
    
    // Log more details for debugging
    if (error.name === 'ValidationError') {
      // Audit Phase-3 Fix: Logging consistency - use createRequestLogger
      requestLogger.warn({ msg: 'Mongoose validation errors', errors: error.errors });
      const errors = Object.keys(error.errors).map(key => ({
        path: key,
        message: error.errors[key].message
      }));
      return sendValidationError(res, 'Validation failed', errors);
    }
    
    // Check for BSON size limit (MongoDB document size limit is 16MB)
    if (error.message && error.message.includes('BSON')) {
      // Audit Phase-3 Fix: Logging consistency - use createRequestLogger
      requestLogger.warn({ msg: 'Document size limit exceeded' });
      return sendPayloadTooLargeError(res, 'Payload too large. Please reduce image sizes or use fewer images.');
    }
    
    sendInternalError(res);
  }
};

export const updateArticle = async (req: Request, res: Response) => {
  try {
    // Get current user from authentication middleware
    const currentUserId = (req as any).user?.userId;
    if (!currentUserId) {
      return sendUnauthorizedError(res, 'Authentication required');
    }

    // Find article first to verify ownership
    const existingArticle = await Article.findById(req.params.id).lean();
    if (!existingArticle) {
      return sendNotFoundError(res, 'Article not found');
    }

    // Verify ownership (user must be the author or admin)
    const userRole = (req as any).user?.role;
    const isAdmin = userRole === 'admin';
    
    // Allow admin or author to edit
    if (existingArticle.authorId !== currentUserId && !isAdmin) {
      return sendForbiddenError(res, 'You can only edit your own articles');
    }

    // Validate input
    const validationResult = updateArticleSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(err => ({
        path: err.path,
        message: err.message,
        code: err.code
      }));
      return sendValidationError(res, 'Validation failed', errors);
    }

    // CRITICAL FIX: Deduplicate images array to prevent duplicates
    // Also check against existing images to prevent re-adding duplicates
    if (validationResult.data.images && Array.isArray(validationResult.data.images)) {
      console.log(`[Articles] Update: Received ${validationResult.data.images.length} images in payload`);
      console.log(`[Articles] Update: Existing article has ${(existingArticle.images || []).length} images`);
      
      // Get existing images (normalized for comparison)
      const existingImagesSet = new Set(
        (existingArticle.images || []).map((img: string) => 
          img && typeof img === 'string' ? img.toLowerCase().trim() : ''
        ).filter(Boolean)
      );
      
      const imageMap = new Map<string, string>();
      let duplicatesRemoved = 0;
      
      for (const img of validationResult.data.images) {
        if (img && typeof img === 'string' && img.trim()) {
          const normalized = img.toLowerCase().trim();
          
          // Check if this image already exists in the article
          if (existingImagesSet.has(normalized)) {
            console.log(`[Articles] Update: Image already exists in article, keeping: ${img}`);
            // Keep it - it's an existing image that should remain
            if (!imageMap.has(normalized)) {
              imageMap.set(normalized, img);
            }
          } else if (!imageMap.has(normalized)) {
            // New image, add it
            imageMap.set(normalized, img);
          } else {
            // Duplicate in the payload itself
            duplicatesRemoved++;
            console.log(`[Articles] Update: Duplicate image in payload, removed: ${img}`);
          }
        }
      }
      
      const deduplicated = Array.from(imageMap.values());
      if (deduplicated.length !== validationResult.data.images.length || duplicatesRemoved > 0) {
        console.log(`[Articles] Update: Deduplicated ${validationResult.data.images.length} → ${deduplicated.length} images (removed ${duplicatesRemoved} duplicates)`);
      }
      validationResult.data.images = deduplicated;
    }

    // GUARD: Prevent overwriting existing YouTube titles (backend is source of truth)
    // If backend already has media.previewMetadata.title, don't allow updates to it
    const updates = { ...validationResult.data };
    if (
      existingArticle.media?.previewMetadata?.title &&
      updates.media?.previewMetadata?.title
    ) {
      console.debug(
        `[Articles] Ignoring YouTube title update for article ${req.params.id} - backend title already exists`
      );
      // Remove title fields from update to preserve existing backend data
      if (updates.media.previewMetadata) {
        delete updates.media.previewMetadata.title;
        delete updates.media.previewMetadata.titleSource;
        delete updates.media.previewMetadata.titleFetchedAt;
      }
    }

    // CRITICAL FIX: Convert nested media.previewMetadata updates to dot notation
    // This prevents Mongoose from replacing the entire media object (which fails validation)
    // when we only want to update previewMetadata fields
    let mongoUpdate: any = { ...updates };
    
    // Admin-only: Handle custom creation date
    if (isAdmin && updates.customCreatedAt !== undefined) {
      if (updates.customCreatedAt) {
        try {
          const customDate = new Date(updates.customCreatedAt);
          // Validate: reject invalid dates
          if (isNaN(customDate.getTime())) {
            return sendValidationError(res, 'Invalid customCreatedAt date', [{
              path: ['customCreatedAt'],
              message: 'Invalid date format',
              code: 'custom'
            }]);
          }
          
          // Optional: Reject future dates (uncomment if business rules require it)
          // const now = new Date();
          // if (customDate > now) {
          //   return sendValidationError(res, 'Custom date cannot be in the future', [{
          //     path: ['customCreatedAt'],
          //     message: 'Custom date cannot be in the future',
          //     code: 'custom'
          //   }]);
          // }
          
          mongoUpdate.publishedAt = customDate.toISOString();
          mongoUpdate.isCustomCreatedAt = true;
        } catch (error) {
          return sendValidationError(res, 'Invalid customCreatedAt date', [{
            path: ['customCreatedAt'],
            message: 'Invalid date format',
            code: 'custom'
          }]);
        }
      } else {
        // Empty string/null - reset to automatic timestamp
        mongoUpdate.publishedAt = new Date().toISOString();
        mongoUpdate.isCustomCreatedAt = false;
      }
      // Remove customCreatedAt from update (it's not a field in the model)
      delete mongoUpdate.customCreatedAt;
    } else if (updates.customCreatedAt !== undefined && !isAdmin) {
      // Non-admin trying to set custom date - silently ignore (security: don't reveal this feature exists)
      delete mongoUpdate.customCreatedAt;
    }
    
    // Phase 2: Resolve categoryIds if categories are being updated
    if (updates.categories && Array.isArray(updates.categories)) {
      const categoryIds = await resolveCategoryIds(updates.categories);
      mongoUpdate.categoryIds = categoryIds;
      console.log(`[Articles] Update: Resolved ${updates.categories.length} categories to ${categoryIds.length} IDs`);
    }
    
    if (updates.media && !updates.media.type && !updates.media.url && updates.media.previewMetadata) {
      // This is a partial media update (only previewMetadata) - use dot notation
      delete mongoUpdate.media;
      
      // Convert previewMetadata fields to dot notation
      const previewMetadata = updates.media.previewMetadata;
      if (previewMetadata.title) {
        mongoUpdate['media.previewMetadata.title'] = previewMetadata.title;
      }
      if (previewMetadata.titleSource) {
        mongoUpdate['media.previewMetadata.titleSource'] = previewMetadata.titleSource;
      }
      if (previewMetadata.titleFetchedAt) {
        mongoUpdate['media.previewMetadata.titleFetchedAt'] = previewMetadata.titleFetchedAt;
      }
      // Add other previewMetadata fields as needed
      if (previewMetadata.url) {
        mongoUpdate['media.previewMetadata.url'] = previewMetadata.url;
      }
      if (previewMetadata.title !== undefined) {
        mongoUpdate['media.previewMetadata.title'] = previewMetadata.title;
      }
      if (previewMetadata.description !== undefined) {
        mongoUpdate['media.previewMetadata.description'] = previewMetadata.description;
      }
      
      console.debug(`[Articles] Using dot notation for media.previewMetadata update on article ${req.params.id}`);
    }

    const article = await Article.findByIdAndUpdate(
      req.params.id,
      { $set: mongoUpdate },
      { new: true, runValidators: false } // Disable runValidators for partial updates
    ).lean();
    
    if (!article) return sendNotFoundError(res, 'Article not found');
      res.json(normalizeDoc(article));
  } catch (error: any) {
    // Audit Phase-3 Fix: Logging consistency - use createRequestLogger with requestId + route
    const requestLogger = createRequestLogger(req.id || 'unknown', (req as any).user?.userId, '/api/articles/:id');
    requestLogger.error({ msg: 'Update article error', error: { message: error.message, stack: error.stack } });
    sendInternalError(res);
  }
};

export const deleteArticle = async (req: Request, res: Response) => {
  try {
    const articleId = req.params.id;
    
    // Delete the article first
    const article = await Article.findByIdAndDelete(articleId);
    if (!article) return sendNotFoundError(res, 'Article not found');
    
    // Cascade cleanup: Remove article references from all collections
    // This maintains referential integrity
    const collectionsUpdated = await cleanupCollectionEntries(articleId);
    if (collectionsUpdated > 0) {
      console.log(`[Articles] Cleaned up article ${articleId} from ${collectionsUpdated} collection(s)`);
    }
    
    // Mark associated media as orphaned (MongoDB-first cleanup)
    try {
      const { markMediaAsOrphaned } = await import('../services/mediaCleanupService.js');
      const orphanedCount = await markMediaAsOrphaned('nugget', articleId);
      if (orphanedCount > 0) {
        console.log(`[Articles] Marked ${orphanedCount} media files as orphaned for article ${articleId}`);
      }
    } catch (mediaError: any) {
      // Log but don't fail article deletion if media cleanup fails
      // Audit Phase-1 Fix: Use structured logging and Sentry capture
      const requestLogger = createRequestLogger(req.id || 'unknown', (req as any).user?.userId, req.path);
      requestLogger.error({
        msg: '[Articles] Failed to mark media as orphaned',
        error: {
          message: mediaError.message,
          stack: mediaError.stack,
        },
      });
      captureException(mediaError instanceof Error ? mediaError : new Error(String(mediaError)), {
        requestId: req.id,
        route: req.path,
      });
    }
    
    res.status(204).send();
  } catch (error: any) {
    // Audit Phase-3 Fix: Logging consistency - use createRequestLogger with requestId + route
    const requestLogger = createRequestLogger(req.id || 'unknown', (req as any).user?.userId, '/api/articles/:id');
    requestLogger.error({ msg: 'Delete article error', error: { message: error.message, stack: error.stack } });
    sendInternalError(res);
  }
};

/**
 * Delete a specific image from an article's images array
 * 
 * DELETE /api/articles/:id/images
 * 
 * Body: { imageUrl: string }
 */
export const deleteArticleImage = async (req: Request, res: Response) => {
  try {
    const currentUserId = (req as any).user?.userId;
    if (!currentUserId) {
      return sendUnauthorizedError(res, 'Authentication required');
    }

    const { id } = req.params;
    const { imageUrl } = req.body;

    if (!imageUrl || typeof imageUrl !== 'string') {
      return sendValidationError(res, 'imageUrl is required and must be a string', []);
    }

    // Find article and verify ownership
    const article = await Article.findById(id);
    if (!article) {
      return sendNotFoundError(res, 'Article not found');
    }

    // Verify ownership
    if (article.authorId !== currentUserId) {
      return sendForbiddenError(res, 'You can only edit your own articles');
    }

    // Remove image from array (deduplicate by removing all occurrences)
    // Use normalized comparison to handle URL variations
    const currentImages = article.images || [];
    const normalizedImageUrl = imageUrl.toLowerCase().trim();
    
    const updatedImages = currentImages.filter((img: string) => {
      if (!img || typeof img !== 'string') return true;
      const normalized = img.toLowerCase().trim();
      return normalized !== normalizedImageUrl;
    });

    // CRITICAL: Also check if image is in media field
    // Images can be stored in: images array, media.url, or media.previewMetadata.imageUrl
    let mediaUpdated = false;
    let updatedMedia = article.media ? { ...article.media } : null;
    
    if (updatedMedia) {
      // Check if media.url matches the image to delete
      if (updatedMedia.url && updatedMedia.url.toLowerCase().trim() === normalizedImageUrl) {
        if (updatedMedia.type === 'image') {
          // If media type is image and URL matches, clear the entire media object
          updatedMedia = null;
          mediaUpdated = true;
          console.log(`[Articles] Delete image: Removing image from media.url (clearing media object)`);
        } else {
          // If media type is not image, just clear the URL (preserve other metadata)
          updatedMedia.url = '';
          mediaUpdated = true;
          console.log(`[Articles] Delete image: Clearing image URL from media.url`);
        }
      }
      
      // Check if media.previewMetadata.imageUrl matches
      if (updatedMedia.previewMetadata?.imageUrl) {
        const ogImageUrl = updatedMedia.previewMetadata.imageUrl.toLowerCase().trim();
        if (ogImageUrl === normalizedImageUrl) {
          // Remove imageUrl from previewMetadata but keep other metadata
          updatedMedia.previewMetadata = {
            ...updatedMedia.previewMetadata,
            imageUrl: undefined
          };
          mediaUpdated = true;
          console.log(`[Articles] Delete image: Removing image from media.previewMetadata.imageUrl`);
        }
      }
    }

    // CRITICAL FIX: Also check and remove from primaryMedia and supportingMedia
    // Images can be stored in multiple places, so we need to remove from all locations
    let primaryMediaUpdated = false;
    let updatedPrimaryMedia = article.primaryMedia ? { ...article.primaryMedia } : null;
    
    if (updatedPrimaryMedia && updatedPrimaryMedia.type === 'image' && updatedPrimaryMedia.url) {
      const primaryMediaUrl = updatedPrimaryMedia.url.toLowerCase().trim();
      if (primaryMediaUrl === normalizedImageUrl) {
        // Remove primaryMedia if it matches the image to delete
        updatedPrimaryMedia = null;
        primaryMediaUpdated = true;
        console.log(`[Articles] Delete image: Removing image from primaryMedia`);
      }
    }
    
    let supportingMediaUpdated = false;
    let updatedSupportingMedia = article.supportingMedia ? [...article.supportingMedia] : [];
    
    if (updatedSupportingMedia.length > 0) {
      const beforeCount = updatedSupportingMedia.length;
      updatedSupportingMedia = updatedSupportingMedia.filter((media: any) => {
        if (media.type === 'image' && media.url) {
          const supportingUrl = media.url.toLowerCase().trim();
          return supportingUrl !== normalizedImageUrl;
        }
        return true; // Keep non-image media or media without URL
      });
      
      if (updatedSupportingMedia.length < beforeCount) {
        supportingMediaUpdated = true;
        console.log(`[Articles] Delete image: Removed ${beforeCount - updatedSupportingMedia.length} image(s) from supportingMedia`);
      }
    }

    // Check if image was actually removed from any source
    const imageRemovedFromArray = updatedImages.length < currentImages.length;
    const imageRemoved = imageRemovedFromArray || mediaUpdated || primaryMediaUpdated || supportingMediaUpdated;
    
    if (!imageRemoved) {
      console.log(`[Articles] Delete image: Image not found in article.`, {
        currentImages: currentImages,
        mediaUrl: article.media?.url,
        mediaImageUrl: article.media?.previewMetadata?.imageUrl,
        primaryMediaUrl: article.primaryMedia?.url,
        supportingMediaCount: article.supportingMedia?.length || 0
      });
      return sendNotFoundError(res, 'Image not found in article');
    }

    console.log(`[Articles] Delete image: Removing image from article.`, {
      imagesBefore: currentImages.length,
      imagesAfter: updatedImages.length,
      mediaUpdated: mediaUpdated,
      primaryMediaUpdated: primaryMediaUpdated,
      supportingMediaUpdated: supportingMediaUpdated,
      removedFromArray: imageRemovedFromArray
    });

    // Also check and remove from mediaIds if this is a Cloudinary URL
    let updatedMediaIds = article.mediaIds || [];
    let removedMediaId: string | null = null;
    
    if (imageUrl.includes('cloudinary.com') || imageUrl.includes('res.cloudinary.com')) {
      // Try to find Media record by secureUrl to get the mediaId
      const { Media } = await import('../models/Media.js');
      const urlMatch = imageUrl.match(/\/v\d+\/(.+?)(?:\.[^.]+)?$/);
      if (urlMatch && urlMatch[1]) {
        const publicId = urlMatch[1].replace(/\.[^.]+$/, '');
        const mediaRecord = await Media.findOne({ 
          'cloudinary.publicId': publicId,
          ownerId: currentUserId,
          status: 'active'
        });
        
        if (mediaRecord) {
          const mediaIdString = mediaRecord._id.toString();
          if (updatedMediaIds.includes(mediaIdString)) {
            updatedMediaIds = updatedMediaIds.filter((id: string) => id !== mediaIdString);
            removedMediaId = mediaIdString;
            console.log(`[Articles] Delete image: Removed mediaId ${mediaIdString} from mediaIds array`);
          }
        }
      }
    }

    // Update article
    article.images = updatedImages;
    if (removedMediaId) {
      article.mediaIds = updatedMediaIds;
    }
    if (mediaUpdated) {
      article.media = updatedMedia;
    }
    if (primaryMediaUpdated) {
      article.primaryMedia = updatedPrimaryMedia;
    }
    if (supportingMediaUpdated) {
      article.supportingMedia = updatedSupportingMedia;
    }
    await article.save();

    // If the image URL is a Cloudinary URL, try to find and delete the media record
    // Extract public_id from Cloudinary URL if possible
    console.log(`[Articles] Delete image: ${imageUrl}`);
    try {
      if (imageUrl.includes('cloudinary.com') || imageUrl.includes('res.cloudinary.com')) {
        // Try to extract public_id from URL
        // Cloudinary URLs can be in format: https://res.cloudinary.com/{cloud_name}/{resource_type}/upload/v{version}/{public_id}.{format}
        const urlMatch = imageUrl.match(/\/v\d+\/(.+?)(?:\.[^.]+)?$/);
        if (urlMatch && urlMatch[1]) {
          const publicId = urlMatch[1].replace(/\.[^.]+$/, ''); // Remove extension
          console.log(`[Articles] Extracted publicId from Cloudinary URL: ${publicId}`);
          
          // Find media record by publicId
          const { Media } = await import('../models/Media.js');
          const mediaRecord = await Media.findOne({ 
            'cloudinary.publicId': publicId,
            ownerId: currentUserId,
            status: 'active'
          });

          if (mediaRecord) {
            console.log(`[Articles] Found media record for deletion: ${mediaRecord._id}`);
            
            // CRITICAL: Check if this Media is used by other articles before deleting from Cloudinary
            const { Article } = await import('../models/Article.js');
            const otherArticlesUsingMedia = await Article.find({
              _id: { $ne: id }, // Exclude current article
              $or: [
                { mediaIds: mediaRecord._id.toString() },
                { images: { $regex: publicId, $options: 'i' } } // Also check images array for this publicId
              ],
              authorId: currentUserId // Only check user's own articles
            }).lean();
            
            const isSharedAcrossNuggets = otherArticlesUsingMedia.length > 0;
            
            if (isSharedAcrossNuggets) {
              console.log(`[Articles] Media ${mediaRecord._id} is used by ${otherArticlesUsingMedia.length} other article(s). Not deleting from Cloudinary.`);
              // Don't delete from Cloudinary if shared, but still remove from this article
            } else {
              console.log(`[Articles] Media ${mediaRecord._id} is only used by this article. Safe to delete from Cloudinary.`);
              
              // Mark media as orphaned (soft delete)
              mediaRecord.status = 'orphaned';
              await mediaRecord.save();
              console.log(`[Articles] Media record marked as orphaned: ${mediaRecord._id}`);

              // Best-effort Cloudinary deletion (only if not shared)
              const { deleteFromCloudinary } = await import('../services/cloudinaryService.js');
              const deleted = await deleteFromCloudinary(publicId, mediaRecord.cloudinary.resourceType);
              if (deleted) {
                console.log(`[Articles] Cloudinary asset deleted successfully: ${publicId}`);
              } else {
                console.warn(`[Articles] Cloudinary deletion failed for: ${publicId} (but MongoDB record marked as orphaned)`);
              }
            }
          } else {
            console.log(`[Articles] No media record found for publicId: ${publicId} (may be external URL)`);
          }
        } else {
          console.log(`[Articles] Could not extract publicId from Cloudinary URL: ${imageUrl}`);
        }
      } else {
        console.log(`[Articles] Image URL is not a Cloudinary URL (external image): ${imageUrl}`);
      }
    } catch (mediaError: any) {
      // Log but don't fail if media cleanup fails
      console.warn(`[Articles] Failed to cleanup media for image ${imageUrl}:`, mediaError.message);
    }

    res.json({
      success: true,
      message: 'Image deleted successfully',
      images: updatedImages
    });
  } catch (error: any) {
    // Audit Phase-3 Fix: Logging consistency - use createRequestLogger with requestId + route
    const requestLogger = createRequestLogger(req.id || 'unknown', (req as any).user?.userId, '/api/articles/:id/images');
    requestLogger.error({ msg: 'Delete image error', error: { message: error.message, stack: error.stack } });
    sendInternalError(res);
  }
};

/**
 * Get count of articles for the current user
 * Returns total, public, and private counts
 * 
 * GET /api/articles/my/counts
 * Requires authentication
 */
export const getMyArticleCounts = async (req: Request, res: Response) => {
  try {
    // Get current user from authentication middleware
    const currentUserId = (req as any).user?.userId;
    if (!currentUserId) {
      return sendUnauthorizedError(res, 'Authentication required');
    }

    // Build query for user's articles (all visibility levels)
    const userQuery = { authorId: currentUserId };

    // Execute count queries in parallel for efficiency
    const [total, publicCount, privateCount] = await Promise.all([
      Article.countDocuments(userQuery),
      Article.countDocuments({ ...userQuery, visibility: 'public' }),
      Article.countDocuments({ ...userQuery, visibility: 'private' })
    ]);

    res.json({
      total,
      public: publicCount,
      private: privateCount
    });
  } catch (error: any) {
    // Audit Phase-3 Fix: Logging consistency - use createRequestLogger with requestId + route
    const requestLogger = createRequestLogger(req.id || 'unknown', (req as any).user?.userId, '/api/articles/my/counts');
    requestLogger.error({ msg: 'Get my article counts error', error: { message: error.message, stack: error.stack } });
    sendInternalError(res);
  }
};


