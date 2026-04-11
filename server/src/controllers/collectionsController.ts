import { Request, Response } from 'express';
import { Collection } from '../models/Collection.js';
import { Article } from '../models/Article.js';
import { Tag } from '../models/Tag.js';
import { User } from '../models/User.js';
import { normalizeDoc, normalizeDocs, normalizeArticleDocs } from '../utils/db.js';
import { createCollectionSchema, updateCollectionSchema, addEntrySchema, batchEntriesSchema, flagEntrySchema, setFeaturedSchema, reorderFeaturedSchema } from '../utils/validation.js';
import { getCommunityCollections, getCommunityCollectionsCount, CollectionQueryFilters } from '../utils/collectionQueryHelpers.js';
import { createSearchRegex, createExactMatchRegex } from '../utils/escapeRegExp.js';
import { createRequestLogger } from '../utils/logger.js';
import { captureException } from '../utils/sentry.js';

/**
 * PHASE 1: Helper function to check if user has permission to modify a collection
 * Returns true if user is the creator OR user is an admin
 */
function canModifyCollection(
  collection: { creatorId: unknown; type: string },
  userId: string | undefined,
  userRole: string | undefined
): boolean {
  if (!userId) return false;
  const normalizedRole = userRole?.toLowerCase();
  // Admin can modify any collection
  if (normalizedRole === 'admin') return true;
  // Creator can modify their own collection
  return String(collection.creatorId) === String(userId);
}

/**
 * PHASE 1: Helper function to check if user has permission to view a collection
 * Returns true if collection is public OR user is creator OR user is admin
 */
function canViewCollection(
  collection: { creatorId: unknown; type: string },
  userId: string | undefined,
  userRole: string | undefined
): boolean {
  // Public collections are viewable by anyone
  if (collection.type === 'public') return true;
  if (!userId) return false;
  // Admin can view any collection
  if (userRole?.toLowerCase() === 'admin') return true;
  // Creator can view their own private collection
  return String(collection.creatorId) === String(userId);
}

/**
 * PHASE 1: Helper function to check if user can add/remove entries from a collection
 * Returns true if collection is public OR user is creator OR user is admin
 */
function canModifyCollectionEntries(
  collection: { creatorId: unknown; type: string },
  userId: string | undefined,
  userRole: string | undefined
): boolean {
  if (!userId) return false;
  // Admin can modify entries in any collection
  if (userRole?.toLowerCase() === 'admin') return true;
  // Public collections allow anyone to add/remove entries
  if (collection.type === 'public') return true;
  // Private collections: only creator can modify entries
  return String(collection.creatorId) === String(userId);
}

function buildRootCollectionQuery() {
  return { $or: [{ parentId: null }, { parentId: { $exists: false } }] };
}

async function addEntryIfMissing(
  collectionId: string,
  articleId: string,
  addedByUserId: string,
  addedAt: string
) {
  return Collection.findOneAndUpdate(
    {
      _id: collectionId,
      'entries.articleId': { $ne: articleId },
    },
    {
      $addToSet: {
        entries: {
          articleId,
          addedByUserId,
          addedAt,
          flaggedBy: [],
        },
      },
      $set: {
        updatedAt: new Date().toISOString(),
      },
      $inc: { validEntriesCount: 1 },
    },
    {
      new: true,
      runValidators: true,
    }
  );
}

