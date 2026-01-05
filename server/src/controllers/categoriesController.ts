import { Request, Response } from 'express';
import { Article } from '../models/Article.js';
import { Tag } from '../models/Tag.js';
import { normalizeDocs } from '../utils/db.js';
import { calculateTagUsageCounts } from '../utils/tagUsageHelpers.js';
import { createRequestLogger } from '../utils/logger.js';
import { captureException } from '../utils/sentry.js';

export const getCategories = async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.userId, req.path);
  
  // DIAGNOSTIC LOGGING: Tag autocomplete audit
  const queryText = req.query.q as string | undefined;
  const format = req.query.format as string | undefined;
  requestLogger.info({
    msg: '[Categories] GET /api/categories request',
    query: {
      format,
      q: queryText,
      page: req.query.page,
      limit: req.query.limit,
    },
    endpoint: '/api/categories',
  });
  
  try {
    // Support format=full parameter to return full Tag objects with IDs
    // This is used by the frontend for tag name casing correction
    if (req.query.format === 'full') {
      const page = Math.max(parseInt(req.query.page as string) || 1, 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 100, 1), 500);
      const skip = (page - 1) * limit;
      
      let tags, total, usageCounts;
      try {
        [tags, total] = await Promise.all([
          Tag.find({ status: 'active' })
            .sort({ rawName: 1 })
            .skip(skip)
            .limit(limit)
            .lean(),
          Tag.countDocuments({ status: 'active' })
        ]);
        
        // Calculate actual usage count from articles using helper function
        usageCounts = await calculateTagUsageCounts(tags);
      } catch (dbErr: any) {
        requestLogger.error({
          msg: '[Categories] Database query failure (format=full)',
          error: {
            message: dbErr.message,
            stack: dbErr.stack,
            name: dbErr.name,
          },
          query: {
            format: 'full',
            page,
            limit,
            skip,
            tagQuery: { status: 'active' },
          },
        });
        throw dbErr;
      }
      
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
      const response = {
        data: normalizeDocs(tagsWithUsage),
        total,
        page,
        limit,
        hasMore: page * limit < total
      };
      
      // DIAGNOSTIC LOGGING: Tag autocomplete audit
      requestLogger.info({
        msg: '[Categories] GET /api/categories response (format=full)',
        model: 'Tag',
        resultCount: tagsWithUsage.length,
        total,
        collection: 'tags',
      });
      
      return res.json(response);
    }
    
    // DIAGNOSTIC LOGGING: Check if format=simple is requested (not currently supported)
    if (req.query.format === 'simple') {
      requestLogger.warn({
        msg: '[Categories] GET /api/categories - format=simple requested but not implemented',
        note: 'Frontend expects { data: string[] } but this endpoint does not support format=simple',
        fallback: 'Will query Tag model instead of Article aggregation',
      });
      
      // IMPLEMENT format=simple: Query Tag model directly (not Article aggregation)
      const page = Math.max(parseInt(req.query.page as string) || 1, 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 100, 1), 500);
      const skip = (page - 1) * limit;
      
      let tags, total;
      try {
        [tags, total] = await Promise.all([
          Tag.find({ status: 'active' })
            .sort({ rawName: 1 })
            .skip(skip)
            .limit(limit)
            .lean(),
          Tag.countDocuments({ status: 'active' })
        ]);
      } catch (dbErr: any) {
        requestLogger.error({
          msg: '[Categories] Database query failure (format=simple)',
          error: {
            message: dbErr.message,
            stack: dbErr.stack,
            name: dbErr.name,
          },
          query: {
            format: 'simple',
            page,
            limit,
            skip,
            tagQuery: { status: 'active' },
          },
        });
        throw dbErr;
      }
      
      const tagNames = tags.map(tag => tag.rawName || tag.name);
      
      const response = {
        data: tagNames,
        total,
        page,
        limit,
        hasMore: page * limit < total
      };
      
      // DIAGNOSTIC LOGGING: Tag autocomplete audit
      requestLogger.info({
        msg: '[Categories] GET /api/categories response (format=simple)',
        model: 'Tag',
        resultCount: tagNames.length,
        total,
        collection: 'tags',
        sampleTags: tagNames.slice(0, 5),
      });
      
      return res.json(response);
    }

    // Legacy behavior: return tag frequency counts from articles
    // DIAGNOSTIC LOGGING: Tag autocomplete audit
    requestLogger.info({
      msg: '[Categories] GET /api/categories - Legacy mode (no format param)',
      model: 'Article (aggregation)',
      note: 'Aggregating tags from articles, not querying Tag model',
    });
    
    let tags;
    try {
      tags = await Article.aggregate([
        { $unwind: "$tags" },
        { $group: { _id: "$tags", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);
    } catch (dbErr: any) {
      requestLogger.error({
        msg: '[Categories] Database aggregation failure (legacy mode)',
        error: {
          message: dbErr.message,
          stack: dbErr.stack,
          name: dbErr.name,
        },
        query: {
          format: undefined,
          aggregation: [
            { $unwind: "$tags" },
            { $group: { _id: "$tags", count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ],
        },
      });
      throw dbErr;
    }

    const response = {
      source: "tags-unified-endpoint",
      items: tags.map(t => ({
        name: t._id,
        count: t.count
      }))
    };
    
    // DIAGNOSTIC LOGGING: Tag autocomplete audit
    requestLogger.info({
      msg: '[Categories] GET /api/categories response (legacy format)',
      model: 'Article (aggregation)',
      resultCount: tags.length,
      collection: 'articles',
      responseFormat: 'legacy',
      note: 'Frontend expects { data: string[] } but receives { source, items }',
    });

    return res.json(response);

  } catch (err: any) {
    // Enhanced error logging with full context
    requestLogger.error({
      msg: '[Categories] Get categories error - 500 response',
      error: {
        message: err.message,
        stack: err.stack,
        name: err.name,
      },
      query: {
        format: req.query.format,
        q: req.query.q,
        page: req.query.page,
        limit: req.query.limit,
      },
      payload: {
        queryParams: req.query,
        path: req.path,
        method: req.method,
      },
    });
    captureException(err instanceof Error ? err : new Error(String(err)), { requestId: req.id, route: req.path });
    res.status(500).json({ 
      message: "Failed to fetch tags",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

