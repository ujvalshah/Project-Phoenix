import { Request, Response } from 'express';
import { z } from 'zod';
import { Article } from '../models/Article.js';
import mongoose from 'mongoose';
import { createRequestLogger } from '../utils/logger.js';
import { captureException } from '../utils/sentry.js';

// Audit Phase-1 Fix: Zod validation schema with max 100 items per batch
const publishBatchSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, 'At least one ID is required').max(100, 'Maximum 100 items per batch')
});

/**
 * POST /api/batch/publish
 * 
 * Publish multiple draft nuggets by setting their visibility to 'public'
 * 
 * Body: {
 *   ids: string[] // Array of article IDs to publish
 * }
 * 
 * Returns: {
 *   success: boolean
 *   message: string
 *   updatedCount: number
 * }
 */
export const publishBatch = async (req: Request, res: Response) => {
  try {
    // Audit Phase-1 Fix: Zod validation for batch request body with max 100 items
    const validationResult = publishBatchSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationResult.error.errors
      });
    }

    const { ids } = validationResult.data;

    // Validate all IDs are valid MongoDB ObjectIds
    const validIds = ids.filter(id => {
      if (typeof id !== 'string') return false;
      return mongoose.Types.ObjectId.isValid(id);
    });

    if (validIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid nugget IDs provided'
      });
    }

    if (validIds.length !== ids.length) {
      console.warn(`[BatchPublish] ${ids.length - validIds.length} invalid IDs filtered out`);
    }

    // Perform bulk update using updateMany
    // Set visibility to 'public' for all matching IDs
    const result = await Article.updateMany(
      { _id: { $in: validIds } },
      {
        $set: {
          visibility: 'public',
          updated_at: new Date().toISOString()
        }
      }
    );

    console.log(`[BatchPublish] Published ${result.modifiedCount} of ${validIds.length} nuggets`);

    res.json({
      success: true,
      message: `Successfully published ${result.modifiedCount} nugget${result.modifiedCount !== 1 ? 's' : ''}`,
      updatedCount: result.modifiedCount,
      requestedCount: validIds.length
    });
  } catch (error: any) {
    // Audit Phase-1 Fix: Use structured logging and Sentry capture
    const requestLogger = createRequestLogger(req.id || 'unknown', (req as any)?.user?.id, req.path);
    requestLogger.error({
      msg: '[BatchPublish] Error',
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
    captureException(error instanceof Error ? error : new Error(String(error)), { requestId: req.id, route: req.path });
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};






