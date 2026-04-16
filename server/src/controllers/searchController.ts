import { Request, Response } from 'express';
import { z } from 'zod';
import { Article } from '../models/Article.js';
import { createSearchRegex } from '../utils/escapeRegExp.js';
import { sendValidationError, sendInternalError } from '../utils/errorResponse.js';

const suggestSchema = z.object({
  q: z.string().trim().min(2).max(120),
  limit: z.coerce.number().int().min(1).max(10).optional().default(6),
});

/**
 * Lightweight typeahead suggestions for hybrid search.
 * Keeps payload small and avoids feed-size query/aggregation work.
 */
export const getSuggestions = async (req: Request, res: Response) => {
  try {
    const parsed = suggestSchema.safeParse(req.query);
    if (!parsed.success) {
      return sendValidationError(
        res,
        'Invalid search suggestion parameters',
        parsed.error.errors
      );
    }

    const { q, limit } = parsed.data;
    const regex = createSearchRegex(q);

    const docs = await Article.find({
      $and: [
        {
          $or: [
            { visibility: 'public' },
            { visibility: { $exists: false } },
            { visibility: null },
          ],
        },
        {
          $or: [{ title: regex }, { excerpt: regex }],
        },
      ],
    })
      .sort({ publishedAt: -1, _id: -1 })
      .limit(limit)
      .select('_id title excerpt publishedAt source_type contentStream')
      .lean();

    type SuggestionDoc = {
      _id: { toString(): string };
      title?: string;
      excerpt?: string;
      publishedAt?: Date;
      source_type?: string;
      contentStream?: string;
    };

    const suggestions = (docs as SuggestionDoc[]).map((d) => ({
      id: d._id.toString(),
      title: d.title || 'Untitled',
      excerpt: d.excerpt || '',
      publishedAt: d.publishedAt,
      sourceType: d.source_type || null,
      contentStream: d.contentStream || 'standard',
    }));

    return res.json({
      query: q,
      count: suggestions.length,
      suggestions,
    });
  } catch (error) {
    return sendInternalError(res);
  }
};

