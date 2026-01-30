import { Request, Response } from 'express';
import { z } from 'zod';
import { BookmarkCollection } from '../models/BookmarkCollection.js';
import { BookmarkCollectionLink } from '../models/BookmarkCollectionLink.js';
import { createRequestLogger } from '../utils/logger.js';
import { captureException } from '../utils/sentry.js';
import {
  sendErrorResponse,
  sendValidationError,
  sendNotFoundError,
  sendConflictError,
  sendForbiddenError,
  sendInternalError,
  handleDuplicateKeyError
} from '../utils/errorResponse.js';
import {
  ensureDefaultCollection,
  removeBookmarkFromCollection,
  recalculateCollectionCount
} from '../utils/bookmarkHelpers.js';

/**
 * Bookmark Collections Controller
 *
 * Handles CRUD operations for user's bookmark collections/folders.
 * Follows Instagram/Pinterest collection pattern.
 */

// Zod validation schemas
const createCollectionSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less')
    .trim(),
  description: z.string()
    .max(500, 'Description must be 500 characters or less')
    .trim()
    .optional(),
  order: z.number().int().min(0).optional()
});

const updateCollectionSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less')
    .trim()
    .optional(),
  description: z.string()
    .max(500, 'Description must be 500 characters or less')
    .trim()
    .optional(),
  order: z.number().int().min(0).optional()
});

const reorderCollectionsSchema = z.object({
  collectionIds: z.array(z.string().min(1)).min(1, 'At least one collection ID is required')
});

/**
 * Get all user's bookmark collections.
 *
 * GET /api/bookmark-collections
 */
export const getCollections = async (req: Request, res: Response) => {
  const userId = (req as any).user?.userId;
  const requestLogger = createRequestLogger(req.id || 'unknown', userId, '/api/bookmark-collections');

  try {
    // Ensure default collection exists
    await ensureDefaultCollection(userId);

    // Get all collections sorted by order
    const collections = await BookmarkCollection.find({ userId })
      .sort({ order: 1, createdAt: 1 })
      .lean();

    // Transform for response
    const data = collections.map(c => ({
      id: c._id.toString(),
      name: c.name,
      description: c.description,
      order: c.order,
      isDefault: c.isDefault,
      bookmarkCount: c.bookmarkCount,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt
    }));

    return res.json({ collections: data });

  } catch (error: any) {
    requestLogger.error({
      msg: '[BookmarkCollections] Get collections failed',
      error: { message: error.message, stack: error.stack }
    });
    captureException(error, { requestId: req.id, route: '/api/bookmark-collections' });
    return sendInternalError(res, 'Failed to get bookmark collections');
  }
};

/**
 * Get a specific bookmark collection by ID.
 *
 * GET /api/bookmark-collections/:id
 */
export const getCollectionById = async (req: Request, res: Response) => {
  const userId = (req as any).user?.userId;
  const requestLogger = createRequestLogger(req.id || 'unknown', userId, '/api/bookmark-collections');

  try {
    const { id } = req.params;

    const collection = await BookmarkCollection.findOne({
      _id: id,
      userId
    }).lean();

    if (!collection) {
      return sendNotFoundError(res, 'Collection not found');
    }

    return res.json({
      id: collection._id.toString(),
      name: collection.name,
      description: collection.description,
      order: collection.order,
      isDefault: collection.isDefault,
      bookmarkCount: collection.bookmarkCount,
      createdAt: collection.createdAt,
      updatedAt: collection.updatedAt
    });

  } catch (error: any) {
    requestLogger.error({
      msg: '[BookmarkCollections] Get collection by ID failed',
      error: { message: error.message, stack: error.stack },
      collectionId: req.params.id
    });
    captureException(error, { requestId: req.id, route: '/api/bookmark-collections' });
    return sendInternalError(res, 'Failed to get bookmark collection');
  }
};

/**
 * Create a new bookmark collection.
 *
 * POST /api/bookmark-collections
 */
