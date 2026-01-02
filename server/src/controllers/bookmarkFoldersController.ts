import { Request, Response } from 'express';
import { BookmarkFolder } from '../models/BookmarkFolder.js';
import { Bookmark } from '../models/Bookmark.js';
import { BookmarkFolderLink } from '../models/BookmarkFolderLink.js';
import { normalizeDoc, normalizeDocs } from '../utils/db.js';
import { ensureDefaultFolder, getOrCreateBookmark, getGeneralFolderId, ensureBookmarkInGeneralFolder } from '../utils/bookmarkHelpers.js';
import { z } from 'zod';
import { createExactMatchRegex } from '../utils/escapeRegExp.js';
import { createRequestLogger } from '../utils/logger.js';
import { captureException } from '../utils/sentry.js';

// Audit Phase-1 Fix: Maximum bookmark limits to prevent unbounded queries
const MAX_BOOKMARKS_PER_USER = 10000;
const MAX_BOOKMARK_IDS_IN_REQUEST = 10000;

// Validation schemas
const createFolderSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  order: z.number().optional()
});

const addBookmarkToFoldersSchema = z.object({
  bookmarkId: z.string().min(1, 'Bookmark ID is required'),
  folderIds: z.array(z.string().min(1)).min(1, 'At least one folder ID is required')
});

const removeBookmarkFromFolderSchema = z.object({
  bookmarkId: z.string().min(1, 'Bookmark ID is required'),
  folderId: z.string().min(1, 'Folder ID is required')
});

const updateFolderSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long')
});

/**
 * GET /api/bookmark-folders
 * List all folders for the authenticated user, ordered by `order`
 */
