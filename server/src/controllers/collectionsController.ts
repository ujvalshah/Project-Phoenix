import { Request, Response } from 'express';
import { Collection } from '../models/Collection.js';
import { Article } from '../models/Article.js';
import { normalizeDoc, normalizeDocs } from '../utils/db.js';
import { createCollectionSchema, updateCollectionSchema, addEntrySchema, flagEntrySchema } from '../utils/validation.js';
import { getCommunityCollections, getCommunityCollectionsCount, CollectionQueryFilters } from '../utils/collectionQueryHelpers.js';
import { createSearchRegex, createExactMatchRegex } from '../utils/escapeRegExp.js';
import { createRequestLogger } from '../utils/logger.js';
import { captureException } from '../utils/sentry.js';

export const getCollections = async (req: Request, res: Response) => {
  try {
    // Parse query parameters
    const type = req.query.type as 'public' | 'private' | undefined;
    const searchQuery = req.query.q as string | undefined;
    const creatorId = req.query.creatorId as string | undefined;
    const includeCount = req.query.includeCount === 'true';
    
    // Pagination parameters (MANDATORY - no unbounded lists)
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 25, 1), 100);
    const skip = (page - 1) * limit;
    
    // Build filters using shared query helper
    const filters: CollectionQueryFilters = {};
    if (type) filters.type = type;
    if (searchQuery) filters.searchQuery = searchQuery;
    if (creatorId) filters.creatorId = creatorId;
    
    // Build MongoDB query
    const query: any = {};
    if (type) query.type = type;
    if (creatorId) query.creatorId = creatorId;
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
    
    // Get collections with pagination
    const [collections, total] = await Promise.all([
      Collection.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Collection.countDocuments(query)
    ]);
    
    // Audit Phase-1 Fix: Replace "load all Article IDs" with exists() checks to avoid memory exhaustion
    // Process collections to validate entries and set validEntriesCount
    const validatedCollections = await Promise.all(
      collections.map(async (collection) => {
        // Validate each entry individually using exists() instead of loading all article IDs
        const entryValidationResults = await Promise.all(
          collection.entries.map(async (entry) => {
            const exists = await Article.exists({ _id: entry.articleId });
            return exists ? entry : null;
          })
        );
        const validEntries = entryValidationResults.filter((entry): entry is typeof entry & {} => entry !== null);
        
        const validCount = validEntries.length;
        
        // If entries were filtered or validEntriesCount is missing/incorrect, update
        if (validEntries.length !== collection.entries.length || 
            collection.validEntriesCount === undefined || 
            collection.validEntriesCount === null ||
            collection.validEntriesCount !== validCount) {
          
          // Update collection with validated entries and count
          await Collection.findByIdAndUpdate(collection._id, {
            entries: validEntries,
            validEntriesCount: validCount,
            updatedAt: new Date().toISOString()
          });
          
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
    
    // Audit Phase-1 Fix: Replace "load all Article IDs" with exists() checks to avoid memory exhaustion
    // Validate each entry individually using exists() instead of loading all article IDs
    const entryValidationResults = await Promise.all(
      collection.entries.map(async (entry) => {
        const exists = await Article.exists({ _id: entry.articleId });
        return exists ? entry : null;
      })
    );
    const validEntries = entryValidationResults.filter((entry): entry is typeof entry & {} => entry !== null);
    
    const validCount = validEntries.length;
    
    // If entries were filtered or validEntriesCount is missing/incorrect, update
    if (validEntries.length !== collection.entries.length || 
        collection.validEntriesCount === undefined || 
        collection.validEntriesCount === null ||
        collection.validEntriesCount !== validCount) {
      
      // Update collection with validated entries and count
      await Collection.findByIdAndUpdate(req.params.id, {
        entries: validEntries,
        validEntriesCount: validCount,
        updatedAt: new Date().toISOString()
      });
      
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
    // Validate input
    const validationResult = createCollectionSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: validationResult.error.errors 
      });
    }

    const { name, description, creatorId, type } = validationResult.data;
    const trimmedName = name.trim();
    const canonicalName = trimmedName.toLowerCase();

    // Check if collection already exists by canonicalName
    // For private collections: check per creator (same creator can't have duplicate canonicalName)
    // For public collections: check globally (anyone can't create duplicate canonicalName)
    const query: any = { canonicalName };
    if (type === 'private') {
      query.creatorId = creatorId;
      query.type = 'private';
    } else {
      query.type = 'public';
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
    
    // Handle duplicate key error (MongoDB unique constraint on canonicalName)
    if (error.code === 11000) {
      // Try to find and return existing collection
      const trimmedName = (req.body.name || '').trim();
      const canonicalName = trimmedName.toLowerCase();
      const query: any = { canonicalName };
      if (req.body.type === 'private' && req.body.creatorId) {
        query.creatorId = req.body.creatorId;
        query.type = 'private';
      } else {
        query.type = 'public';
      }
      const existingCollection = await Collection.findOne(query);
      if (existingCollection) {
        return res.status(200).json(normalizeDoc(existingCollection));
      }
      return res.status(409).json({ message: 'Collection already exists' });
    }
    
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateCollection = async (req: Request, res: Response) => {
  try {
    // Validate input
    const validationResult = updateCollectionSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: validationResult.error.errors 
      });
    }

    const updateData: any = { ...validationResult.data, updatedAt: new Date().toISOString() };
    
    // If name is being updated, update both rawName and canonicalName
    if (updateData.name !== undefined) {
      const trimmedName = updateData.name.trim();
      const canonicalName = trimmedName.toLowerCase();
      
      // Check if the new canonicalName would create a duplicate
      const existingCollection = await Collection.findOne({
        canonicalName,
        _id: { $ne: req.params.id }, // Exclude current collection
        ...(updateData.type === 'private' ? { creatorId: updateData.creatorId || (await Collection.findById(req.params.id))?.creatorId } : { type: 'public' })
      });
      
      if (existingCollection) {
        return res.status(409).json({ message: 'A collection with this name already exists' });
      }
      
      updateData.rawName = trimmedName;
      updateData.canonicalName = canonicalName;
      delete updateData.name; // Remove legacy name field
    }

    const collection = await Collection.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!collection) return res.status(404).json({ message: 'Collection not found' });
    res.json(normalizeDoc(collection));
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
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(409).json({ message: 'A collection with this name already exists' });
    }
    
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteCollection = async (req: Request, res: Response) => {
  try {
    const collection = await Collection.findByIdAndDelete(req.params.id);
    if (!collection) return res.status(404).json({ message: 'Collection not found' });
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

    const { articleId, userId } = validationResult.data;
    
    // Audit Phase-2 Fix: Validate article exists before adding to collection
    const articleExists = await Article.exists({ _id: articleId });
    if (!articleExists) {
      return res.status(400).json({ 
        message: `Article ${articleId} does not exist` 
      });
    }
    
    // Use findOneAndUpdate with $addToSet to atomically add entry if it doesn't exist
    // $addToSet prevents duplicates based on the entire object match
    const collection = await Collection.findOneAndUpdate(
      { 
        _id: req.params.id,
        'entries.articleId': { $ne: articleId } // Only update if articleId doesn't exist
      },
      {
        $addToSet: {
          entries: {
            articleId,
            addedByUserId: userId,
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
    
    if (!collection) {
      // Check if collection exists but entry already exists
      const existingCollection = await Collection.findById(req.params.id);
      if (!existingCollection) {
        return res.status(404).json({ message: 'Collection not found' });
      }
      // Entry already exists, return the collection as-is
      return res.json(normalizeDoc(existingCollection));
    }

    // Ensure validEntriesCount is initialized and matches entries length
    // This handles legacy collections that don't have validEntriesCount set
    if (collection.validEntriesCount === undefined || collection.validEntriesCount === null) {
      collection.validEntriesCount = collection.entries.length;
      await collection.save();
    } else {
      // Ensure count matches actual entries length (safety check)
      if (collection.validEntriesCount !== collection.entries.length) {
        collection.validEntriesCount = collection.entries.length;
        await collection.save();
      }
    }

    res.json(normalizeDoc(collection));
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
    // Use findOneAndUpdate with $pull to atomically remove the entry
    const collection = await Collection.findOneAndUpdate(
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
    
    if (!collection) {
      return res.status(404).json({ message: 'Collection not found' });
    }

    // Ensure validEntriesCount doesn't go negative and matches entries length
    if (collection.validEntriesCount === undefined || collection.validEntriesCount === null) {
      collection.validEntriesCount = collection.entries.length;
      await collection.save();
    } else if (collection.validEntriesCount < 0) {
      collection.validEntriesCount = Math.max(0, collection.entries.length);
      await collection.save();
    } else {
      // Ensure count matches actual entries length (safety check)
      if (collection.validEntriesCount !== collection.entries.length) {
        collection.validEntriesCount = collection.entries.length;
        await collection.save();
      }
    }

    res.json(normalizeDoc(collection));
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
    // Validate input
    const validationResult = flagEntrySchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: validationResult.error.errors 
      });
    }

    const { userId } = validationResult.data;
    const collection = await Collection.findById(req.params.id);
    
    if (!collection) {
      return res.status(404).json({ message: 'Collection not found' });
    }

    const entry = collection.entries.find(
      (e: any) => e.articleId === req.params.articleId
    );

    if (entry && !entry.flaggedBy.includes(userId)) {
      entry.flaggedBy.push(userId);
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

    const collection = await Collection.findById(req.params.id);
    if (!collection) {
      return res.status(404).json({ message: 'Collection not found' });
    }

    // Idempotent: only add if not already following
    if (!collection.followers || !collection.followers.includes(userId)) {
      collection.followers = collection.followers || [];
      collection.followers.push(userId);
      collection.followersCount = (collection.followersCount || 0) + 1;
      collection.updatedAt = new Date().toISOString();
      await collection.save();
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

    const collection = await Collection.findById(req.params.id);
    if (!collection) {
      return res.status(404).json({ message: 'Collection not found' });
    }

    // Idempotent: only remove if currently following
    if (collection.followers && collection.followers.includes(userId)) {
      collection.followers = collection.followers.filter((id: string) => id !== userId);
      collection.followersCount = Math.max(0, (collection.followersCount || 0) - 1);
      collection.updatedAt = new Date().toISOString();
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