export const createCollection = async (req: Request, res: Response) => {
  const userId = (req as any).user?.userId;
  const requestLogger = createRequestLogger(req.id || 'unknown', userId, '/api/bookmark-collections');

  try {
    // Validate request body
    const validation = createCollectionSchema.safeParse(req.body);
    if (!validation.success) {
      const errors = validation.error.errors.map(e => ({
        path: e.path.join('.'),
        message: e.message
      }));
      return sendValidationError(res, 'Invalid request body', errors);
    }

    const { name, description, order } = validation.data;
    const canonicalName = name.toLowerCase();

    // Get the next order if not provided
    let collectionOrder = order;
    if (collectionOrder === undefined) {
      const lastCollection = await BookmarkCollection.findOne({ userId })
        .sort({ order: -1 })
        .lean();
      collectionOrder = (lastCollection?.order ?? -1) + 1;
    }

    const now = new Date().toISOString();

    // Create the collection
    const collection = await BookmarkCollection.create({
      userId,
      name,
      canonicalName,
      description: description || '',
      order: collectionOrder,
      isDefault: false,
      bookmarkCount: 0,
      createdAt: now,
      updatedAt: now
    });

    requestLogger.info({
      msg: 'Bookmark collection created',
      collectionId: collection._id.toString(),
      name
    });

    return res.status(201).json({
      id: collection._id.toString(),
      name: collection.name,
      description: collection.description,
      order: collection.order,
      isDefault: collection.isDefault,
      bookmarkCount: collection.bookmarkCount,
      createdAt: collection.createdAt,
      updatedAt: collection.updatedAt
    });

  } catch (error: any) {
    // Handle duplicate name error
    if (error.code === 11000) {
      return sendConflictError(res, 'A collection with this name already exists', 'COLLECTION_NAME_EXISTS');
    }

    requestLogger.error({
      msg: '[BookmarkCollections] Create collection failed',
      error: { message: error.message, stack: error.stack }
    });
    captureException(error, { requestId: req.id, route: '/api/bookmark-collections' });
    return sendInternalError(res, 'Failed to create bookmark collection');
  }
};

/**
 * Update a bookmark collection.
 *
 * PUT /api/bookmark-collections/:id
 */
export const updateCollection = async (req: Request, res: Response) => {
  const userId = (req as any).user?.userId;
  const requestLogger = createRequestLogger(req.id || 'unknown', userId, '/api/bookmark-collections');

  try {
    const { id } = req.params;

    // Find the collection
    const collection = await BookmarkCollection.findOne({
      _id: id,
      userId
    });

    if (!collection) {
      return sendNotFoundError(res, 'Collection not found');
    }

    // Validate request body
    const validation = updateCollectionSchema.safeParse(req.body);
    if (!validation.success) {
      const errors = validation.error.errors.map(e => ({
        path: e.path.join('.'),
        message: e.message
      }));
      return sendValidationError(res, 'Invalid request body', errors);
    }

    const { name, description, order } = validation.data;

    // Prevent renaming default collection
    if (collection.isDefault && name && name.toLowerCase() !== 'saved') {
      return sendForbiddenError(res, 'Cannot rename the default collection');
    }

    // Build update object
    const updates: any = {
      updatedAt: new Date().toISOString()
    };

    if (name !== undefined) {
      updates.name = name;
      updates.canonicalName = name.toLowerCase();
    }

    if (description !== undefined) {
      updates.description = description;
    }

    if (order !== undefined) {
      updates.order = order;
    }

    // Apply updates
    const updated = await BookmarkCollection.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    ).lean();

    if (!updated) {
      return sendNotFoundError(res, 'Collection not found');
    }

    requestLogger.info({
      msg: 'Bookmark collection updated',
      collectionId: id,
      updates: Object.keys(updates)
    });

    return res.json({
      id: updated._id.toString(),
      name: updated.name,
      description: updated.description,
      order: updated.order,
      isDefault: updated.isDefault,
      bookmarkCount: updated.bookmarkCount,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt
    });

  } catch (error: any) {
    // Handle duplicate name error
    if (error.code === 11000) {
      return sendConflictError(res, 'A collection with this name already exists', 'COLLECTION_NAME_EXISTS');
    }

    requestLogger.error({
      msg: '[BookmarkCollections] Update collection failed',
      error: { message: error.message, stack: error.stack },
      collectionId: req.params.id
    });
    captureException(error, { requestId: req.id, route: '/api/bookmark-collections' });
    return sendInternalError(res, 'Failed to update bookmark collection');
  }
};

/**
 * Delete a bookmark collection.
 * Note: Cannot delete the default collection.
 *
 * DELETE /api/bookmark-collections/:id
 */
export const deleteCollection = async (req: Request, res: Response) => {
  const userId = (req as any).user?.userId;
  const requestLogger = createRequestLogger(req.id || 'unknown', userId, '/api/bookmark-collections');

  try {
    const { id } = req.params;

    // Find the collection
    const collection = await BookmarkCollection.findOne({
      _id: id,
      userId
    }).lean();

    if (!collection) {
      return sendNotFoundError(res, 'Collection not found');
    }

    // Prevent deleting default collection
    if (collection.isDefault) {
      return sendForbiddenError(res, 'Cannot delete the default collection');
    }

    // Delete all links to this collection
    await BookmarkCollectionLink.deleteMany({ collectionId: id });

    // Delete the collection
    await BookmarkCollection.deleteOne({ _id: id });

    requestLogger.info({
      msg: 'Bookmark collection deleted',
      collectionId: id,
      name: collection.name
    });

    return res.status(204).send();

  } catch (error: any) {
    requestLogger.error({
      msg: '[BookmarkCollections] Delete collection failed',
      error: { message: error.message, stack: error.stack },
      collectionId: req.params.id
    });
    captureException(error, { requestId: req.id, route: '/api/bookmark-collections' });
    return sendInternalError(res, 'Failed to delete bookmark collection');
  }
};

