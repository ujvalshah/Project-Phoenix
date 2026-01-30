import { Request, Response } from 'express';
import { z } from 'zod';
import { Bookmark, BookmarkItemType } from '../models/Bookmark.js';
import { BookmarkCollectionLink } from '../models/BookmarkCollectionLink.js';
import { Article } from '../models/Article.js';
import { normalizeDoc, normalizeDocs } from '../utils/db.js';
import { createRequestLogger } from '../utils/logger.js';
import { captureException } from '../utils/sentry.js';
import {
  sendErrorResponse,
  sendValidationError,
  sendNotFoundError,
  sendInternalError
} from '../utils/errorResponse.js';
import {
  getOrCreateBookmark,
  ensureBookmarkInDefaultCollection,
  deleteBookmarkCompletely,
  getBookmarkStatus,
  getBookmarkCollectionIds,
  assignBookmarkToCollections
} from '../utils/bookmarkHelpers.js';

/**
 * Bookmark Controller
 *
 * Handles core bookmark CRUD operations.
 * Uses YouTube x Instagram hybrid UX model:
 * - Quick toggle (single tap save/unsave)
 * - Optional collection organization
 */

// Zod validation schemas
const toggleBookmarkSchema = z.object({
  itemId: z.string().min(1, 'Item ID is required'),
  itemType: z.enum(['nugget', 'article', 'video', 'course']).optional().default('nugget')
});

const getBookmarksSchema = z.object({
  collectionId: z.string().optional(),
  itemType: z.enum(['nugget', 'article', 'video', 'course']).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  sort: z.enum(['createdAt', 'lastAccessedAt']).optional().default('createdAt'),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
  q: z.string().optional()
});

const assignCollectionsSchema = z.object({
  bookmarkId: z.string().min(1, 'Bookmark ID is required'),
  collectionIds: z.array(z.string().min(1)).min(1, 'At least one collection ID is required')
});

const batchToggleSchema = z.object({
  itemIds: z.array(z.string().min(1)).min(1).max(50, 'Maximum 50 items per batch'),
  itemType: z.enum(['nugget', 'article', 'video', 'course']).optional().default('nugget'),
  action: z.enum(['bookmark', 'unbookmark'])
});

/**
 * Toggle bookmark status for an item.
 * If not bookmarked, creates bookmark and adds to default collection.
 * If already bookmarked, removes bookmark completely.
 *
 * POST /api/bookmarks/toggle
 */
export const toggleBookmark = async (req: Request, res: Response) => {
  const userId = (req as any).user?.userId;
  const requestLogger = createRequestLogger(req.id || 'unknown', userId, '/api/bookmarks/toggle');

  try {
    // Validate request body
    const validation = toggleBookmarkSchema.safeParse(req.body);
    if (!validation.success) {
      const errors = validation.error.errors.map(e => ({
        path: e.path.join('.'),
        message: e.message
      }));
      return sendValidationError(res, 'Invalid request body', errors);
    }

    const { itemId, itemType } = validation.data;

    // Check current bookmark status
    const status = await getBookmarkStatus(userId, itemId, itemType as BookmarkItemType);

    if (status.isBookmarked && status.bookmarkId) {
      // Already bookmarked - remove it
      await deleteBookmarkCompletely(status.bookmarkId, userId);

      requestLogger.info({
        msg: 'Bookmark removed',
        itemId,
        itemType
      });

      return res.json({
        bookmarked: false,
        message: 'Bookmark removed'
      });
    }

    // Not bookmarked - create and add to default collection
    const { bookmarkId } = await getOrCreateBookmark(userId, itemId, itemType as BookmarkItemType);
    const defaultCollectionId = await ensureBookmarkInDefaultCollection(bookmarkId, userId);

    requestLogger.info({
      msg: 'Bookmark created',
      itemId,
      itemType,
      bookmarkId,
      defaultCollectionId
    });

    return res.json({
      bookmarked: true,
      bookmarkId,
      defaultCollectionId,
      message: 'Saved to Saved'
    });

  } catch (error: any) {
    requestLogger.error({
      msg: '[Bookmarks] Toggle failed',
      error: { message: error.message, stack: error.stack }
    });
    captureException(error, { requestId: req.id, route: '/api/bookmarks/toggle' });
    return sendInternalError(res, 'Failed to toggle bookmark');
  }
};