export const getBookmarkFolders = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Ensure default folder exists
    await ensureDefaultFolder(userId);

    const folders = await BookmarkFolder.find({ userId })
      .sort({ order: 1, createdAt: 1 });

    res.json(normalizeDocs(folders));
  } catch (error: any) {
    // Audit Phase-1 Fix: Use structured logging and Sentry capture
    const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.userId, req.path);
    requestLogger.error({
      msg: '[BookmarkFolders] Get folders error',
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
    captureException(error instanceof Error ? error : new Error(String(error)), { requestId: req.id, route: req.path });
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * POST /api/bookmark-folders
 * Create a new folder
 */
export const createBookmarkFolder = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const validationResult = createFolderSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: validationResult.error.errors
      });
    }

    const { name, order } = validationResult.data;

    // Check if folder name already exists for this user
    // SECURITY: createExactMatchRegex escapes user input to prevent ReDoS
    const existing = await BookmarkFolder.findOne({
      userId,
      name: { $regex: createExactMatchRegex(name) }
    });

    if (existing) {
      return res.status(409).json({ message: 'Folder name already exists' });
    }

    // Get max order to append new folder
    const maxOrderFolder = await BookmarkFolder.findOne({ userId })
      .sort({ order: -1 });
    const newOrder = order !== undefined ? order : ((maxOrderFolder?.order ?? -1) + 1);

    const folder = await BookmarkFolder.create({
      userId,
      name: name.trim(),
      order: newOrder,
      isDefault: false,
      createdAt: new Date().toISOString()
    });

    res.status(201).json(normalizeDoc(folder));
  } catch (error: any) {
    // Audit Phase-1 Fix: Use structured logging and Sentry capture
    const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.userId, req.path);
    requestLogger.error({
      msg: '[BookmarkFolders] Create folder error',
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
    captureException(error instanceof Error ? error : new Error(String(error)), { requestId: req.id, route: req.path });
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * PATCH /api/bookmark-folders/:id
 * Update a folder name (cannot rename default folder)
 */
export const updateBookmarkFolder = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const validationResult = updateFolderSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: validationResult.error.errors
      });
    }

    const { name } = validationResult.data;
    const trimmedName = name.trim();

    if (!trimmedName) {
      return res.status(400).json({ message: 'Name cannot be empty' });
    }

    const folder = await BookmarkFolder.findById(req.params.id);
    
    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    if (folder.userId !== userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (folder.isDefault) {
      return res.status(403).json({ message: 'Cannot rename default folder' });
    }

    // Skip update if name is unchanged (case-insensitive)
    if (folder.name.toLowerCase() === trimmedName.toLowerCase()) {
      return res.json(normalizeDoc(folder));
    }

    // Check if folder name already exists for this user (excluding current folder)
    // Use same pattern as create endpoint for consistency
    const existing = await BookmarkFolder.findOne({
      userId,
      _id: { $ne: req.params.id },
      name: { $regex: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    });

    if (existing) {
      return res.status(400).json({ message: 'Folder name already exists' });
    }

    // Update folder name
    folder.name = trimmedName;
    await folder.save();

    res.json(normalizeDoc(folder));
  } catch (error: any) {
    // Audit Phase-1 Fix: Use structured logging and Sentry capture
    const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.userId, req.path);
    requestLogger.error({
      msg: '[BookmarkFolders] Update folder error',
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
    captureException(error instanceof Error ? error : new Error(String(error)), { requestId: req.id, route: req.path });
    // Handle unique constraint violation (if regex check somehow missed it)
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Folder name already exists' });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * DELETE /api/bookmark-folders/:id
 * Delete a folder (cannot delete default folder)
 */
export const deleteBookmarkFolder = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const folder = await BookmarkFolder.findById(req.params.id);
    
    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    if (folder.userId !== userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (folder.isDefault) {
      return res.status(400).json({ message: 'Cannot delete default folder' });
    }

    // Delete all folder links (this does NOT delete bookmarks)
    await BookmarkFolderLink.deleteMany({ folderId: folder._id.toString() });

    // Delete the folder
    await BookmarkFolder.findByIdAndDelete(req.params.id);

    res.status(204).send();
  } catch (error: any) {
    // Audit Phase-1 Fix: Use structured logging and Sentry capture
    const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.userId, req.path);
    requestLogger.error({
      msg: '[BookmarkFolders] Delete folder error',
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
    captureException(error instanceof Error ? error : new Error(String(error)), { requestId: req.id, route: req.path });
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * GET /api/bookmarks?folderId=...
 * List bookmarks by folder
 * If folderId = General (or default), includes:
 *   - Bookmarks explicitly linked to General
 *   - Bookmarks with NO folder links (legacy bookmarks)
 */
export const getBookmarksByFolder = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const folderId = req.query.folderId as string;

    if (!folderId) {
      return res.status(400).json({ message: 'folderId query parameter is required' });
    }

    // Ensure default folder exists
    const generalFolderId = await getGeneralFolderId(userId);
    const isGeneralFolder = folderId === generalFolderId;

    let bookmarkIds: string[] = [];

    if (isGeneralFolder) {
      // For General folder:
      // 1. Get bookmarks explicitly linked to General
      // Audit Phase-1 Fix: Add limit to prevent unbounded query
      const generalLinks = await BookmarkFolderLink.find({ folderId: generalFolderId })
        .limit(MAX_BOOKMARK_IDS_IN_REQUEST)
        .lean();
      const linkedBookmarkIds = generalLinks.map(link => link.bookmarkId);

      // 2. Get all user's bookmarks
      // Audit Phase-1 Fix: Add limit to prevent unbounded query
      const allBookmarks = await Bookmark.find({ userId })
        .limit(MAX_BOOKMARKS_PER_USER)
        .lean();
      const allBookmarkIds = allBookmarks.map(b => b._id.toString());

      // 3. Get bookmarks with folder links
      // Audit Phase-1 Fix: Add limit to prevent unbounded query
      const allLinks = await BookmarkFolderLink.find({
        bookmarkId: { $in: allBookmarkIds }
      })
        .limit(MAX_BOOKMARK_IDS_IN_REQUEST)
        .lean();
      const bookmarksWithLinks = new Set(allLinks.map(link => link.bookmarkId));

      // 4. Legacy bookmarks = bookmarks with NO folder links
      const legacyBookmarkIds = allBookmarkIds.filter(id => !bookmarksWithLinks.has(id));

      // 5. Combine: explicit General links + legacy bookmarks
      bookmarkIds = [...new Set([...linkedBookmarkIds, ...legacyBookmarkIds])];
    } else {
      // For other folders: only get bookmarks explicitly linked
      // Audit Phase-1 Fix: Add limit to prevent unbounded query
      const links = await BookmarkFolderLink.find({ folderId })
        .limit(MAX_BOOKMARK_IDS_IN_REQUEST)
        .lean();
      bookmarkIds = links.map(link => link.bookmarkId);
    }

    // Audit Phase-1 Fix: Validate bookmarkIds array size before query
    if (bookmarkIds.length > MAX_BOOKMARK_IDS_IN_REQUEST) {
      return res.status(400).json({ 
        message: `Too many bookmarks requested (max ${MAX_BOOKMARK_IDS_IN_REQUEST})` 
      });
    }

    // Get bookmark documents and extract nuggetIds
    const bookmarks = await Bookmark.find({
      _id: { $in: bookmarkIds },
      userId
    })
      .limit(MAX_BOOKMARK_IDS_IN_REQUEST)
      .lean();

    const nuggetIds = bookmarks.map(b => b.nuggetId);

    res.json({ nuggetIds });
  } catch (error: any) {
    // Audit Phase-1 Fix: Use structured logging and Sentry capture
    const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.userId, req.path);
    requestLogger.error({
      msg: '[BookmarkFolders] Get bookmarks by folder error',
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
    captureException(error instanceof Error ? error : new Error(String(error)), { requestId: req.id, route: req.path });
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * POST /api/bookmarks
 * Create a bookmark (and ensure it's in General folder)
 * Body: { nuggetId }
 */
export const createBookmark = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { nuggetId } = req.body;
    if (!nuggetId) {
      return res.status(400).json({ message: 'nuggetId is required' });
    }

    // Get or create bookmark
    const bookmarkId = await getOrCreateBookmark(userId, nuggetId);

    // Ensure default folder exists
    const generalFolderId = await ensureDefaultFolder(userId);

    // Ensure bookmark is linked to General folder
    const existingLink = await BookmarkFolderLink.findOne({
      bookmarkId,
      folderId: generalFolderId
    });

    if (!existingLink) {
      await BookmarkFolderLink.create({
        userId,
        bookmarkId,
        folderId: generalFolderId,
        createdAt: new Date().toISOString()
      });
    }

    res.status(201).json({ bookmarkId, folderIds: [generalFolderId] });
  } catch (error: any) {
    // Audit Phase-1 Fix: Use structured logging and Sentry capture
    const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.userId, req.path);
    requestLogger.error({
      msg: '[BookmarkFolders] Create bookmark error',
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
    captureException(error instanceof Error ? error : new Error(String(error)), { requestId: req.id, route: req.path });
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * DELETE /api/bookmarks/:nuggetId
 * Delete a bookmark (and all folder links)
 */
export const deleteBookmark = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const nuggetId = req.params.nuggetId;
    const bookmark = await Bookmark.findOne({ userId, nuggetId });

    if (!bookmark) {
      return res.status(404).json({ message: 'Bookmark not found' });
    }

    const bookmarkId = bookmark._id.toString();

    // Delete all folder links
    await BookmarkFolderLink.deleteMany({ bookmarkId });

    // Delete bookmark
    await Bookmark.findByIdAndDelete(bookmarkId);

    res.status(204).send();
  } catch (error: any) {
    // Audit Phase-1 Fix: Use structured logging and Sentry capture
    const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.userId, req.path);
    requestLogger.error({
      msg: '[BookmarkFolders] Delete bookmark error',
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
    captureException(error instanceof Error ? error : new Error(String(error)), { requestId: req.id, route: req.path });
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * GET /api/bookmarks/:nuggetId/folders
 * Get folders that contain a specific bookmark
 */
export const getBookmarkFoldersForNugget = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const nuggetId = req.params.nuggetId;

    // Find bookmark
    const bookmark = await Bookmark.findOne({ userId, nuggetId });
    
    if (!bookmark) {
      // Bookmark doesn't exist - return empty array
      return res.json({ folderIds: [] });
    }

    const bookmarkId = bookmark._id.toString();

    // Get folder links
    const links = await BookmarkFolderLink.find({ bookmarkId });
    const folderIds = links.map(link => link.folderId);

    res.json({ folderIds });
  } catch (error: any) {
    // Audit Phase-1 Fix: Use structured logging and Sentry capture
    const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.userId, req.path);
    requestLogger.error({
      msg: '[BookmarkFolders] Get bookmark folders error',
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
    captureException(error instanceof Error ? error : new Error(String(error)), { requestId: req.id, route: req.path });
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * POST /api/bookmark-folder-links
 * Add bookmark to folders (idempotent)
 * Body: { bookmarkId, folderIds: string[] }
 */
export const addBookmarkToFolders = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const validationResult = addBookmarkToFoldersSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: validationResult.error.errors
      });
    }

    const { bookmarkId, folderIds } = validationResult.data;

    // Verify bookmark belongs to user
    const bookmark = await Bookmark.findById(bookmarkId);
    if (!bookmark || bookmark.userId !== userId) {
      return res.status(404).json({ message: 'Bookmark not found' });
    }

    // Verify all folders belong to user
    const folders = await BookmarkFolder.find({
      _id: { $in: folderIds },
      userId
    });

    if (folders.length !== folderIds.length) {
      return res.status(400).json({ message: 'One or more folders not found' });
    }

    // Create links (idempotent - ignore duplicates)
    const createdLinks = [];
    for (const folderId of folderIds) {
      try {
        const link = await BookmarkFolderLink.create({
          userId,
          bookmarkId,
          folderId,
          createdAt: new Date().toISOString()
        });
        createdLinks.push(link);
      } catch (error: any) {
        // Ignore duplicate key errors (idempotent behavior)
        if (error.code !== 11000) {
          throw error;
        }
      }
    }

    res.status(201).json({
      message: 'Bookmark added to folders',
      created: createdLinks.length,
      skipped: folderIds.length - createdLinks.length
    });
  } catch (error: any) {
    // Audit Phase-1 Fix: Use structured logging and Sentry capture
    const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.userId, req.path);
    requestLogger.error({
      msg: '[BookmarkFolders] Add bookmark to folders error',
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
    captureException(error instanceof Error ? error : new Error(String(error)), { requestId: req.id, route: req.path });
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * DELETE /api/bookmark-folder-links?bookmarkId=...&folderId=...
 * Remove bookmark from folder
 * Query params: bookmarkId, folderId
 * If last folder removed → auto-link to General
 */
export const removeBookmarkFromFolder = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const bookmarkId = req.query.bookmarkId as string;
    const folderId = req.query.folderId as string;

    if (!bookmarkId || !folderId) {
      return res.status(400).json({
        message: 'bookmarkId and folderId query parameters are required'
      });
    }

    // Verify bookmark belongs to user
    const bookmark = await Bookmark.findById(bookmarkId);
    if (!bookmark || bookmark.userId !== userId) {
      return res.status(404).json({ message: 'Bookmark not found' });
    }

    // Get General folder ID
    const generalFolderId = await getGeneralFolderId(userId);

    // Don't allow removing from General if it's the only folder
    const allLinks = await BookmarkFolderLink.find({ bookmarkId });
    
    if (allLinks.length === 1 && folderId === generalFolderId) {
      return res.status(400).json({ message: 'Cannot remove bookmark from General folder if it is the only folder' });
    }

    // Remove the link
    const deleteResult = await BookmarkFolderLink.deleteOne({ bookmarkId, folderId });
    
    if (deleteResult.deletedCount === 0) {
      // Link didn't exist - might have been already deleted, but that's okay
      console.warn(`[BookmarkFolders] Link not found for bookmarkId=${bookmarkId}, folderId=${folderId}`);
    }

    // Ensure bookmark is still in at least one folder (General fallback)
    // Only check if we actually deleted a link
    if (deleteResult.deletedCount > 0) {
      await ensureBookmarkInGeneralFolder(bookmarkId, userId);
    }

    res.status(204).send();
  } catch (error: any) {
    // Audit Phase-1 Fix: Use structured logging and Sentry capture
    const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.userId, req.path);
    requestLogger.error({
      msg: '[BookmarkFolders] Remove bookmark from folder error',
      error: {
        message: error.message,
        stack: error.stack,
      },
      bookmarkId: req.query.bookmarkId,
      folderId: req.query.folderId,
    });
    captureException(error instanceof Error ? error : new Error(String(error)), { requestId: req.id, route: req.path });
    res.status(500).json({ 
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