/**
 * Reorder collections (drag and drop support).
 *
 * PUT /api/bookmark-collections/reorder
 */
export const reorderCollections = async (req: Request, res: Response) => {
  const userId = (req as any).user?.userId;
  const requestLogger = createRequestLogger(req.id || 'unknown', userId, '/api/bookmark-collections/reorder');

  try {
    // Validate request body
    const validation = reorderCollectionsSchema.safeParse(req.body);
    if (!validation.success) {
      const errors = validation.error.errors.map(e => ({
        path: e.path.join('.'),
        message: e.message
      }));
      return sendValidationError(res, 'Invalid request body', errors);
    }

    const { collectionIds } = validation.data;
    const now = new Date().toISOString();

    // Update order for each collection
    const updates = collectionIds.map((id, index) => ({
      updateOne: {
        filter: { _id: id, userId },
        update: { $set: { order: index, updatedAt: now } }
      }
    }));

    await BookmarkCollection.bulkWrite(updates);

    requestLogger.info({
      msg: 'Bookmark collections reordered',
      count: collectionIds.length
    });

    // Return updated collections
    const collections = await BookmarkCollection.find({ userId })
      .sort({ order: 1 })
      .lean();

    const data = collections.map(c => ({
      id: c._id.toString(),
      name: c.name,
      description: c.description,
      order: c.order,
      isDefault: c.isDefault,
      bookmarkCount: c.bookmarkCount,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt
    }));

    return res.json({ collections: data });

  } catch (error: any) {
    requestLogger.error({
      msg: '[BookmarkCollections] Reorder collections failed',
      error: { message: error.message, stack: error.stack }
    });
    captureException(error, { requestId: req.id, route: '/api/bookmark-collections/reorder' });
    return sendInternalError(res, 'Failed to reorder bookmark collections');
  }
};

/**
 * Remove a bookmark from a specific collection.
 *
 * DELETE /api/bookmark-collections/:collectionId/bookmarks/:bookmarkId
 */
export const removeBookmark = async (req: Request, res: Response) => {
  const userId = (req as any).user?.userId;
  const requestLogger = createRequestLogger(req.id || 'unknown', userId, '/api/bookmark-collections');

  try {
    const { collectionId, bookmarkId } = req.params;

    // Verify collection ownership
    const collection = await BookmarkCollection.findOne({
      _id: collectionId,
      userId
    }).lean();

    if (!collection) {
      return sendNotFoundError(res, 'Collection not found');
    }

    // Remove the bookmark from the collection
    const removed = await removeBookmarkFromCollection(bookmarkId, collectionId);

    if (!removed) {
      return sendNotFoundError(res, 'Bookmark not found in this collection');
    }

    requestLogger.info({
      msg: 'Bookmark removed from collection',
      bookmarkId,
      collectionId
    });

    return res.status(204).send();

  } catch (error: any) {
    requestLogger.error({
      msg: '[BookmarkCollections] Remove bookmark failed',
      error: { message: error.message, stack: error.stack },
      collectionId: req.params.collectionId,
      bookmarkId: req.params.bookmarkId
    });
    captureException(error, { requestId: req.id, route: '/api/bookmark-collections' });
    return sendInternalError(res, 'Failed to remove bookmark from collection');
  }
};

/**
 * Recalculate bookmark count for a collection (admin/maintenance).
 *
 * POST /api/bookmark-collections/:id/recalculate
 */
export const recalculateCount = async (req: Request, res: Response) => {
  const userId = (req as any).user?.userId;
  const requestLogger = createRequestLogger(req.id || 'unknown', userId, '/api/bookmark-collections');

  try {
    const { id } = req.params;

    // Verify collection ownership
    const collection = await BookmarkCollection.findOne({
      _id: id,
      userId
    }).lean();

    if (!collection) {
      return sendNotFoundError(res, 'Collection not found');
    }

    // Recalculate count
    const count = await recalculateCollectionCount(id);

    requestLogger.info({
      msg: 'Collection bookmark count recalculated',
      collectionId: id,
      previousCount: collection.bookmarkCount,
      newCount: count
    });

    return res.json({
      id,
      previousCount: collection.bookmarkCount,
      newCount: count
    });

  } catch (error: any) {
    requestLogger.error({
      msg: '[BookmarkCollections] Recalculate count failed',
      error: { message: error.message, stack: error.stack },
      collectionId: req.params.id
    });
    captureException(error, { requestId: req.id, route: '/api/bookmark-collections' });
    return sendInternalError(res, 'Failed to recalculate collection count');
  }
};