export const getCollections = async (req: Request, res: Response) => {
  try {
    // Parse query parameters
    const type = req.query.type as 'public' | 'private' | undefined;
    const searchQuery = req.query.q as string | undefined;
    const creatorId = req.query.creatorId as string | undefined;
    const includeCount = req.query.includeCount === 'true';
    const userId = (req as any).user?.userId;
    const parentId = req.query.parentId as string | undefined;
    const rootOnly = req.query.rootOnly === 'true';
    
    // PHASE 1: Filter private collections - require authentication
    // Admins can see all private collections, regular users only see their own
    const userRole = (req as any).user?.role;
    const isAdmin = typeof userRole === 'string' && userRole.toLowerCase().trim() === 'admin';
    
    if (type === 'private' && !userId) {
      return res.status(401).json({ message: 'Authentication required to view private collections' });
    }
    
    // Pagination parameters (MANDATORY - no unbounded lists)
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 25, 1), 100);
    const skip = (page - 1) * limit;
    
    // PHASE 5: Parse sort parameters from query string
    const sortField = req.query.sortField as 'created' | 'updated' | 'followers' | 'nuggets' | 'name' | undefined;
    const sortDirection = req.query.sortDirection as 'asc' | 'desc' | undefined;
    
    // Build filters using shared query helper
    const filters: CollectionQueryFilters = {};
    if (type) filters.type = type;
    if (searchQuery) filters.searchQuery = searchQuery;
    if (creatorId) filters.creatorId = creatorId;
    
    // Build MongoDB query
    const query: any = {};
    if (type === 'private') {
      // PHASE 1: Admins can see all private collections, regular users only see their own
      query.type = 'private';
      if (!isAdmin) {
        // Regular users: only their own private collections
        query.creatorId = userId;
      }
      // Admins: no creatorId filter, see all private collections
    } else {
      // Default to public only (unless type explicitly set)
      query.type = type || 'public';
      // Allow creatorId filtering for public collections
      if (creatorId) query.creatorId = creatorId;
    }
    // SECURITY: createSearchRegex escapes user input to prevent ReDoS
    // Search by canonicalName (case-insensitive) and rawName (for display matching)
    if (searchQuery) {
      const searchRegex = createSearchRegex(searchQuery);
      const searchCanonical = searchQuery.toLowerCase().trim();
      query.$or = [
        { canonicalName: { $regex: createSearchRegex(searchCanonical) } },
        { rawName: searchRegex },
        { description: searchRegex }
      ];
    }

    if (parentId && parentId.trim().length > 0) {
      query.parentId = parentId.trim();
    } else if (rootOnly) {
      const rootFilter = buildRootCollectionQuery();
      if (query.$or) {
        query.$and = [{ $or: query.$or }, rootFilter];
        delete query.$or;
      } else {
        Object.assign(query, rootFilter);
      }
    }
    
    // PHASE 5: Build sort object based on sortField and sortDirection
    const sortObj: any = {};
    if (sortField) {
      switch (sortField) {
        case 'created':
          sortObj.createdAt = sortDirection === 'asc' ? 1 : -1;
          break;
        case 'updated':
          sortObj.updatedAt = sortDirection === 'asc' ? 1 : -1;
          break;
        case 'followers':
          sortObj.followersCount = sortDirection === 'asc' ? 1 : -1;
          break;
        case 'nuggets':
          // Note: validEntriesCount may not be indexed, but MongoDB can still sort
          sortObj.validEntriesCount = sortDirection === 'asc' ? 1 : -1;
          break;
        case 'name':
          sortObj.rawName = sortDirection === 'asc' ? 1 : -1;
          break;
        default:
          sortObj.createdAt = -1; // Default sort
      }
    } else {
      // Default sort by creation date descending
      sortObj.createdAt = -1;
    }
    
    // Get collections with pagination and sorting
    const [collections, total] = await Promise.all([
      Collection.find(query)
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .lean(),
      Collection.countDocuments(query)
    ]);
    
    // PATCH 5: Batch entry validation - replace N+1 queries with single batch query
    // Collect all article IDs from all collections
    const allArticleIds = new Set<string>();
    collections.forEach(collection => {
      collection.entries.forEach(entry => {
        allArticleIds.add(entry.articleId);
      });
    });

    // Single batch query to get all valid article IDs
    const validArticleIds = new Set(
      (await Article.find({ _id: { $in: Array.from(allArticleIds) } }).select('_id').lean())
        .map(doc => doc._id.toString())
    );

    // Process collections to validate entries and set validEntriesCount
    const validatedCollections = await Promise.all(
      collections.map(async (collection) => {
        // Filter entries to only those with valid article IDs
        const validEntries = collection.entries.filter(entry => validArticleIds.has(entry.articleId));
        
        const validCount = validEntries.length;
        
        // PHASE 2: If entries were filtered or validEntriesCount is missing/incorrect, update atomically
        if (validEntries.length !== collection.entries.length || 
            collection.validEntriesCount === undefined || 
            collection.validEntriesCount === null ||
            collection.validEntriesCount !== validCount) {
          
          // PHASE 6: Log invalid entry removals for observability
          const removedCount = collection.entries.length - validEntries.length;
          if (removedCount > 0) {
            const requestLogger = createRequestLogger(req.id || 'unknown', userId, req.path);
            requestLogger.warn({
              msg: '[Collections] Invalid entries removed during validation',
              collectionId: collection._id.toString(),
              removedCount,
              totalEntries: collection.entries.length,
              validEntries: validCount,
            });
          }
          
          // PHASE 2: Use findOneAndUpdate for atomic update to prevent race conditions
          // This ensures only one validation update happens at a time per collection
          await Collection.findOneAndUpdate(
            { _id: collection._id },
            {
              entries: validEntries,
              validEntriesCount: validCount,
              updatedAt: new Date().toISOString()
            },
            { new: false } // Don't need to return updated doc
          );
          
          // Update local object for response
          collection.entries = validEntries;
          collection.validEntriesCount = validCount;
        }
        
        return collection;
      })
    );
    
    // Return paginated response
    res.json({
      data: normalizeDocs(validatedCollections),
      total,
      page,
      limit,
      hasMore: page * limit < total
    });
  } catch (error: any) {
    // Audit Phase-1 Fix: Use structured logging and Sentry capture
    const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.userId, req.path);
    requestLogger.error({
      msg: '[Collections] Get collections error',
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
    captureException(error instanceof Error ? error : new Error(String(error)), { requestId: req.id, route: req.path });
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getCollectionById = async (req: Request, res: Response) => {
  try {
    const collection = await Collection.findById(req.params.id).lean();
    if (!collection) return res.status(404).json({ message: 'Collection not found' });
    
    // PHASE 1: Check collection access with admin override
    const userId = (req as any).user?.userId;
    const userRole = (req as any).user?.role;
    if (!canViewCollection(collection, userId, userRole)) {
      return res.status(403).json({ message: 'You do not have permission to view this collection' });
    }
    
    // PATCH 5: Batch entry validation - replace N+1 queries with single batch query
    const articleIds = collection.entries.map(entry => entry.articleId);
    const validArticleIds = new Set(
      (await Article.find({ _id: { $in: articleIds } }).select('_id').lean())
        .map(doc => doc._id.toString())
    );
    const validEntries = collection.entries.filter(entry => validArticleIds.has(entry.articleId));
    
    const validCount = validEntries.length;
    
    // PHASE 2: If entries were filtered or validEntriesCount is missing/incorrect, update atomically
    if (validEntries.length !== collection.entries.length || 
        collection.validEntriesCount === undefined || 
        collection.validEntriesCount === null ||
        collection.validEntriesCount !== validCount) {
      
      // PHASE 6: Log invalid entry removals for observability
      const removedCount = collection.entries.length - validEntries.length;
      if (removedCount > 0) {
        const requestLogger = createRequestLogger(req.id || 'unknown', userId, req.path);
        requestLogger.warn({
          msg: '[Collections] Invalid entries removed during validation',
          collectionId: req.params.id,
          removedCount,
          totalEntries: collection.entries.length,
          validEntries: validCount,
        });
      }
      
      // PHASE 2: Use findOneAndUpdate for atomic update to prevent race conditions
      // This ensures only one validation update happens at a time per collection
      await Collection.findOneAndUpdate(
        { _id: req.params.id },
        {
          entries: validEntries,
          validEntriesCount: validCount,
          updatedAt: new Date().toISOString()
        },
        { new: false } // Don't need to return updated doc
      );
      
      // Update local object for response
      collection.entries = validEntries;
      collection.validEntriesCount = validCount;
    }
    
    res.json(normalizeDoc(collection));
  } catch (error: any) {
    // Audit Phase-1 Fix: Use structured logging and Sentry capture
    const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.userId, req.path);
    requestLogger.error({
      msg: '[Collections] Get collection by ID error',
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
    captureException(error instanceof Error ? error : new Error(String(error)), { requestId: req.id, route: req.path });
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const createCollection = async (req: Request, res: Response) => {
  try {
    // PATCH 1: Use authenticated user ID, ignore client-provided creatorId
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Validate input
    const validationResult = createCollectionSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: validationResult.error.errors 
      });
    }

    const { name, description, type, parentId } = validationResult.data;
    const creatorId = userId; // USE AUTHENTICATED USER, NOT CLIENT PROVIDED
    
    // PHASE 4: Validate creatorId existence (even though it's the authenticated user)
    const creatorExists = await User.exists({ _id: creatorId });
    if (!creatorExists) {
      const requestLogger = createRequestLogger(req.id || 'unknown', userId, req.path);
      requestLogger.warn({
        msg: '[Collections] Create collection with invalid creatorId',
        creatorId,
      });
      return res.status(400).json({ 
        message: 'Invalid creator ID - user does not exist' 
      });
    }
    
    const trimmedName = name.trim();
    const canonicalName = trimmedName.toLowerCase();
    let normalizedParentId: string | null = null;
    if (typeof parentId === 'string' && parentId.trim().length > 0) {
      normalizedParentId = parentId.trim();
      const parentCollection = await Collection.findById(normalizedParentId).select('parentId type').lean();
      if (!parentCollection) {
        return res.status(400).json({ message: 'Parent collection not found' });
      }
      // One-level hierarchy: parent collection itself cannot already be a child.
      if (parentCollection.parentId) {
        return res.status(400).json({ message: 'Only one level of sub-collections is supported' });
      }
      // Keep parent/child visibility consistent to avoid unexpected visibility rules.
      if (parentCollection.type !== (type || 'public')) {
        return res.status(400).json({ message: 'Sub-collection type must match parent collection type' });
      }
    }

    // PHASE 2: Check if collection already exists by canonicalName
    // For private collections: check per creator (same creator can't have duplicate canonicalName)
    // For public collections: check globally (anyone can't create duplicate canonicalName)
    const query: any = { canonicalName };
    if (type === 'private') {
      query.creatorId = creatorId;
      query.type = 'private';
    } else {
      // Public collections are unique within the same parent scope.
      query.type = 'public';
      if (normalizedParentId) {
        query.parentId = normalizedParentId;
      } else {
        Object.assign(query, buildRootCollectionQuery());
      }
    }

    const existingCollection = await Collection.findOne(query);
    if (existingCollection) {
      // Return existing collection instead of creating duplicate
      return res.status(200).json(normalizeDoc(existingCollection));
    }

    const newCollection = await Collection.create({
      rawName: trimmedName,
      canonicalName: canonicalName,
      description: description || '',
      creatorId,
      type: type || 'public',
      parentId: normalizedParentId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      followersCount: 0,
      followers: [],
      entries: []
    });
    
    res.status(201).json(normalizeDoc(newCollection));
  } catch (error: any) {
    // Audit Phase-1 Fix: Use structured logging and Sentry capture
    const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.userId, req.path);
    requestLogger.error({
      msg: '[Collections] Create collection error',
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
    captureException(error instanceof Error ? error : new Error(String(error)), { requestId: req.id, route: req.path });
    
    // PHASE 2: Handle duplicate key error (MongoDB unique constraint on canonicalName)
    if (error.code === 11000) {
      // Try to find and return existing collection
      const trimmedName = (req.body.name || '').trim();
      const canonicalName = trimmedName.toLowerCase();
      const collectionType = req.body.type || 'public';
      const requestedParentId = typeof req.body.parentId === 'string' && req.body.parentId.trim().length > 0
        ? req.body.parentId.trim()
        : null;
      const query: any = { canonicalName };
      if (collectionType === 'private') {
        query.creatorId = userId; // Use authenticated user ID
        query.type = 'private';
      } else {
        query.type = 'public';
        if (requestedParentId) {
          query.parentId = requestedParentId;
        } else {
          Object.assign(query, buildRootCollectionQuery());
        }
      }
      const existingCollection = await Collection.findOne(query);
      if (existingCollection) {
        // PHASE 6: Contextual message - collection exists, return it
        return res.status(200).json(normalizeDoc(existingCollection));
      }
      // PHASE 6: Contextual error message indicating which field caused the conflict
      const errorKey = error.keyPattern ? Object.keys(error.keyPattern)[0] : 'name';
      return res.status(409).json({ 
        message: `A collection with this ${errorKey === 'canonicalName' ? 'name' : errorKey} already exists`,
        code: 'DUPLICATE_COLLECTION',
        field: errorKey
      });
    }
    
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateCollection = async (req: Request, res: Response) => {
  try {
    // PHASE 1: Ownership check with admin override - verify user is creator OR admin
    const collection = await Collection.findById(req.params.id);
    if (!collection) return res.status(404).json({ message: 'Collection not found' });
    
    const userId = (req as any).user?.userId;
    const userRole = (req as any).user?.role;
    if (!canModifyCollection(collection, userId, userRole)) {
      return res.status(403).json({ message: 'You do not have permission to update this collection' });
    }

    // Validate input
    const validationResult = updateCollectionSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: validationResult.error.errors 
      });
    }

    // FOLLOW-UP REFACTOR: Safely construct update data, excluding undefined fields (P1-18)
    // Zod's .partial() allows undefined fields, but we don't want to explicitly set undefined
    // Filter out undefined values to prevent unintended field clearing
    const safeUpdateData: any = { updatedAt: new Date().toISOString() };
    Object.keys(validationResult.data).forEach(key => {
      const value = (validationResult.data as any)[key];
      // Only include defined (non-undefined) values in update
      if (value !== undefined) {
        safeUpdateData[key] = value;
      }
    });
    
    // creatorId is already excluded by schema, but double-check for safety
    delete safeUpdateData.creatorId;
    
    const updateData = safeUpdateData;
    
    // PHASE 2: If name is being updated, update both rawName and canonicalName
    if (updateData.name !== undefined) {
      const trimmedName = updateData.name.trim();
      const canonicalName = trimmedName.toLowerCase();
      
      // PHASE 2: Check if the new canonicalName would create a duplicate
      // For private collections: check per creator
      // For public collections: check globally (no creatorId filter)
      const duplicateQuery: any = {
        canonicalName,
        _id: { $ne: req.params.id } // Exclude current collection
      };
      
      const targetType = updateData.type || collection.type;
      if (targetType === 'private') {
        duplicateQuery.creatorId = collection.creatorId;
        duplicateQuery.type = 'private';
      } else {
        duplicateQuery.type = 'public';
        const targetParentId =
          Object.prototype.hasOwnProperty.call(updateData, 'parentId') && updateData.parentId
            ? updateData.parentId
            : collection.parentId;
        if (targetParentId) {
          duplicateQuery.parentId = targetParentId;
        } else {
          Object.assign(duplicateQuery, buildRootCollectionQuery());
        }
      }
      
      const existingCollection = await Collection.findOne(duplicateQuery);
      if (existingCollection) {
        return res.status(409).json({ message: 'A collection with this name already exists' });
      }
      
      updateData.rawName = trimmedName;
      updateData.canonicalName = canonicalName;
      delete updateData.name; // Remove legacy name field
    }

    if (Object.prototype.hasOwnProperty.call(updateData, 'parentId')) {
      const requestedParentId = updateData.parentId;
      if (requestedParentId === '' || requestedParentId === undefined) {
        updateData.parentId = null;
      } else if (requestedParentId === req.params.id) {
        return res.status(400).json({ message: 'Collection cannot be its own parent' });
      } else if (typeof requestedParentId === 'string') {
        const parentCollection = await Collection.findById(requestedParentId).select('parentId type').lean();
        if (!parentCollection) {
          return res.status(400).json({ message: 'Parent collection not found' });
        }
        if (parentCollection.parentId) {
          return res.status(400).json({ message: 'Only one level of sub-collections is supported' });
        }
        const targetType = updateData.type || collection.type;
        if (parentCollection.type !== targetType) {
          return res.status(400).json({ message: 'Sub-collection type must match parent collection type' });
        }
      }
    }

    const updatedCollection = await Collection.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!updatedCollection) return res.status(404).json({ message: 'Collection not found' });
    res.json(normalizeDoc(updatedCollection));
  } catch (error: any) {
    // Audit Phase-1 Fix: Use structured logging and Sentry capture
    const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.userId, req.path);
    requestLogger.error({
      msg: '[Collections] Update collection error',
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
    captureException(error instanceof Error ? error : new Error(String(error)), { requestId: req.id, route: req.path });
    
    // PHASE 6: Handle duplicate key error with contextual message
    if (error.code === 11000) {
      // Try to find the conflicting collection
      const updateData = validationResult?.data || req.body;
      if (updateData?.name) {
        const trimmedName = updateData.name.trim();
        const canonicalName = trimmedName.toLowerCase();
        const targetType = updateData.type || collection?.type || 'public';
        const duplicateQuery: any = { canonicalName };
        
        if (targetType === 'private') {
          duplicateQuery.creatorId = collection?.creatorId;
          duplicateQuery.type = 'private';
        } else {
          duplicateQuery.type = 'public';
          const targetParentId = updateData.parentId || collection?.parentId;
          if (targetParentId) {
            duplicateQuery.parentId = targetParentId;
          } else {
            Object.assign(duplicateQuery, buildRootCollectionQuery());
          }
        }
        
        const existingCollection = await Collection.findOne(duplicateQuery);
        if (existingCollection) {
          // PHASE 6: Contextual error message
          return res.status(409).json({ 
            message: `A ${targetType} collection with this name already exists`,
            code: 'DUPLICATE_COLLECTION_NAME',
            field: 'name',
            conflictingCollectionId: existingCollection._id.toString()
          });
        }
      }
      // PHASE 6: Contextual error message indicating which field caused the conflict
      const errorKey = error.keyPattern ? Object.keys(error.keyPattern)[0] : 'name';
      return res.status(409).json({ 
        message: `A collection with this ${errorKey === 'canonicalName' ? 'name' : errorKey} already exists`,
        code: 'DUPLICATE_COLLECTION',
        field: errorKey
      });
    }
    
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteCollection = async (req: Request, res: Response) => {
  try {
    // PHASE 1: Ownership check with admin override - verify user is creator OR admin
    const collection = await Collection.findById(req.params.id);
    if (!collection) return res.status(404).json({ message: 'Collection not found' });
    
    const userId = (req as any).user?.userId;
    const userRole = (req as any).user?.role;
    if (!canModifyCollection(collection, userId, userRole)) {
      return res.status(403).json({ message: 'You do not have permission to delete this collection' });
    }

    // PHASE 3: Cascade cleanup - remove collection references from followers
    // Note: Followers are stored in the collection itself, so deleting the collection
    // automatically removes them. However, if User preferences store collection references
    // in the future, this is where we would clean them up.
    // For now, we log the deletion for potential future cleanup needs.
    const followersCount = collection.followers?.length || 0;
    if (followersCount > 0) {
      const requestLogger = createRequestLogger(req.id || 'unknown', userId, req.path);
      requestLogger.info({
        msg: '[Collections] Deleting collection with followers',
        collectionId: req.params.id,
        followersCount,
        // Future: Clean up user preferences if they reference this collection
      });
    }

    await Collection.findByIdAndDelete(req.params.id);
    res.status(204).send();
  } catch (error: any) {
    // Audit Phase-1 Fix: Use structured logging and Sentry capture
    const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.userId, req.path);
    requestLogger.error({
      msg: '[Collections] Delete collection error',
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
    captureException(error instanceof Error ? error : new Error(String(error)), { requestId: req.id, route: req.path });
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const addEntry = async (req: Request, res: Response) => {
  try {
    // Validate input
    const validationResult = addEntrySchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: validationResult.error.errors 
      });
    }

    const { articleId } = validationResult.data;

    // PHASE 1: Check collection access with admin override
    const collection = await Collection.findById(req.params.id);
    if (!collection) return res.status(404).json({ message: 'Collection not found' });

    // SECURITY FIX: Always use authenticated user ID, never trust client-provided userId
    const currentUserId = (req as any).user?.userId;
    const userRole = (req as any).user?.role;
    if (!canModifyCollectionEntries(collection, currentUserId, userRole)) {
      return res.status(403).json({ message: 'You do not have permission to add entries to this collection' });
    }

    // Audit Phase-2 Fix: Validate article exists before adding to collection
    const articleExists = await Article.exists({ _id: articleId });
    if (!articleExists) {
      return res.status(400).json({
        message: `Article ${articleId} does not exist`
      });
    }

    const now = new Date().toISOString();
    // Use findOneAndUpdate with $addToSet to atomically add entry if it doesn't exist.
    // This call is reused for parent auto-linking as well.
    const updatedCollection = await addEntryIfMissing(req.params.id, articleId, currentUserId, now);
    
    if (!updatedCollection) {
      // Check if collection exists but entry already exists
      const existingCollection = await Collection.findById(req.params.id);
      if (!existingCollection) {
        return res.status(404).json({ message: 'Collection not found' });
      }
      // Even when already present in sub-collection, ensure parent also has the entry.
      if (collection.parentId) {
        const parentCollection = await Collection.findById(collection.parentId).select('creatorId type').lean();
        if (parentCollection && canModifyCollectionEntries(parentCollection, currentUserId, userRole)) {
          await addEntryIfMissing(String(collection.parentId), articleId, currentUserId, now);
        }
      }
      // Entry already exists, return the collection as-is
      return res.json(normalizeDoc(existingCollection));
    }

    // Auto-add to parent collection when saving to a sub-collection.
    if (collection.parentId) {
      const parentCollection = await Collection.findById(collection.parentId).select('creatorId type').lean();
      if (parentCollection && canModifyCollectionEntries(parentCollection, currentUserId, userRole)) {
        await addEntryIfMissing(String(collection.parentId), articleId, currentUserId, now);
      }
    }

    // PHASE 3: Ensure validEntriesCount doesn't go negative and matches entries length
    // Use atomic update to prevent race conditions
    if (updatedCollection.validEntriesCount === undefined || 
        updatedCollection.validEntriesCount === null || 
        updatedCollection.validEntriesCount < 0 ||
        updatedCollection.validEntriesCount !== updatedCollection.entries.length) {
      
      // PHASE 3: Atomic correction to prevent race conditions
      await Collection.findOneAndUpdate(
        { _id: req.params.id },
        {
          $set: {
            validEntriesCount: Math.max(0, updatedCollection.entries.length),
            updatedAt: new Date().toISOString()
          }
        }
      );
      
      updatedCollection.validEntriesCount = Math.max(0, updatedCollection.entries.length);
    }

    res.json(normalizeDoc(updatedCollection));
  } catch (error: any) {
    // Audit Phase-1 Fix: Use structured logging and Sentry capture
    const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.userId, req.path);
    requestLogger.error({
      msg: '[Collections] Add entry error',
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
    captureException(error instanceof Error ? error : new Error(String(error)), { requestId: req.id, route: req.path });
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const removeEntry = async (req: Request, res: Response) => {
  try {
    // PHASE 1: Check collection access with admin override
    const collection = await Collection.findById(req.params.id);
    if (!collection) return res.status(404).json({ message: 'Collection not found' });
    
    const userId = (req as any).user?.userId;
    const userRole = (req as any).user?.role;
    if (!canModifyCollectionEntries(collection, userId, userRole)) {
      return res.status(403).json({ message: 'You do not have permission to remove entries from this collection' });
    }
    
    // Use findOneAndUpdate with $pull to atomically remove the entry
    const updatedCollection = await Collection.findOneAndUpdate(
      { _id: req.params.id },
      {
        $pull: {
          entries: { articleId: req.params.articleId }
        },
        $set: {
          updatedAt: new Date().toISOString()
        },
        // Decrement validEntriesCount (entry is being removed)
        $inc: { validEntriesCount: -1 }
      },
      { 
        new: true, // Return updated document
        runValidators: true 
      }
    );
    
    if (!updatedCollection) {
      return res.status(404).json({ message: 'Collection not found' });
    }

    // PHASE 3: Ensure validEntriesCount doesn't go negative and matches entries length
    // Use atomic update to prevent race conditions
    if (updatedCollection.validEntriesCount === undefined || 
        updatedCollection.validEntriesCount === null || 
        updatedCollection.validEntriesCount < 0 ||
        updatedCollection.validEntriesCount !== updatedCollection.entries.length) {
      
      // PHASE 3: Atomic correction to prevent race conditions
      await Collection.findOneAndUpdate(
        { _id: req.params.id },
        {
          $set: {
            validEntriesCount: Math.max(0, updatedCollection.entries.length),
            updatedAt: new Date().toISOString()
          }
        }
      );
      
      updatedCollection.validEntriesCount = Math.max(0, updatedCollection.entries.length);
    }

    res.json(normalizeDoc(updatedCollection));
  } catch (error: any) {
    // Audit Phase-1 Fix: Use structured logging and Sentry capture
    const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.userId, req.path);
    requestLogger.error({
      msg: '[Collections] Remove entry error',
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
    captureException(error instanceof Error ? error : new Error(String(error)), { requestId: req.id, route: req.path });
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const addBatchEntries = async (req: Request, res: Response) => {
  try {
    // Validate input
    const validationResult = batchEntriesSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: validationResult.error.errors
      });
    }

    const { articleIds } = validationResult.data;

    // PHASE 1: Check collection access with admin override
    const collection = await Collection.findById(req.params.id);
    if (!collection) return res.status(404).json({ message: 'Collection not found' });

    // SECURITY FIX: Always use authenticated user ID, never trust client-provided userId
    const currentUserId = (req as any).user?.userId;
    const userRole = (req as any).user?.role;
    if (!canModifyCollectionEntries(collection, currentUserId, userRole)) {
      return res.status(403).json({ message: 'You do not have permission to add entries to this collection' });
    }

    // Validate all articles exist in one batch query
    const existingArticles = await Article.find({ _id: { $in: articleIds } }).select('_id').lean();
    const validArticleIds = existingArticles.map((a) => String(a._id));

    if (validArticleIds.length === 0) {
      return res.status(400).json({ message: 'None of the provided article IDs exist' });
    }

    // Duplicate-safe behavior:
    // add entries only when that articleId is not already present.
    // We use per-item atomic guards in bulkWrite so repeated adds are idempotent.
    const now = new Date().toISOString();
    const buildBulkOps = (collectionId: string) =>
      validArticleIds.map((articleId) => ({
        updateOne: {
          filter: {
            _id: collectionId,
            'entries.articleId': { $ne: articleId },
          },
          update: {
            $push: {
              entries: {
                articleId,
                addedByUserId: currentUserId,
                addedAt: now,
                flaggedBy: [],
              }
            },
            $set: { updatedAt: now }
          }
        }
      }));

    const bulkOps = buildBulkOps(req.params.id);

    if (bulkOps.length > 0) {
      await Collection.bulkWrite(bulkOps);
    }

    // Auto-add all saved entries to the parent collection when target is a sub-collection.
    if (collection.parentId) {
      const parentCollection = await Collection.findById(collection.parentId).select('creatorId type').lean();
      if (parentCollection && canModifyCollectionEntries(parentCollection, currentUserId, userRole)) {
        const parentBulkOps = buildBulkOps(String(collection.parentId));
        if (parentBulkOps.length > 0) {
          await Collection.bulkWrite(parentBulkOps);
        }
      }
    }

    const updatedCollection = await Collection.findById(req.params.id);

    if (!updatedCollection) {
      return res.status(404).json({ message: 'Collection not found' });
    }

    // PHASE 3: Ensure validEntriesCount matches entries length
    if (updatedCollection.validEntriesCount === undefined ||
        updatedCollection.validEntriesCount === null ||
        updatedCollection.validEntriesCount < 0 ||
        updatedCollection.validEntriesCount !== updatedCollection.entries.length) {

      await Collection.findOneAndUpdate(
        { _id: req.params.id },
        {
          $set: {
            validEntriesCount: Math.max(0, updatedCollection.entries.length),
            updatedAt: new Date().toISOString()
          }
        }
      );

      updatedCollection.validEntriesCount = Math.max(0, updatedCollection.entries.length);
    }

    // Keep parent validEntriesCount aligned as well when we auto-linked batch entries.
    if (collection.parentId) {
      const parent = await Collection.findById(collection.parentId).select('entries validEntriesCount');
      if (parent &&
          (parent.validEntriesCount === undefined ||
            parent.validEntriesCount === null ||
            parent.validEntriesCount < 0 ||
            parent.validEntriesCount !== parent.entries.length)
      ) {
        await Collection.findOneAndUpdate(
          { _id: collection.parentId },
          {
            $set: {
              validEntriesCount: Math.max(0, parent.entries.length),
              updatedAt: new Date().toISOString()
            }
          }
        );
      }
    }

    res.json(normalizeDoc(updatedCollection));
  } catch (error: any) {
    const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.userId, req.path);
    requestLogger.error({
      msg: '[Collections] Add batch entries error',
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
    captureException(error instanceof Error ? error : new Error(String(error)), { requestId: req.id, route: req.path });
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const removeBatchEntries = async (req: Request, res: Response) => {
  try {
    // Validate input
    const validationResult = batchEntriesSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: validationResult.error.errors
      });
    }

    const { articleIds } = validationResult.data;

    // PHASE 1: Check collection access with admin override
    const collection = await Collection.findById(req.params.id);
    if (!collection) return res.status(404).json({ message: 'Collection not found' });

    const currentUserId = (req as any).user?.userId;
    const userRole = (req as any).user?.role;
    if (!canModifyCollectionEntries(collection, currentUserId, userRole)) {
      return res.status(403).json({ message: 'You do not have permission to remove entries from this collection' });
    }

    // Use findOneAndUpdate with $pull to atomically remove all matching entries
    const updatedCollection = await Collection.findOneAndUpdate(
      { _id: req.params.id },
      {
        $pull: {
          entries: { articleId: { $in: articleIds } }
        },
        $set: {
          updatedAt: new Date().toISOString()
        }
      },
      {
        new: true,
        runValidators: true
      }
    );

    if (!updatedCollection) {
      return res.status(404).json({ message: 'Collection not found' });
    }

    // PHASE 3: Ensure validEntriesCount matches entries length
    if (updatedCollection.validEntriesCount === undefined ||
        updatedCollection.validEntriesCount === null ||
        updatedCollection.validEntriesCount < 0 ||
        updatedCollection.validEntriesCount !== updatedCollection.entries.length) {

      await Collection.findOneAndUpdate(
        { _id: req.params.id },
        {
          $set: {
            validEntriesCount: Math.max(0, updatedCollection.entries.length),
            updatedAt: new Date().toISOString()
          }
        }
      );

      updatedCollection.validEntriesCount = Math.max(0, updatedCollection.entries.length);
    }

    res.json(normalizeDoc(updatedCollection));
  } catch (error: any) {
    const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.userId, req.path);
    requestLogger.error({
      msg: '[Collections] Remove batch entries error',
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
    captureException(error instanceof Error ? error : new Error(String(error)), { requestId: req.id, route: req.path });
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const flagEntry = async (req: Request, res: Response) => {
  try {
    // Validate input (userId is optional - we use authenticated user)
    const validationResult = flagEntrySchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: validationResult.error.errors
      });
    }

    // SECURITY FIX: Always use authenticated user ID, never trust client-provided userId
    const currentUserId = (req as any).user?.userId;
    if (!currentUserId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const collection = await Collection.findById(req.params.id);

    if (!collection) {
      return res.status(404).json({ message: 'Collection not found' });
    }

    const entry = collection.entries.find(
      (e: any) => e.articleId === req.params.articleId
    );

    if (entry && !entry.flaggedBy.includes(currentUserId)) {
      entry.flaggedBy.push(currentUserId);
      collection.updatedAt = new Date().toISOString();
      await collection.save();
    }

    res.json(normalizeDoc(collection));
  } catch (error: any) {
    // Audit Phase-1 Fix: Use structured logging and Sentry capture
    const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.userId, req.path);
    requestLogger.error({
      msg: '[Collections] Flag entry error',
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
    captureException(error instanceof Error ? error : new Error(String(error)), { requestId: req.id, route: req.path });
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const followCollection = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // PHASE 3: Use atomic $addToSet to prevent race conditions
    // This ensures duplicate followers are prevented even with concurrent requests
    const collection = await Collection.findOneAndUpdate(
      {
        _id: req.params.id,
        followers: { $ne: userId } // Only update if user is not already following
      },
      {
        $addToSet: { followers: userId }, // Atomically add userId if not present
        $inc: { followersCount: 1 }, // Increment count atomically
        $set: { updatedAt: new Date().toISOString() }
      },
      { new: true } // Return updated document
    );

    if (!collection) {
      // Check if collection exists but user is already following
      const existingCollection = await Collection.findById(req.params.id);
      if (!existingCollection) {
        return res.status(404).json({ message: 'Collection not found' });
      }
      // User is already following, return collection as-is
      return res.json(normalizeDoc(existingCollection));
    }

    res.json(normalizeDoc(collection));
  } catch (error: any) {
    // Audit Phase-1 Fix: Use structured logging and Sentry capture
    const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.userId, req.path);
    requestLogger.error({
      msg: '[Collections] Follow collection error',
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
    captureException(error instanceof Error ? error : new Error(String(error)), { requestId: req.id, route: req.path });
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const unfollowCollection = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // PHASE 3: Use atomic $pull to prevent race conditions
    // This ensures followers array and count stay in sync even with concurrent requests
    const collection = await Collection.findOneAndUpdate(
      {
        _id: req.params.id,
        followers: userId // Only update if user is currently following
      },
      {
        $pull: { followers: userId }, // Atomically remove userId
        $inc: { followersCount: -1 }, // Decrement count atomically
        $set: { updatedAt: new Date().toISOString() }
      },
      { new: true } // Return updated document
    );

    if (!collection) {
      // Check if collection exists but user is not following
      const existingCollection = await Collection.findById(req.params.id);
      if (!existingCollection) {
        return res.status(404).json({ message: 'Collection not found' });
      }
      // User is not following, return collection as-is
      // Ensure followersCount doesn't go negative (safety check)
      if (existingCollection.followersCount < 0) {
        existingCollection.followersCount = Math.max(0, existingCollection.followers?.length || 0);
        await existingCollection.save();
      }
      return res.json(normalizeDoc(existingCollection));
    }

    // PHASE 3: Ensure followersCount doesn't go negative (safety check)
    if (collection.followersCount < 0) {
      collection.followersCount = Math.max(0, collection.followers?.length || 0);
      await collection.save();
    }

    res.json(normalizeDoc(collection));
  } catch (error: any) {
    // Audit Phase-1 Fix: Use structured logging and Sentry capture
    const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.userId, req.path);
    requestLogger.error({
      msg: '[Collections] Unfollow collection error',
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
 * GET /api/collections/featured
 * Returns featured collections for the public category toolbar.
 * Lightweight: only returns id, name, description, isFeatured, featuredOrder.
 * No entry validation or pagination needed (small curated set).
 */
export const getFeaturedCollections = async (req: Request, res: Response) => {
  try {
    const collections = await Collection.find({
      isFeatured: true,
      type: 'public',
      ...buildRootCollectionQuery(),
    })
      .sort({ featuredOrder: 1, rawName: 1 })
      .select('rawName canonicalName description isFeatured featuredOrder validEntriesCount')
      .lean();

    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
    res.json(normalizeDocs(collections));
  } catch (error: unknown) {
    const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.userId, req.path);
    requestLogger.error({
      msg: '[Collections] Get featured collections error',
      error: { message: error instanceof Error ? error.message : String(error) },
    });
    captureException(error instanceof Error ? error : new Error(String(error)), { requestId: req.id, route: req.path });
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * PATCH /api/collections/:id/featured
 * Admin-only: Toggle or set featured status and order for a collection.
 * Body: { isFeatured: boolean, featuredOrder?: number }
 */
export const setFeatured = async (req: Request, res: Response) => {
  try {
    const userRole = (req as any).user?.role;
    if (typeof userRole !== 'string' || userRole.toLowerCase().trim() !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const parsed = setFeaturedSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Validation failed', errors: parsed.error.flatten().fieldErrors });
    }

    const { isFeatured, featuredOrder } = parsed.data;
    const update: Record<string, unknown> = {
      isFeatured,
      updatedAt: new Date().toISOString(),
    };
    if (featuredOrder !== undefined) {
      update.featuredOrder = featuredOrder;

      // Auto-shift: bump all other featured collections at or above this position up by 1
      if (isFeatured) {
        await Collection.updateMany(
          {
            _id: { $ne: req.params.id },
            isFeatured: true,
            featuredOrder: { $gte: featuredOrder },
          },
          { $inc: { featuredOrder: 1 } }
        );
      }
    }

    const existingCollection = await Collection.findById(req.params.id).select('parentId').lean();
    if (!existingCollection) {
      return res.status(404).json({ message: 'Collection not found' });
    }
    if (existingCollection.parentId) {
      return res.status(400).json({ message: 'Sub-collections cannot be featured in the public category toolbar' });
    }

    const collection = await Collection.findByIdAndUpdate(req.params.id, update, { new: true }).lean();

    if (!collection) {
      return res.status(404).json({ message: 'Collection not found' });
    }

    res.json(normalizeDoc(collection));
  } catch (error: unknown) {
    const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.userId, req.path);
    requestLogger.error({
      msg: '[Collections] Set featured error',
      error: { message: error instanceof Error ? error.message : String(error) },
    });
    captureException(error instanceof Error ? error : new Error(String(error)), { requestId: req.id, route: req.path });
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * PATCH /api/collections/featured/reorder
 * Admin-only: Bulk-reorder featured collections by providing an ordered array of IDs.
 * Body: { orderedIds: string[] }
 * Position is derived from array index (0-based).
 */
export const reorderFeatured = async (req: Request, res: Response) => {
  try {
    const userRole = (req as unknown as { user?: { role?: string; userId?: string } }).user?.role;
    if (typeof userRole !== 'string' || userRole.toLowerCase().trim() !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const parsed = reorderFeaturedSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Validation failed', errors: parsed.error.flatten().fieldErrors });
    }

    const { orderedIds } = parsed.data;
    const now = new Date().toISOString();

    // Bulk update: set featuredOrder = array index for each ID
    const bulkOps = orderedIds.map((id, index) => ({
      updateOne: {
        filter: { _id: id, isFeatured: true, ...buildRootCollectionQuery() },
        update: { $set: { featuredOrder: index, updatedAt: now } },
      },
    }));

    await Collection.bulkWrite(bulkOps);

    // Return the updated featured list
    const collections = await Collection.find({ isFeatured: true, type: 'public', ...buildRootCollectionQuery() })
      .sort({ featuredOrder: 1, rawName: 1 })
      .select('rawName canonicalName description isFeatured featuredOrder validEntriesCount')
      .lean();

    res.json(normalizeDocs(collections));
  } catch (error: unknown) {
    const requestLogger = createRequestLogger(req.id || 'unknown', (req as unknown as { user?: { userId?: string } })?.user?.userId, req.path);
    requestLogger.error({
      msg: '[Collections] Reorder featured error',
      error: { message: error instanceof Error ? error.message : String(error) },
    });
    captureException(error instanceof Error ? error : new Error(String(error)), { requestId: req.id, route: req.path });
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * GET /api/collections/:id/articles
 * Returns paginated articles belonging to a collection.
 * Supports q, sort, page, limit params.
 */
export const getCollectionArticles = async (req: Request, res: Response) => {
  try {
    const collection = await Collection.findById(req.params.id).select('entries type').lean();
    if (!collection) {
      return res.status(404).json({ message: 'Collection not found' });
    }

    // Check access
    const userId = (req as any).user?.userId;
    const userRole = (req as any).user?.role;
    if (!canViewCollection(collection, userId, userRole)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const articleIds = collection.entries.map((e: { articleId: string }) => e.articleId);
    if (articleIds.length === 0) {
      return res.json({ data: [], total: 0, page: 1, limit: 25, hasMore: false });
    }

    const { q, sort } = req.query;
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 25, 1), 100);
    const skip = (page - 1) * limit;

    // Build query: articles in this collection + public visibility
    const articleQuery: Record<string, unknown> = {
      _id: { $in: articleIds },
    };

    // Privacy: non-admins only see public articles
    const isAdmin = typeof userRole === 'string' && userRole.toLowerCase().trim() === 'admin';
    if (!userId || !isAdmin) {
      articleQuery.$or = [
        { visibility: 'public' },
        { visibility: { $exists: false } },
        { visibility: null },
      ];
    }

    // Search within collection articles
    if (q && typeof q === 'string' && q.trim().length > 0) {
      const regex = createSearchRegex(q);
      const searchConditions: Record<string, unknown>[] = [
        { title: regex },
        { excerpt: regex },
        { content: regex },
      ];
      // P2-9: Resolve matching tag names to tagIds for search
      const matchingTags = await Tag.find({
        rawName: regex,
        status: 'active',
      }).select('_id').lean();
      if (matchingTags.length > 0) {
        searchConditions.push({ tagIds: { $in: matchingTags.map(t => t._id) } });
      }
      if (articleQuery.$or) {
        articleQuery.$and = [
          { $or: articleQuery.$or as Record<string, unknown>[] },
          { $or: searchConditions },
        ];
        delete articleQuery.$or;
      } else {
        articleQuery.$or = searchConditions;
      }
    }

    const sortMap: Record<string, Record<string, number>> = {
      latest: { publishedAt: -1, _id: -1 },
      oldest: { publishedAt: 1, _id: 1 },
      title: { title: 1 },
    };
    const sortOrder = sortMap[sort as string] || { publishedAt: -1, _id: -1 };

    const [articles, total] = await Promise.all([
      Article.find(articleQuery).sort(sortOrder).skip(skip).limit(limit).lean(),
      Article.countDocuments(articleQuery),
    ]);

    res.json({
      data: await normalizeArticleDocs(articles),
      total,
      page,
      limit,
      hasMore: page * limit < total,
    });
  } catch (error: unknown) {
    const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.userId, req.path);
    requestLogger.error({
      msg: '[Collections] Get collection articles error',
      error: { message: error instanceof Error ? error.message : String(error) },
    });
    captureException(error instanceof Error ? error : new Error(String(error)), { requestId: req.id, route: req.path });
    res.status(500).json({ message: 'Internal server error' });
  }
};