/**
 * Get bookmark status for a specific item.
 *
 * GET /api/bookmarks/status/:itemId
 */
export const getStatus = async (req: Request, res: Response) => {
  const userId = (req as any).user?.userId;
  const requestLogger = createRequestLogger(req.id || 'unknown', userId, '/api/bookmarks/status');

  try {
    const { itemId } = req.params;
    const itemType = (req.query.itemType as BookmarkItemType) || 'nugget';

    if (!itemId) {
      return sendValidationError(res, 'Item ID is required', [
        { path: 'itemId', message: 'Item ID is required' }
      ]);
    }

    const status = await getBookmarkStatus(userId, itemId, itemType);

    return res.json(status);

  } catch (error: any) {
    requestLogger.error({
      msg: '[Bookmarks] Get status failed',
      error: { message: error.message, stack: error.stack },
      itemId: req.params.itemId
    });
    captureException(error, { requestId: req.id, route: '/api/bookmarks/status' });
    return sendInternalError(res, 'Failed to get bookmark status');
  }
};

/**
 * Get user's bookmarks with optional filtering.
 *
 * GET /api/bookmarks
 */
export const getBookmarks = async (req: Request, res: Response) => {
  const userId = (req as any).user?.userId;
  const requestLogger = createRequestLogger(req.id || 'unknown', userId, '/api/bookmarks');

  try {
    // Validate query params
    const validation = getBookmarksSchema.safeParse(req.query);
    if (!validation.success) {
      const errors = validation.error.errors.map(e => ({
        path: e.path.join('.'),
        message: e.message
      }));
      return sendValidationError(res, 'Invalid query parameters', errors);
    }

    const { collectionId, itemType, page, limit, sort, order, q } = validation.data;
    const skip = (page - 1) * limit;

    // Build query
    const bookmarkQuery: any = { userId };

    if (itemType) {
      bookmarkQuery.itemType = itemType;
    }

    // If filtering by collection, get bookmark IDs from links first
    let bookmarkIdsInCollection: string[] | undefined;
    if (collectionId) {
      const links = await BookmarkCollectionLink.find({
        collectionId,
        userId
      }).select('bookmarkId').lean();

      bookmarkIdsInCollection = links.map(l => l.bookmarkId);

      if (bookmarkIdsInCollection.length === 0) {
        // No bookmarks in this collection
        return res.json({
          data: [],
          meta: { total: 0, page, limit, hasMore: false }
        });
      }

      bookmarkQuery._id = { $in: bookmarkIdsInCollection };
    }

    // Build sort order
    const sortOrder: any = {};
    sortOrder[sort] = order === 'asc' ? 1 : -1;

    // Execute query
    const [bookmarks, total] = await Promise.all([
      Bookmark.find(bookmarkQuery)
        .sort(sortOrder)
        .skip(skip)
        .limit(limit)
        .lean(),
      Bookmark.countDocuments(bookmarkQuery)
    ]);

    // Get article details for the bookmarks
    const itemIds = bookmarks.map(b => b.itemId);
    const articles = await Article.find({ _id: { $in: itemIds } }).lean();
    const articleMap = new Map(articles.map(a => [a._id.toString(), normalizeDoc(a)]));

    // Search filter (if q provided, filter by article title/content)
    let filteredBookmarks = bookmarks;
    if (q && q.trim().length > 0) {
      const searchLower = q.toLowerCase();
      filteredBookmarks = bookmarks.filter(b => {
        const article = articleMap.get(b.itemId);
        if (!article) return false;
        return (
          (article.title && article.title.toLowerCase().includes(searchLower)) ||
          (article.content && article.content.toLowerCase().includes(searchLower)) ||
          (article.excerpt && article.excerpt.toLowerCase().includes(searchLower))
        );
      });
    }

    // Enrich bookmarks with article data and collection info
    const enrichedBookmarks = await Promise.all(
      filteredBookmarks.map(async (bookmark) => {
        const article = articleMap.get(bookmark.itemId);
        const collectionIds = await getBookmarkCollectionIds(bookmark._id.toString());

        return {
          id: bookmark._id.toString(),
          itemId: bookmark.itemId,
          itemType: bookmark.itemType,
          createdAt: bookmark.createdAt,
          lastAccessedAt: bookmark.lastAccessedAt,
          notes: bookmark.notes,
          collectionIds,
          article: article || null
        };
      })
    );

    const hasMore = page * limit < total;

    return res.json({
      data: enrichedBookmarks,
      meta: {
        total: q ? filteredBookmarks.length : total,
        page,
        limit,
        hasMore: q ? false : hasMore
      }
    });

  } catch (error: any) {
    requestLogger.error({
      msg: '[Bookmarks] Get bookmarks failed',
      error: { message: error.message, stack: error.stack }
    });
    captureException(error, { requestId: req.id, route: '/api/bookmarks' });
    return sendInternalError(res, 'Failed to get bookmarks');
  }
};

