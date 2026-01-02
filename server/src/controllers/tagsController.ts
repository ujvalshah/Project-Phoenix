import { Request, Response } from 'express';
import { Tag } from '../models/Tag.js';
import { Article } from '../models/Article.js';
import { normalizeDoc, normalizeDocs } from '../utils/db.js';
import { z } from 'zod';
import { createExactMatchRegex } from '../utils/escapeRegExp.js';
import { calculateTagUsageCounts } from '../utils/tagUsageHelpers.js';
import { createRequestLogger } from '../utils/logger.js';
import { captureException } from '../utils/sentry.js';

// Validation schemas
const createTagSchema = z.object({
  name: z.string().min(1, 'Category name is required').max(50, 'Category name too long'),
  type: z.enum(['category', 'tag']).optional(),
  status: z.enum(['active', 'pending', 'deprecated']).optional(),
  isOfficial: z.boolean().optional()
});

const updateTagSchema = z.object({
  name: z.string().min(1, 'Category name is required').max(50, 'Category name too long').optional(),
  type: z.enum(['category', 'tag']).optional(),
  status: z.enum(['active', 'pending', 'deprecated']).optional(),
  isOfficial: z.boolean().optional()
});

export const getTags = async (req: Request, res: Response) => {
  try {
    // Support format query parameter
    // format=simple: Returns array of strings (rawName values) - LEGACY
    // format=full: Returns array of full tag objects with IDs - NEW (Phase 2)
    // no format: Returns full tag objects for Admin Panel
    
    if (req.query.format === 'simple') {
      // LEGACY: Even simple format should have pagination for safety
      const page = Math.max(parseInt(req.query.page as string) || 1, 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 100, 1), 500);
      const skip = (page - 1) * limit;
      
      const [tags, total] = await Promise.all([
        Tag.find({ status: 'active' })
          .sort({ rawName: 1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Tag.countDocuments({ status: 'active' })
      ]);
      
      const tagNames = tags.map(tag => tag.rawName || tag.name);
      return res.json({
        data: tagNames,
        total,
        page,
        limit,
        hasMore: page * limit < total
      });
    }
    
    if (req.query.format === 'full') {
      // NEW (Phase 2): Return full tag objects for frontend use
      // Includes id, rawName, canonicalName for proper matching
      const page = Math.max(parseInt(req.query.page as string) || 1, 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 100, 1), 500);
      const skip = (page - 1) * limit;
      
      const [tags, total] = await Promise.all([
        Tag.find({ status: 'active' })
          .sort({ rawName: 1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Tag.countDocuments({ status: 'active' })
      ]);
      
      // Calculate actual usage count from articles using helper function
      const usageCounts = await calculateTagUsageCounts(tags);
      
      // Add usage counts to tags
      const tagsWithUsage = tags.map((tag) => {
        const tagId = tag._id.toString();
        const actualUsageCount = usageCounts.get(tagId) || 0;
        
        return {
          ...tag,
          usageCount: actualUsageCount
        };
      });
      
      // Return full objects with id, rawName, canonicalName, usageCount
      return res.json({
        data: normalizeDocs(tagsWithUsage),
        total,
        page,
        limit,
        hasMore: page * limit < total
      });
    }
    
    // Return full tag objects for Admin Panel with pagination
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 25, 1), 100);
    const skip = (page - 1) * limit;
    
    const [tags, total] = await Promise.all([
      Tag.find()
        .sort({ rawName: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Tag.countDocuments()
    ]);
    
    // Calculate actual usage count from articles using helper function
    const usageCounts = await calculateTagUsageCounts(tags);
    
    // Add usage counts to tags
    const tagsWithUsage = tags.map((tag) => {
      const tagId = tag._id.toString();
      const actualUsageCount = usageCounts.get(tagId) || 0;
      
      return {
        ...tag,
        usageCount: actualUsageCount
      };
    });
    
    res.json({
      data: normalizeDocs(tagsWithUsage),
      total,
      page,
      limit,
      hasMore: page * limit < total
    });
  } catch (error: any) {
    // Audit Phase-1 Fix: Use structured logging and Sentry capture
    const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.userId, req.path);
    requestLogger.error({
      msg: '[Tags] Get tags error',
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
    captureException(error instanceof Error ? error : new Error(String(error)), { requestId: req.id, route: req.path });
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const createTag = async (req: Request, res: Response) => {
  try {
    // Validate input
    const validationResult = createTagSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: validationResult.error.errors 
      });
    }

    const { name, type = 'tag' } = validationResult.data;
    const trimmedName = name.trim();
    const canonicalName = trimmedName.toLowerCase();

    // Check if tag already exists by canonicalName
    const existingTag = await Tag.findOne({ canonicalName });
    if (existingTag) {
      // Return existing tag instead of creating duplicate
      return res.status(200).json(normalizeDoc(existingTag));
    }

    // Create new tag with rawName and canonicalName
    const newTag = new Tag({ 
      rawName: trimmedName,
      canonicalName: canonicalName,
      type: type,
      status: 'active',
      isOfficial: type === 'category' // Categories are official by default
    });
    await newTag.save();

    res.status(201).json(normalizeDoc(newTag));
  } catch (error: any) {
    // Audit Phase-1 Fix: Use structured logging and Sentry capture
    const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.userId, req.path);
    requestLogger.error({
      msg: '[Tags] Create tag error',
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
    captureException(error instanceof Error ? error : new Error(String(error)), { requestId: req.id, route: req.path });
    
    // Handle duplicate key error (MongoDB unique constraint on canonicalName)
    if (error.code === 11000) {
      // Try to find and return existing tag
      const trimmedName = (req.body.name || '').trim();
      const canonicalName = trimmedName.toLowerCase();
      const existingTag = await Tag.findOne({ canonicalName });
      if (existingTag) {
        return res.status(200).json(normalizeDoc(existingTag));
      }
      return res.status(409).json({ message: 'Tag already exists' });
    }
    
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateTag = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ message: 'Tag ID is required' });
    }

    // Log rename attempt
    console.log('[Tags] Update tag request:', { id, body: req.body });

    // Validate input
    const validationResult = updateTagSchema.safeParse(req.body);
    if (!validationResult.success) {
      console.log('[Tags] Validation failed:', validationResult.error.errors);
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: validationResult.error.errors 
      });
    }

    // Fetch current tag BEFORE updating (needed for article updates)
    const currentTag = await Tag.findById(id);
    if (!currentTag) {
      console.log('[Tags] Tag not found:', id);
      return res.status(404).json({ message: 'Tag not found' });
    }

    const updateData: any = {};
    let oldName: string | null = null;
    let newName: string | null = null;
    
    // If name is being updated, update both rawName and canonicalName
    // 
    // TAG IDENTIFIER BEHAVIOR:
    // - Tags use MongoDB _id as the stable identifier (never changes on rename)
    // - rawName: Exact user-entered text, preserved for display (e.g., "AI", "Machine Learning")
    // - canonicalName: Normalized lowercase version for uniqueness and lookup (e.g., "ai", "machine learning")
    // - The "name" field is a virtual that maps to rawName for backward compatibility
    // 
    // When renaming:
    // - The tag's _id remains stable (no orphan records)
    // - Both rawName and canonicalName are updated
    // - All articles referencing the old tag name are updated to use the new name
    // - Duplicate prevention: canonicalName is unique (case-insensitive), so "AI" and "ai" are treated as the same tag
    if (validationResult.data.name !== undefined) {
      const trimmedName = validationResult.data.name.trim();
      const canonicalName = trimmedName.toLowerCase();
      
      oldName = currentTag.rawName;
      newName = trimmedName;
      
      console.log('[Tags] Renaming tag:', { 
        id, 
        oldRawName: oldName,
        oldCanonicalName: currentTag.canonicalName,
        newRawName: newName, 
        newCanonicalName: canonicalName 
      });
      
      // Check if the new canonicalName would create a duplicate
      // This prevents case variations (e.g., "AI" vs "ai" vs "Ai") from creating separate tags
      const existingTag = await Tag.findOne({
        canonicalName,
        _id: { $ne: id }
      });
      
      if (existingTag) {
        console.log('[Tags] Duplicate tag found:', { 
          existingTagId: existingTag._id, 
          existingTagName: existingTag.rawName,
          requestedName: trimmedName
        });
        return res.status(409).json({ message: 'A tag with this name already exists' });
      }
      
      updateData.rawName = trimmedName;
      updateData.canonicalName = canonicalName;
    }

    // Add other fields if provided
    if (validationResult.data.type !== undefined) {
      updateData.type = validationResult.data.type;
    }
    if (validationResult.data.status !== undefined) {
      updateData.status = validationResult.data.status;
    }
    if (validationResult.data.isOfficial !== undefined) {
      updateData.isOfficial = validationResult.data.isOfficial;
    }

    console.log('[Tags] Update data:', updateData);

    const tag = await Tag.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!tag) {
      console.log('[Tags] Tag update failed - tag not found after update:', id);
      return res.status(404).json({ message: 'Tag not found' });
    }
    
    const normalizedTag = normalizeDoc(tag);
    console.log('[Tags] Tag updated successfully:', { 
      id: normalizedTag.id, 
      rawName: normalizedTag.rawName, 
      canonicalName: normalizedTag.canonicalName,
      name: normalizedTag.name // Virtual field
    });
    
    // If tag name was updated, update all articles that reference the old tag name
    // This ensures the homepage category bar shows the new name immediately
    if (oldName && newName && oldName !== newName) {
      console.log('[Tags] Updating articles with old tag name:', { 
        oldName, 
        newName,
        tagId: id 
      });
      
      try {
        // Import Article model dynamically to avoid circular dependencies
        const { Article } = await import('../models/Article.js');
        
        // Find all articles that contain the old tag name
        // Articles might have different casing (e.g., "Pe & Vc" vs "PE/VC"),
        // so we use case-insensitive matching via aggregation pipeline
        const oldNameLower = oldName.toLowerCase();
        
        // Use aggregation to find articles with case-insensitive matching
        const articlesToUpdate = await Article.aggregate([
          {
            $match: {
              $or: [
                { categories: { $exists: true, $ne: [] } },
                { tags: { $exists: true, $ne: [] } },
                { category: { $exists: true, $ne: '' } }
              ]
            }
          },
          {
            $addFields: {
              hasMatch: {
                $or: [
                  {
                    $anyElementTrue: {
                      $map: {
                        input: { $ifNull: ['$categories', []] },
                        as: 'cat',
                        in: { $eq: [{ $toLower: '$$cat' }, oldNameLower] }
                      }
                    }
                  },
                  {
                    $anyElementTrue: {
                      $map: {
                        input: { $ifNull: ['$tags', []] },
                        as: 'tag',
                        in: { $eq: [{ $toLower: '$$tag' }, oldNameLower] }
                      }
                    }
                  },
                  { $eq: [{ $toLower: { $ifNull: ['$category', ''] } }, oldNameLower] }
                ]
              }
            }
          },
          {
            $match: { hasMatch: true }
          }
        ]);
        
        // Convert aggregation results back to Mongoose documents for updating
        const articleIds = articlesToUpdate.map((a: any) => a._id);
        const articlesToUpdateDocs = articleIds.length > 0 
          ? await Article.find({ _id: { $in: articleIds } })
          : [];
        
        console.log('[Tags] Found articles to update:', articlesToUpdateDocs.length);
        
        if (articlesToUpdateDocs.length === 0) {
          console.log('[Tags] No articles found with old tag name - this is normal if no articles use this tag');
        }
        
        let categoriesUpdated = 0;
        let tagsUpdated = 0;
        let categoryUpdated = 0;
        
        // Update each article individually to ensure all occurrences are replaced
        for (const article of articlesToUpdateDocs) {
          let modified = false;
          const updateFields: any = {};
          
          // Update categories array - replace all occurrences (case-insensitive) of oldName with newName
          if (article.categories && Array.isArray(article.categories)) {
            // Use case-insensitive comparison to find matches
            const hasOldName = article.categories.some((cat: string) => 
              cat.toLowerCase() === oldName.toLowerCase()
            );
            if (hasOldName) {
              updateFields.categories = article.categories.map((cat: string) => 
                cat.toLowerCase() === oldName.toLowerCase() ? newName : cat
              );
              categoriesUpdated++;
              modified = true;
            }
          }
          
          // Update tags array - replace all occurrences (case-insensitive) of oldName with newName
          if (article.tags && Array.isArray(article.tags)) {
            // Use case-insensitive comparison to find matches
            const hasOldName = article.tags.some((tag: string) => 
              tag.toLowerCase() === oldName.toLowerCase()
            );
            if (hasOldName) {
              updateFields.tags = article.tags.map((tag: string) => 
                tag.toLowerCase() === oldName.toLowerCase() ? newName : tag
              );
              tagsUpdated++;
              modified = true;
            }
          }
          
          // Update legacy category field (case-insensitive)
          if (article.category && article.category.toLowerCase() === oldName.toLowerCase()) {
            updateFields.category = newName;
            categoryUpdated++;
            modified = true;
          }
          
          if (modified) {
            try {
              // Use updateOne for atomic updates
              await Article.updateOne(
                { _id: article._id },
                { $set: updateFields }
              );
              console.log(`[Tags] Updated article ${article._id}:`, updateFields);
            } catch (updateError: any) {
              // Audit Phase-1 Fix: Use structured logging and Sentry capture
              const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.userId, req.path);
              requestLogger.error({
                msg: '[Tags] Failed to update article',
                articleId: article._id.toString(),
                error: {
                  message: updateError.message,
                  stack: updateError.stack,
                },
              });
              captureException(updateError instanceof Error ? updateError : new Error(String(updateError)), {
                requestId: req.id,
                route: req.path,
                articleId: article._id.toString(),
              });
              // Continue with other articles even if one fails
            }
          }
        }
        
        console.log('[Tags] Articles update summary:', {
          totalArticlesFound: articlesToUpdateDocs.length,
          categoriesUpdated,
          tagsUpdated,
          categoryUpdated,
          totalUpdated: categoriesUpdated + tagsUpdated + categoryUpdated
        });
      } catch (articleUpdateError: any) {
        // Log error but don't fail the tag rename - tag update succeeded
        // Audit Phase-1 Fix: Use structured logging and Sentry capture
        const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.userId, req.path);
        requestLogger.error({
          msg: '[Tags] Error updating articles with new tag name',
          error: {
            message: articleUpdateError.message,
            stack: articleUpdateError.stack,
          },
        });
        captureException(articleUpdateError instanceof Error ? articleUpdateError : new Error(String(articleUpdateError)), {
          requestId: req.id,
          route: req.path,
        });
        // Still return success for tag rename, but log the article update failure
      }
    }
    
    res.json(normalizedTag);
  } catch (error: any) {
    // Audit Phase-1 Fix: Use structured logging and Sentry capture
    const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.userId, req.path);
    requestLogger.error({
      msg: '[Tags] Update tag error',
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
    captureException(error instanceof Error ? error : new Error(String(error)), { requestId: req.id, route: req.path });
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(409).json({ message: 'A tag with this name already exists' });
    }
    
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteTag = async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    if (!name) {
      return res.status(400).json({ message: 'Tag name is required' });
    }

    // Try to find by rawName first, then by canonicalName (case-insensitive)
    const canonicalName = name.toLowerCase().trim();
    const tag = await Tag.findOneAndDelete({ 
      $or: [
        { rawName: name },
        { canonicalName: canonicalName }
      ]
    });
    
    if (!tag) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    res.status(204).send();
  } catch (error: any) {
    // Audit Phase-1 Fix: Use structured logging and Sentry capture
    const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.userId, req.path);
    requestLogger.error({
      msg: '[Tags] Delete tag error',
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
    captureException(error instanceof Error ? error : new Error(String(error)), { requestId: req.id, route: req.path });
    res.status(500).json({ message: 'Internal server error' });
  }
};









