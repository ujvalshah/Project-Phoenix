import { Request, Response } from 'express';
import { Collection } from '../models/Collection.js';
import { Article } from '../models/Article.js';
import { User } from '../models/User.js';
import { normalizeDoc, normalizeDocs } from '../utils/db.js';
import { createCollectionSchema, updateCollectionSchema, addEntrySchema, flagEntrySchema } from '../utils/validation.js';
import { getCommunityCollections, getCommunityCollectionsCount, CollectionQueryFilters } from '../utils/collectionQueryHelpers.js';
import { createSearchRegex, createExactMatchRegex } from '../utils/escapeRegExp.js';
import { createRequestLogger } from '../utils/logger.js';
import { captureException } from '../utils/sentry.js';

/**
 * PHASE 1: Helper function to check if user has permission to modify a collection
 * Returns true if user is the creator OR user is an admin
 */
function canModifyCollection(collection: { creatorId: string; type: string }, userId: string | undefined, userRole: string | undefined): boolean {
  if (!userId) return false;
  // Admin can modify any collection
  if (userRole === 'admin') return true;
  // Creator can modify their own collection
  return collection.creatorId === userId;
}

/**
 * PHASE 1: Helper function to check if user has permission to view a collection
 * Returns true if collection is public OR user is creator OR user is admin
 */
function canViewCollection(collection: { creatorId: string; type: string }, userId: string | undefined, userRole: string | undefined): boolean {
  // Public collections are viewable by anyone
  if (collection.type === 'public') return true;
  if (!userId) return false;
  // Admin can view any collection
  if (userRole === 'admin') return true;
  // Creator can view their own private collection
  return collection.creatorId === userId;
}

/**
 * PHASE 1: Helper function to check if user can add/remove entries from a collection
 * Returns true if collection is public OR user is creator OR user is admin
 */
function canModifyCollectionEntries(collection: { creatorId: string; type: string }, userId: string | undefined, userRole: string | undefined): boolean {
  if (!userId) return false;
  // Admin can modify entries in any collection
  if (userRole === 'admin') return true;
  // Public collections allow anyone to add/remove entries
  if (collection.type === 'public') return true;
  // Private collections: only creator can modify entries
  return collection.creatorId === userId;
}

export const getCollections = async (req: Request, res: Response) => {
  try {
    // Parse query parameters
    const type = req.query.type as 'public' | 'private' | undefined;
    const searchQuery = req.query.q as string | undefined;
    const creatorId = req.query.creatorId as string | undefined;
    const includeCount = req.query.includeCount === 'true';
    const userId = (req as any).user?.userId;
    
    // PHASE 1: Filter private collections - require authentication
    // Admins can see all private collections, regular users only see their own
    const userRole = (req as any).user?.role;
    const isAdmin = userRole === 'admin';
    
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

    const { name, description, type } = validationResult.data;
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

    // PHASE 2: Check if collection already exists by canonicalName
    // For private collections: check per creator (same creator can't have duplicate canonicalName)
    // For public collections: check globally (anyone can't create duplicate canonicalName)
    const query: any = { canonicalName };
    if (type === 'private') {
      query.creatorId = creatorId;
      query.type = 'private';
    } else {
      // PHASE 2: Public collections require global uniqueness
      query.type = 'public';
      // No creatorId filter - public collections must be globally unique
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
      const query: any = { canonicalName };
      if (collectionType === 'private') {
        query.creatorId = userId; // Use authenticated user ID
        query.type = 'private';
      } else {
        // PHASE 2: Public collections require global uniqueness
        query.type = 'public';
        // No creatorId filter for public collections
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
        // PHASE 2: Public collections require global uniqueness
        duplicateQuery.type = 'public';
        // No creatorId filter - public collections must be globally unique
      }
      
      const existingCollection = await Collection.findOne(duplicateQuery);
      if (existingCollection) {
        return res.status(409).json({ message: 'A collection with this name already exists' });
      }
      
      updateData.rawName = trimmedName;
      updateData.canonicalName = canonicalName;
      delete updateData.name; // Remove legacy name field
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

    // Use findOneAndUpdate with $addToSet to atomically add entry if it doesn't exist
    // $addToSet prevents duplicates based on the entire object match
    const updatedCollection = await Collection.findOneAndUpdate(
      {
        _id: req.params.id,
        'entries.articleId': { $ne: articleId } // Only update if articleId doesn't exist
      },
      {
        $addToSet: {
          entries: {
            articleId,
            addedByUserId: currentUserId, // SECURITY: Use authenticated user, not client-provided
            addedAt: new Date().toISOString(),
            flaggedBy: []
          }
        },
        $set: {
          updatedAt: new Date().toISOString()
        },
        // Update validEntriesCount: increment by 1
        // $inc will create the field if it doesn't exist (initializing to 1)
        $inc: { validEntriesCount: 1 }
      },
      { 
        new: true, // Return updated document
        runValidators: true 
      }
    );
    
    if (!updatedCollection) {
      // Check if collection exists but entry already exists
      const existingCollection = await Collection.findById(req.params.id);
      if (!existingCollection) {
        return res.status(404).json({ message: 'Collection not found' });
      }
      // Entry already exists, return the collection as-is
      return res.json(normalizeDoc(existingCollection));
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