/**
 * Assign a bookmark to specific collections.
 * Replaces current collection assignments with the new set.
 *
 * POST /api/bookmarks/assign
 */
export const assignToCollections = async (req: Request, res: Response) => {
  const userId = (req as any).user?.userId;
  const requestLogger = createRequestLogger(req.id || 'unknown', userId, '/api/bookmarks/assign');

  try {
    // Validate request body
    const validation = assignCollectionsSchema.safeParse(req.body);
    if (!validation.success) {
      const errors = validation.error.errors.map(e => ({
        path: e.path.join('.'),
        message: e.message
      }));
      return sendValidationError(res, 'Invalid request body', errors);
    }

    const { bookmarkId, collectionIds } = validation.data;

    // Verify bookmark ownership
    const bookmark = await Bookmark.findOne({
      _id: bookmarkId,
      userId
    }).lean();

    if (!bookmark) {
      return sendNotFoundError(res, 'Bookmark not found');
    }

    // Assign to collections
    await assignBookmarkToCollections(bookmarkId, userId, collectionIds);

    requestLogger.info({
      msg: 'Bookmark collections updated',
      bookmarkId,
      collectionIds
    });

    return res.json({
      success: true,
      bookmarkId,
      collectionIds
    });

  } catch (error: any) {
    requestLogger.error({
      msg: '[Bookmarks] Assign to collections failed',
      error: { message: error.message, stack: error.stack }
    });
    captureException(error, { requestId: req.id, route: '/api/bookmarks/assign' });
    return sendInternalError(res, 'Failed to assign bookmark to collections');
  }
};

/**
 * Delete a specific bookmark.
 *
 * DELETE /api/bookmarks/:bookmarkId
 */
export const deleteBookmark = async (req: Request, res: Response) => {
  const userId = (req as any).user?.userId;
  const requestLogger = createRequestLogger(req.id || 'unknown', userId, '/api/bookmarks');

  try {
    const { bookmarkId } = req.params;

    if (!bookmarkId) {
      return sendValidationError(res, 'Bookmark ID is required', [
        { path: 'bookmarkId', message: 'Bookmark ID is required' }
      ]);
    }

    const deleted = await deleteBookmarkCompletely(bookmarkId, userId);

    if (!deleted) {
      return sendNotFoundError(res, 'Bookmark not found');
    }

    requestLogger.info({
      msg: 'Bookmark deleted',
      bookmarkId
    });

    return res.status(204).send();

  } catch (error: any) {
    requestLogger.error({
      msg: '[Bookmarks] Delete failed',
      error: { message: error.message, stack: error.stack },
      bookmarkId: req.params.bookmarkId
    });
    captureException(error, { requestId: req.id, route: '/api/bookmarks' });
    return sendInternalError(res, 'Failed to delete bookmark');
  }
};

