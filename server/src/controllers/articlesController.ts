import { Request, Response } from 'express';
import { Article } from '../models/Article.js';
import { Tag } from '../models/Tag.js';
import { normalizeDoc, normalizeDocs } from '../utils/db.js';
import { createArticleSchema, updateArticleSchema, preprocessArticleRequest } from '../utils/validation.js';
import { cleanupCollectionEntries } from '../utils/collectionHelpers.js';
import { escapeRegExp, createSearchRegex, createExactMatchRegex } from '../utils/escapeRegExp.js';
import { verifyToken } from '../utils/jwt.js';
import { createRequestLogger } from '../utils/logger.js';
import { captureException } from '../utils/sentry.js';
import { normalizeTags } from '../utils/normalizeTags.js';
import { resolveTagNamesToIds, isTagIdsWriteEnabled, isTagIdsReadEnabled } from '../utils/tagHelpers.js';
import { createHash } from 'crypto';
import { asArray } from '../utils/arrayHelpers.js';
// CATEGORY PHASE-OUT: Removed normalizeCategories import - categories are no longer supported
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

// CATEGORY PHASE-OUT: Removed resolveCategoryIds function - categories are no longer supported

export const getArticles = async (req: Request, res: Response) => {
  try {
    const { authorId, q, sort, tags } = req.query;
    
    // TODO: legacy-name-only-if-used-by-frontend - Log warning if category/categories query params are used
    if (req.query.category || req.query.categories) {
      const { getLogger } = await import('../utils/logger.js');
      getLogger().warn({
        msg: '⚠️ CATEGORY PHASE-OUT: category/categories query params detected but will be ignored. Use tags instead.',
        category: req.query.category,
        categories: req.query.categories,
        requestId: req.id || 'unknown',
      });
    }
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
    
    // Tag filter (replaces legacy category/categories filters)
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      const validTags = tagArray
        .filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
        .map((tag: string) => tag.trim());
      
      if (validTags.length > 0) {
        // PHASE 1-2: Support both tagIds (new) and tags[] (legacy) filtering
        // Resolve tag names to Tag documents to get tagIds
        const tagDocs = await Tag.find({
          $or: [
            { rawName: { $in: validTags } },
            { canonicalName: { $in: validTags.map(t => t.toLowerCase().trim()) } }
          ],
          status: 'active'
        });
        
        const tagIds = tagDocs.map(t => t._id);
        
        // Build filter conditions: support both tagIds (new) and tags[] (legacy)
        const tagConditions: any[] = [];
        
        // New way: filter by tagIds
        if (isTagIdsReadEnabled() && tagIds.length > 0) {
          tagConditions.push({ tagIds: { $in: tagIds } });
        }
        
        // Legacy way: filter by tags[] strings (case-insensitive regex)
        const legacyTagConditions = validTags.map(tag => {
          const escapedTag = escapeRegExp(tag);
          return { tags: { $regex: new RegExp(`^${escapedTag}$`, 'i') } };
        });
        tagConditions.push({ $or: legacyTagConditions });
        
        // Combine tag filter with existing query conditions
        const combinedTagFilter = tagConditions.length === 1 ? tagConditions[0] : { $or: tagConditions };
        
        if (query.$and) {
          // We already have $and (privacy + search), add tag filter to it
          query.$and.push(combinedTagFilter);
        } else if (query.$or) {
          // We have $or (privacy or search), need to combine with $and
          query.$and = [
            { $or: query.$or },
            combinedTagFilter
          ];
          delete query.$or;
        } else {
          // No existing conditions, just add tag filter
          if (tagConditions.length === 1) {
            // Single tag - use directly without $or
            Object.assign(query, tagConditions[0]);
          } else {
            // Multiple tags - use $or
            query.$or = tagConditions;
          }
        }
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
    
    let articles, total;
    try {
      [articles, total] = await Promise.all([
        Article.find(query)
          .sort(sortOrder)
          .skip(skip)
          .limit(limit)
          .lean(), // Use lean() for read-only queries
        Article.countDocuments(query)
      ]);
    } catch (dbErr: any) {
      const requestLogger = createRequestLogger(req.id || 'unknown', getOptionalUserId(req), '/api/articles');
      requestLogger.error({
        msg: '[Articles] Database query failure',
        error: {
          message: dbErr.message,
          stack: dbErr.stack,
          name: dbErr.name,
        },
        query: {
          mongoQuery: query,
          sortOrder,
          skip,
          limit,
          page,
        },
        payload: {
          queryParams: req.query,
          authorId,
          q,
          sort,
          tags,
        },
      });
      throw dbErr;
    }

    res.json({
      data: normalizeDocs(articles),
      total,
      page,
      limit,
      hasMore: page * limit < total
    });
  } catch (error: any) {
    // Enhanced error logging with full context
    const requestLogger = createRequestLogger(req.id || 'unknown', getOptionalUserId(req), '/api/articles');
    requestLogger.error({ 
      msg: '[Articles] Get articles error - 500 response',
      error: { 
        message: error.message, 
        stack: error.stack,
        name: error.name,
      },
      payload: {
        queryParams: req.query,
        path: req.path,
        method: req.method,
      },
    });
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
  const requestLogger = createRequestLogger(req.id || 'unknown', (req as any).user?.userId, '/api/articles');
  
  try {
    // DIAGNOSTIC LOGGING: Log incoming request body media structure
    requestLogger.info({
      msg: '[DIAGNOSTIC] CreateArticle - Incoming request body media',
      media: req.body.media,
      mediaType: typeof req.body.media,
      mediaIsArray: Array.isArray(req.body.media),
      mediaLength: Array.isArray(req.body.media) ? req.body.media.length : undefined,
      mediaKeys: req.body.media && typeof req.body.media === 'object' ? Object.keys(req.body.media) : undefined,
      fullBodyKeys: Object.keys(req.body || {}),
    });
    
    // DIAGNOSTIC LOGGING: If media is an array, log each item structure
    if (Array.isArray(req.body.media)) {
      requestLogger.info({
        msg: '[DIAGNOSTIC] CreateArticle - Media is ARRAY (unexpected)',
        mediaArrayLength: req.body.media.length,
        mediaArrayItems: req.body.media.map((item: any, index: number) => ({
          index,
          type: typeof item,
          isNull: item === null,
          isUndefined: item === undefined,
          keys: item && typeof item === 'object' ? Object.keys(item) : null,
          structure: item,
        })),
      });
    }
    
    // BACKWARD COMPAT (production): Old clients or proxies may send categories instead of tags,
    // or tags may be missing when body is parsed differently (e.g. cross-origin, rewrite).
    // Use categories as tags when tags is missing or empty. Only when body exists (parsed).
    const rawBody = req.body;
    if (
      rawBody &&
      (!rawBody.tags || (Array.isArray(rawBody.tags) && rawBody.tags.length === 0)) &&
      Array.isArray(rawBody.categories) &&
      rawBody.categories.length > 0
    ) {
      const fromCategories = (rawBody.categories as any[])
        .filter((c: any) => typeof c === 'string' && String(c).trim().length > 0)
        .slice(0, 20);
      if (fromCategories.length > 0) {
        rawBody.tags = fromCategories;
        requestLogger.info({
          msg: '[Articles] Create: Used categories as tags (tags missing/empty)',
          tagCount: fromCategories.length,
        });
      }
    }

    // Preprocess: Remove deprecated categoryIds field and log warning
    const preprocessedBody = preprocessArticleRequest(
      req.body,
      req.id,
      (req as any).user?.userId,
      '/api/articles'
    );

    // Validate input
    const validationResult = createArticleSchema.safeParse(preprocessedBody);
    if (!validationResult.success) {
      // DIAGNOSTIC LOGGING: Log validation errors related to media
      const mediaErrors = validationResult.error.errors.filter(err =>
        err.path.join('.').includes('media')
      );
      if (mediaErrors.length > 0) {
        requestLogger.warn({
          msg: '[DIAGNOSTIC] CreateArticle - Validation errors related to media',
          mediaErrors: mediaErrors.map(err => ({
            path: err.path,
            message: err.message,
            code: err.code,
          })),
          allErrors: validationResult.error.errors.map(err => ({
            path: err.path,
            message: err.message,
            code: err.code,
          })),
        });
      }

      // PRODUCTION DEBUG: When tags validation fails, log what the backend received.
      // Use this in deployed logs to see if body/parsing/proxy is dropping tags.
      const tagErrors = validationResult.error.errors.filter(err =>
        err.path.join('.').includes('tags')
      );
      if (tagErrors.length > 0) {
        requestLogger.warn({
          msg: '[TAGS_DEBUG] CreateArticle validation failed (tags) – check if body/proxy drops tags in production',
          contentType: req.headers['content-type'],
          hasTagsKey: rawBody && 'tags' in rawBody,
          tagsValue: Array.isArray(rawBody?.tags) ? { length: rawBody.tags.length, sample: (rawBody.tags as string[]).slice(0, 3) } : rawBody?.tags,
          bodyKeys: Object.keys(rawBody || {}),
          preprocessedTags: Array.isArray(preprocessedBody?.tags) ? (preprocessedBody.tags as string[]).length : preprocessedBody?.tags,
        });
      }

      const errors = validationResult.error.errors.map(err => ({
        path: err.path,
        message: err.message,
        code: err.code
      }));
      return sendValidationError(res, 'Validation failed', errors);
    }

    const data = validationResult.data;
    
    // DEFENSIVE CODING: Normalize all array fields to ensure they're never null/undefined
    // Even though validation schema should handle this, add safety guards here too
    data.tags = asArray(data.tags);
    data.images = asArray(data.images);
    data.mediaIds = asArray(data.mediaIds);
    data.supportingMedia = asArray(data.supportingMedia);
    data.documents = asArray(data.documents);
    data.themes = asArray(data.themes);
    
    // TEMPORARY DEBUG: Stage 4 - Request payload received in createArticle controller
    const primaryUrl = data.media?.url || data.primaryMedia?.url || null;
    requestLogger.info({
      msg: '[CONTENT_TRACE] Stage 4 - Request payload received in createArticle controller',
      mode: 'create',
      hasMedia: !!data.media,
      source_type: data.source_type,
      primaryUrl,
      contentLength: data.content?.length || 0,
      contentPreview: data.content?.substring(0, 120) || '',
      mediaType: data.media?.type,
      mediaUrl: data.media?.url,
    });
    
    // categoryIds is already removed by preprocessArticleRequest (handled before validation)
    
    // PHASE 1: Normalize tags using shared utilities
    // This ensures consistency with frontend normalization
    const normalizedTags = normalizeTags(data.tags);
    
    // Safety logging: Check if normalization changed tags
    if (data.tags && normalizedTags.length !== data.tags.length) {
      requestLogger.warn({
        msg: '[Articles] Create: Tags normalized (duplicates/whitespace removed)',
        originalCount: data.tags.length,
        normalizedCount: normalizedTags.length,
        originalTags: data.tags,
        normalizedTags,
      });
    }
    
    // Validation: Tags MUST NOT be empty (same rule as frontend)
    // Note: Zod schema already validates this, but we add defensive check for logging
    if (normalizedTags.length === 0) {
      requestLogger.warn({
        msg: '[Articles] Create: Empty tags detected after normalization',
        originalTags: data.tags,
      });
      // Zod schema will reject this, but we log for audit
    }
    
    // Update data with normalized values
    data.tags = normalizedTags;
    
    // PHASE 1: Dual-write - Resolve tag names to tagIds
    // This ensures both tags[] (legacy) and tagIds[] (new) are populated
    if (isTagIdsWriteEnabled() && normalizedTags.length > 0) {
      try {
        const tagIds = await resolveTagNamesToIds(normalizedTags);
        (data as any).tagIds = tagIds;
        requestLogger.info({
          msg: '[Articles] Create: Resolved tags to tagIds',
          tagCount: normalizedTags.length,
          tagIdCount: tagIds.length,
        });
      } catch (tagError: any) {
        // Log error but don't fail article creation - tags[] will still work
        requestLogger.warn({
          msg: '[Articles] Create: Failed to resolve tagIds (falling back to tags[] only)',
          error: { message: tagError.message, stack: tagError.stack },
        });
      }
    }
    
    // DIAGNOSTIC LOGGING: Log validated media structure
    requestLogger.info({
      msg: '[DIAGNOSTIC] CreateArticle - Validated data media structure',
      media: data.media,
      mediaType: typeof data.media,
      mediaIsArray: Array.isArray(data.media),
      mediaIsNull: data.media === null,
      mediaIsUndefined: data.media === undefined,
      mediaKeys: data.media && typeof data.media === 'object' && !Array.isArray(data.media) ? Object.keys(data.media) : undefined,
      mediaStructure: data.media,
    });
    
    // ============================================================================
    // IMAGE DEDUPLICATION MIGRATION - TELEMETRY MODE (NO MUTATION)
    // ============================================================================
    // MIGRATION INTENT: Frontend is now the canonical deduplication pass.
    // Backend computes what it WOULD have deduped but does NOT mutate data.
    // This allows us to detect drift between frontend and backend deduplication logic.
    // 
    // Phase 1: Telemetry mode (current) - compute but don't mutate, log drift
    // Phase 2: Remove backend deduplication entirely (future)
    // 
    // TELEMETRY RULES:
    // - BEST-EFFORT ONLY - must never cause 500 errors
    // - Never mutate data or payload
    // - Never throw - wrap in try/catch
    // - Gracefully handle missing headers, undefined images, non-arrays
    // ============================================================================
    try {
      const clientHashHeader = req.headers['x-images-hash'];
      const clientHash = Array.isArray(clientHashHeader)
        ? clientHashHeader[0]
        : clientHashHeader ?? null;

      // Prefer payload images if present, otherwise fallback to empty array
      // DEFENSIVE: Use asArray helper for safety
      const imagesArray = asArray(data?.images);

      if (imagesArray.length > 0 && clientHash) {
        // Normalize images for consistent hashing (match frontend: sort then JSON.stringify)
        const normalizedImages = imagesArray
          .filter(Boolean)
          .map(String)
          .filter(img => img.trim().length > 0)
          .sort();

        // Compute server-side hash (match frontend: JSON.stringify of sorted array)
        const serverHash = normalizedImages.length > 0
          ? createHash('sha256')
              .update(JSON.stringify(normalizedImages))
              .digest('hex')
          : null;

        // Compare hashes and log drift if mismatch
        if (clientHash && serverHash && clientHash !== serverHash) {
          const requestLogger = createRequestLogger(req.id || 'unknown', (req as any).user?.userId, '/api/articles');
          requestLogger.warn({
            msg: '[IMAGE_DEDUP_DRIFT] Frontend and backend deduplication mismatch detected',
            clientHash,
            serverHash,
            imageCount: normalizedImages.length,
          });
        }
      }
    } catch (err) {
      // Telemetry failed - log warning but continue execution
      const requestLogger = createRequestLogger(req.id || 'unknown', (req as any).user?.userId, '/api/articles');
      requestLogger.warn({
        msg: '[IMAGE_DEDUP_TELEMETRY] Telemetry failed (non-blocking)',
        error: err instanceof Error ? err.message : String(err),
      });
    }
    
    // Log payload size for debugging (especially for images)
    const payloadSize = JSON.stringify(data).length;
    if (payloadSize > 1000000) { // > 1MB
      console.warn(`[Articles] Large payload detected: ${(payloadSize / 1024 / 1024).toFixed(2)}MB`);
      // DEFENSIVE: Use asArray helper for safety
      const imagesArray = asArray(data.images);
      if (imagesArray.length > 0) {
        const imagesSize = imagesArray.reduce((sum: number, img: string) => sum + (img?.length || 0), 0);
        console.warn(`[Articles] Images total size: ${(imagesSize / 1024 / 1024).toFixed(2)}MB`);
      }
    }
    
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
    
    // DIAGNOSTIC LOGGING: Log data structure before Article.create
    requestLogger.info({
      msg: '[DIAGNOSTIC] CreateArticle - Data structure before Article.create',
      mediaField: data.media,
      mediaType: typeof data.media,
      mediaIsArray: Array.isArray(data.media),
      imagesLength: data.images ? data.images.length : 0,
      imagesArray: data.images,
      mediaIdsLength: data.mediaIds ? data.mediaIds.length : 0,
      mediaIdsArray: data.mediaIds,
      dataKeys: Object.keys(data),
    });
    
    const createData = {
      ...data,
      publishedAt,
      isCustomCreatedAt
    };
    
    // TEMPORARY DEBUG: Stage 5 - Final object written to MongoDB
    const finalPrimaryUrl = createData.media?.url || createData.primaryMedia?.url || null;
    requestLogger.info({
      msg: '[CONTENT_TRACE] Stage 5 - Final object written to MongoDB',
      mode: 'create',
      hasMedia: !!createData.media,
      source_type: createData.source_type,
      primaryUrl: finalPrimaryUrl,
      contentLength: createData.content?.length || 0,
      contentPreview: createData.content?.substring(0, 120) || '',
      mediaType: createData.media?.type,
      mediaUrl: createData.media?.url,
    });
    
    const newArticle = await Article.create(createData);
    
    res.status(201).json(normalizeDoc(newArticle));
  } catch (error: any) {
    // DIAGNOSTIC LOGGING: Enhanced error logging with media context
    requestLogger.error({ 
      msg: '[DIAGNOSTIC] CreateArticle - ERROR CAUGHT', 
      error: { 
        name: error.name,
        message: error.message, 
        stack: error.stack,
      },
      errorCode: error.code,
      errorKeyPattern: error.keyPattern,
      errorKeyValue: error.keyValue,
      requestBodyMedia: req.body?.media,
      requestBodyMediaType: typeof req.body?.media,
      requestBodyMediaIsArray: Array.isArray(req.body?.media),
    });
    
    // IMPROVED ERROR HANDLING: Return 400 for validation/type errors instead of 500
    // Check for TypeError related to array operations (defensive coding)
    if (error.name === 'TypeError' && error.message && 
        (error.message.includes('Cannot read properties') || 
         error.message.includes('filter') || 
         error.message.includes('map') || 
         error.message.includes('reduce') ||
         error.message.includes('length'))) {
      requestLogger.warn({ 
        msg: '[DIAGNOSTIC] CreateArticle - TypeError related to array operation (likely null/undefined array)',
        errorMessage: error.message,
        requestBodyKeys: Object.keys(req.body || {}),
      });
      return sendValidationError(res, 'Invalid request data: array fields must be arrays or omitted', [{
        path: ['body'],
        message: error.message,
        code: 'invalid_type'
      }]);
    }
    
    // Log more details for debugging
    if (error.name === 'ValidationError') {
      // DIAGNOSTIC LOGGING: Enhanced Mongoose validation errors
      requestLogger.warn({ 
        msg: '[DIAGNOSTIC] CreateArticle - Mongoose ValidationError',
        errors: error.errors,
        errorKeys: Object.keys(error.errors || {}),
        errorDetails: Object.keys(error.errors || {}).map(key => ({
          field: key,
          message: error.errors[key].message,
          value: error.errors[key].value,
          kind: error.errors[key].kind,
          path: error.errors[key].path,
        })),
      });
      const errors = Object.keys(error.errors).map(key => ({
        path: key,
        message: error.errors[key].message
      }));
      return sendValidationError(res, 'Validation failed', errors);
    }
    
    // Check for BSON size limit (MongoDB document size limit is 16MB)
    if (error.message && error.message.includes('BSON')) {
      requestLogger.warn({ msg: '[DIAGNOSTIC] CreateArticle - Document size limit exceeded' });
      return sendPayloadTooLargeError(res, 'Payload too large. Please reduce image sizes or use fewer images.');
    }
    
    console.error('ARTICLE_CREATE_FAILED', error);
    return res.status(500).json({
      code: 'ARTICLE_CREATE_FAILED',
      message: error.message,
    });
  }
};

export const updateArticle = async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger(req.id || 'unknown', (req as any).user?.userId, '/api/articles/:id');
  
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

    // Preprocess: Remove deprecated categoryIds field and log warning
    const preprocessedBody = preprocessArticleRequest(
      req.body,
      req.id,
      (req as any).user?.userId,
      '/api/articles/:id'
    );
    
    // Validate input
    const validationResult = updateArticleSchema.safeParse(preprocessedBody);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(err => ({
        path: err.path,
        message: err.message,
        code: err.code
      }));
      return sendValidationError(res, 'Validation failed', errors);
    }

    // categoryIds is already removed by preprocessArticleRequest (handled before validation)
    
    // PHASE 1: Normalize tags using shared utilities
    
    // DEFENSIVE CODING: Normalize all array fields to ensure they're never null/undefined
    // Even though validation schema should handle this, add safety guards here too
    if (validationResult.data.tags !== undefined) {
      validationResult.data.tags = asArray(validationResult.data.tags);
    }
    if (validationResult.data.images !== undefined) {
      validationResult.data.images = asArray(validationResult.data.images);
    }
    if (validationResult.data.mediaIds !== undefined) {
      validationResult.data.mediaIds = asArray(validationResult.data.mediaIds);
    }
    if (validationResult.data.supportingMedia !== undefined) {
      validationResult.data.supportingMedia = asArray(validationResult.data.supportingMedia);
    }
    if (validationResult.data.documents !== undefined) {
      validationResult.data.documents = asArray(validationResult.data.documents);
    }
    if (validationResult.data.themes !== undefined) {
      validationResult.data.themes = asArray(validationResult.data.themes);
    }
    
    // Normalize tags if provided
    if (validationResult.data.tags !== undefined) {
      const normalizedTags = normalizeTags(validationResult.data.tags);
      
      // Safety logging: Check if normalization would result in empty tags
      const existingTags = existingArticle.tags || [];
      if (normalizedTags.length === 0) {
        if (existingTags.length > 0) {
          // Tags would become empty - this should be prevented by frontend, but log for audit
          requestLogger.warn({
            msg: '[Articles] Update: Tags would become empty after normalization',
            articleId: req.params.id,
            originalTags: existingTags,
            providedTags: validationResult.data.tags,
            normalizedTags,
          });
          // Reject empty tags (same rule as CREATE mode)
          return sendValidationError(res, 'At least one tag is required', [{
            path: ['tags'],
            message: 'At least one tag is required',
            code: 'custom'
          }]);
        } else {
          // Article already has empty tags - log for audit but allow update (temporary compatibility)
          requestLogger.warn({
            msg: '[Articles] Update: Article already has empty tags (allowing update for compatibility)',
            articleId: req.params.id,
            existingTags,
            providedTags: validationResult.data.tags,
          });
          // Allow update but log the discrepancy
        }
      } else if (normalizedTags.length !== validationResult.data.tags.length) {
        // Normalization removed duplicates/whitespace - log for audit
        requestLogger.info({
          msg: '[Articles] Update: Tags normalized (duplicates/whitespace removed)',
          articleId: req.params.id,
          originalCount: validationResult.data.tags.length,
          normalizedCount: normalizedTags.length,
        });
      }
      
      validationResult.data.tags = normalizedTags;
      
      // PHASE 1: Dual-write - Resolve tag names to tagIds
      if (isTagIdsWriteEnabled() && normalizedTags.length > 0) {
        try {
          const tagIds = await resolveTagNamesToIds(normalizedTags);
          (validationResult.data as any).tagIds = tagIds;
          requestLogger.info({
            msg: '[Articles] Update: Resolved tags to tagIds',
            articleId: req.params.id,
            tagCount: normalizedTags.length,
            tagIdCount: tagIds.length,
          });
        } catch (tagError: any) {
          // Log error but don't fail article update - tags[] will still work
          requestLogger.warn({
            msg: '[Articles] Update: Failed to resolve tagIds (falling back to tags[] only)',
            articleId: req.params.id,
            error: { message: tagError.message, stack: tagError.stack },
          });
        }
      }
    }

    // ============================================================================
    // IMAGE DEDUPLICATION MIGRATION - TELEMETRY MODE (NO MUTATION)
    // ============================================================================
    // MIGRATION INTENT: Frontend is now the canonical deduplication pass.
    // Backend computes what it WOULD have deduped but does NOT mutate data.
    // This allows us to detect drift between frontend and backend deduplication logic.
    // 
    // Phase 1: Telemetry mode (current) - compute but don't mutate, log drift
    // Phase 2: Remove backend deduplication entirely (future)
    // 
    // TELEMETRY RULES:
    // - BEST-EFFORT ONLY - must never cause 500 errors
    // - Never mutate data or payload
    // - Never throw - wrap in try/catch
    // - Gracefully handle missing headers, undefined images, non-arrays, partial PATCH payloads
    // ============================================================================
    try {
      const clientHashHeader = req.headers['x-images-hash'];
      const clientHash = Array.isArray(clientHashHeader)
        ? clientHashHeader[0]
        : clientHashHeader ?? null;

      // Prefer update payload if present, otherwise fallback to existing article
      // DEFENSIVE: Use asArray helper for safety
      const imagesArray = validationResult.data?.images !== undefined
        ? asArray(validationResult.data.images)
        : asArray(existingArticle?.images);

      if (imagesArray.length > 0 && clientHash) {
        // Normalize images for consistent hashing (match frontend: sort then JSON.stringify)
        const normalizedImages = imagesArray
          .filter(Boolean)
          .map(String)
          .filter(img => img.trim().length > 0)
          .sort();

        // Compute server-side hash (match frontend: JSON.stringify of sorted array)
        const serverHash = normalizedImages.length > 0
          ? createHash('sha256')
              .update(JSON.stringify(normalizedImages))
              .digest('hex')
          : null;

        // Compare hashes and log drift if mismatch
        if (clientHash && serverHash && clientHash !== serverHash) {
          requestLogger.warn({
            msg: '[IMAGE_DEDUP_DRIFT] Frontend and backend deduplication mismatch detected (UPDATE)',
            articleId: req.params.id,
            clientHash,
            serverHash,
            imageCount: normalizedImages.length,
          });
        }
      }
    } catch (err) {
      // Telemetry failed - log warning but continue execution
      requestLogger.warn({
        msg: '[IMAGE_DEDUP_TELEMETRY] Telemetry failed (non-blocking)',
        articleId: req.params.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // ============================================================================
    // YOUTUBE TITLE GUARD: Prevent overwriting existing YouTube titles
    // ============================================================================
    // Rule: Preserve YouTube titles unless allowMetadataOverride is true
    // 
    // Decision Boundaries:
    // - If allowMetadataOverride = false → preserve YouTube title (existing logic)
    // - If allowMetadataOverride = true → allow user override intentionally
    // ============================================================================
    const updates = { ...validationResult.data };
    const allowMetadataOverride = updates.media?.allowMetadataOverride === true;
    const hasExistingYouTubeTitle = existingArticle.media?.previewMetadata?.titleSource === 'youtube-oembed' ||
                                    (existingArticle.media?.previewMetadata?.title && 
                                     existingArticle.media?.url && 
                                     (existingArticle.media.url.includes('youtube.com') || 
                                      existingArticle.media.url.includes('youtu.be')));
    
    if (
      hasExistingYouTubeTitle &&
      updates.media?.previewMetadata?.title &&
      !allowMetadataOverride
    ) {
      // YouTube title exists and user didn't explicitly override → preserve it
      console.debug(
        `[Articles] Preserving YouTube title for article ${req.params.id} - allowMetadataOverride=${allowMetadataOverride}`
      );
      // Remove title fields from update to preserve existing backend data
      if (updates.media.previewMetadata) {
        delete updates.media.previewMetadata.title;
        delete updates.media.previewMetadata.titleSource;
        delete updates.media.previewMetadata.titleFetchedAt;
      }
    } else if (allowMetadataOverride && hasExistingYouTubeTitle) {
      // User explicitly edited → allow override (log for audit)
      console.debug(
        `[Articles] Allowing YouTube title override for article ${req.params.id} - allowMetadataOverride=true`
      );
    }
    
    // Remove allowMetadataOverride from update (it's a transient flag, not stored in DB)
    if (updates.media) {
      delete updates.media.allowMetadataOverride;
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
      
      // Check if media.previewMetadata.imageUrl matches (updatedMedia may have been set to null above)
      if (updatedMedia && updatedMedia.previewMetadata?.imageUrl) {
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