/**
 * Batch toggle bookmarks (bookmark or unbookmark multiple items).
 *
 * POST /api/bookmarks/batch-toggle
 */
export const batchToggle = async (req: Request, res: Response) => {
  const userId = (req as any).user?.userId;
  const requestLogger = createRequestLogger(req.id || 'unknown', userId, '/api/bookmarks/batch-toggle');

  try {
    // Validate request body
    const validation = batchToggleSchema.safeParse(req.body);
    if (!validation.success) {
      const errors = validation.error.errors.map(e => ({
        path: e.path.join('.'),
        message: e.message
      }));
      return sendValidationError(res, 'Invalid request body', errors);
    }

    const { itemIds, itemType, action } = validation.data;
    const results: { itemId: string; success: boolean; error?: string }[] = [];

    for (const itemId of itemIds) {
      try {
        if (action === 'bookmark') {
          const { bookmarkId, created } = await getOrCreateBookmark(userId, itemId, itemType as BookmarkItemType);
          if (created) {
            await ensureBookmarkInDefaultCollection(bookmarkId, userId);
          }
          results.push({ itemId, success: true });
        } else {
          const status = await getBookmarkStatus(userId, itemId, itemType as BookmarkItemType);
          if (status.isBookmarked && status.bookmarkId) {
            await deleteBookmarkCompletely(status.bookmarkId, userId);
          }
          results.push({ itemId, success: true });
        }
      } catch (itemError: any) {
        results.push({ itemId, success: false, error: itemError.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    requestLogger.info({
      msg: 'Batch toggle completed',
      action,
      total: itemIds.length,
      successCount,
      failureCount
    });

    return res.json({
      results,
      summary: {
        total: itemIds.length,
        success: successCount,
        failed: failureCount
      }
    });

  } catch (error: any) {
    requestLogger.error({
      msg: '[Bookmarks] Batch toggle failed',
      error: { message: error.message, stack: error.stack }
    });
    captureException(error, { requestId: req.id, route: '/api/bookmarks/batch-toggle' });
    return sendInternalError(res, 'Failed to process batch toggle');
  }
};

/**
 * Get batch bookmark status for multiple items.
 * Useful for checking bookmark state when rendering a list of articles.
 *
 * POST /api/bookmarks/status/batch
 */
export const getBatchStatus = async (req: Request, res: Response) => {
  const userId = (req as any).user?.userId;
  const requestLogger = createRequestLogger(req.id || 'unknown', userId, '/api/bookmarks/status/batch');

  try {
    const { itemIds, itemType = 'nugget' } = req.body;

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return sendValidationError(res, 'itemIds must be a non-empty array', [
        { path: 'itemIds', message: 'itemIds must be a non-empty array' }
      ]);
    }

    if (itemIds.length > 100) {
      return sendValidationError(res, 'Maximum 100 items per batch', [
        { path: 'itemIds', message: 'Maximum 100 items per batch' }
      ]);
    }

    // Get all bookmarks for these items in one query
    const bookmarks = await Bookmark.find({
      userId,
      itemId: { $in: itemIds },
      itemType
    }).lean();

    // Create a map for quick lookup
    const bookmarkMap = new Map(
      bookmarks.map(b => [b.itemId, { bookmarkId: b._id.toString(), isBookmarked: true }])
    );

    // Build status for all requested items
    const statuses = itemIds.map(itemId => ({
      itemId,
      isBookmarked: bookmarkMap.has(itemId),
      bookmarkId: bookmarkMap.get(itemId)?.bookmarkId || null
    }));

    return res.json({ statuses });

  } catch (error: any) {
    requestLogger.error({
      msg: '[Bookmarks] Batch status failed',
      error: { message: error.message, stack: error.stack }
    });
    captureException(error, { requestId: req.id, route: '/api/bookmarks/status/batch' });
    return sendInternalError(res, 'Failed to get batch bookmark status');
  }
};
