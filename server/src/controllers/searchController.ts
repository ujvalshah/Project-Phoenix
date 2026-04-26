import { Request, Response } from 'express';
import { z } from 'zod';
import { Article } from '../models/Article.js';
import { Collection } from '../models/Collection.js';
import { Tag } from '../models/Tag.js';
import { createSearchRegex, escapeRegExp } from '../utils/escapeRegExp.js';
import { sendValidationError, sendInternalError } from '../utils/errorResponse.js';
import { verifyToken } from '../utils/jwt.js';

const suggestSchema = z.object({
  q: z.string().trim().min(2).max(120),
  limit: z.coerce.number().int().min(1).max(10).optional().default(6),
  categories: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((value) => (Array.isArray(value) ? value : value ? [value] : [])),
  tag: z.string().trim().min(1).max(120).optional(),
  collectionId: z.string().trim().min(1).max(120).optional(),
  favorites: z.enum(['1', 'true']).optional(),
  unread: z.enum(['1', 'true']).optional(),
  formats: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((value) => (Array.isArray(value) ? value : value ? [value] : [])),
  timeRange: z.enum(['24h', '7d']).optional(),
  formatTagIds: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((value) => (Array.isArray(value) ? value : value ? [value] : [])),
  domainTagIds: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((value) => (Array.isArray(value) ? value : value ? [value] : [])),
  subtopicTagIds: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((value) => (Array.isArray(value) ? value : value ? [value] : [])),
  contentStream: z.enum(['standard', 'pulse']).optional(),
});

function getOptionalUserId(req: Request): string | undefined {
  const requestUser = (req as any).user;
  if (requestUser?.userId) return requestUser.userId;
  if (requestUser?.id) return requestUser.id;
  const cookieToken = (req as any).cookies?.access_token as string | undefined;
  const authHeader = req.headers['authorization'];
  const headerToken = authHeader && authHeader.split(' ')[1];
  const token = cookieToken || headerToken;
  if (!token) return undefined;
  try {
    const decoded = verifyToken(token);
    return decoded.userId;
  } catch {
    return undefined;
  }
}

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

    const {
      q,
      limit,
      categories,
      tag,
      collectionId,
      favorites,
      unread,
      formats,
      timeRange,
      formatTagIds,
      domainTagIds,
      subtopicTagIds,
      contentStream,
    } = parsed.data;
    const regex = createSearchRegex(q);
    const currentUserId = getOptionalUserId(req);
    const query: Record<string, any> = {
      $and: [
        {
          $and: [
            {
              $or: [
                { visibility: 'public' },
                { visibility: { $exists: false } },
                { visibility: null },
              ],
            },
            {
              $or: [
                { status: 'published' },
                { status: { $exists: false } },
                { status: null },
              ],
            },
          ],
        },
        {
          $or: [{ title: regex }, { excerpt: regex }],
        },
      ],
    };

    if (contentStream === 'pulse') {
      query.$and.push({ contentStream: { $in: ['pulse', 'both'] } });
    } else if (contentStream === 'standard') {
      query.$and.push({
        $or: [
          { contentStream: { $in: ['standard', 'both'] } },
          { contentStream: { $exists: false } },
          { contentStream: null },
        ],
      });
    }

    if (collectionId) {
      const requestedCollectionKey = collectionId.trim();
      const isObjectIdLike = /^[a-f0-9]{24}$/i.test(requestedCollectionKey);
      const collection = await Collection.findOne(
        isObjectIdLike
          ? { _id: requestedCollectionKey }
          : {
              type: 'public',
              $or: [
                { canonicalName: requestedCollectionKey.toLowerCase() },
                { rawName: new RegExp(`^${escapeRegExp(requestedCollectionKey)}$`, 'i') },
              ],
            },
      )
        .select('_id entries type parentId')
        .lean();

      if (!collection || collection.type !== 'public') {
        return res.json({ query: q, count: 0, suggestions: [] });
      }

      const selectedCollectionId = String((collection as any)._id);
      const allEntries = [...(collection.entries || [])];
      if (!collection.parentId) {
        const childCollections = await Collection.find({
          type: 'public',
          parentId: selectedCollectionId,
        })
          .select('entries')
          .lean();
        childCollections.forEach((child) => {
          allEntries.push(...(child.entries || []));
        });
      }

      const articleIds = Array.from(
        new Set(
          allEntries
            .map((entry: { articleId?: string }) => entry.articleId)
            .filter((id): id is string => typeof id === 'string' && id.length > 0),
        ),
      );
      if (articleIds.length === 0) {
        return res.json({ query: q, count: 0, suggestions: [] });
      }
      query.$and.push({ _id: { $in: articleIds } });
    }

    const cleanCategories = (categories || []).map((value) => value.trim()).filter(Boolean);
    if (cleanCategories.length > 0) {
      const hasToday = cleanCategories.some((category) => category === 'Today');
      if (hasToday) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayEnd = new Date(today);
        todayEnd.setHours(23, 59, 59, 999);
        query.$and.push({
          publishedAt: {
            $gte: today.toISOString(),
            $lte: todayEnd.toISOString(),
          },
        });
      }

      const nonTodayCategories = cleanCategories.filter((category) => category !== 'Today');
      if (nonTodayCategories.length > 0) {
        query.$and.push({
          categories: {
            $in: nonTodayCategories.map(
              (category) => new RegExp(`^${escapeRegExp(category)}$`, 'i'),
            ),
          },
        });
      }
    }

    if (tag) {
      const tagDoc = await Tag.findOne({
        canonicalName: tag.toLowerCase(),
        status: 'active',
      })
        .select('_id')
        .lean();
      if (!tagDoc) {
        return res.json({ query: q, count: 0, suggestions: [] });
      }
      query.$and.push({ tagIds: tagDoc._id });
    }

    const cleanFormats = (formats || []).map((value) => value.trim()).filter(Boolean);
    if (cleanFormats.length > 0) {
      query.$and.push({ source_type: { $in: cleanFormats } });
    }

    if (timeRange) {
      const now = new Date();
      const rangeStart = new Date(
        now.getTime() - (timeRange === '24h' ? 24 : 7 * 24) * 60 * 60 * 1000,
      );
      query.$and.push({ publishedAt: { $gte: rangeStart.toISOString() } });
    }

    const pushDimensionFilter = (ids: string[] | undefined) => {
      const cleanIds = (ids || []).map((value) => value.trim()).filter(Boolean);
      if (cleanIds.length > 0) {
        query.$and.push({ tagIds: { $in: cleanIds } });
      }
    };
    pushDimensionFilter(formatTagIds);
    pushDimensionFilter(domainTagIds);
    pushDimensionFilter(subtopicTagIds);

    if (favorites && currentUserId) {
      query.$and.push({ [`favorites.${currentUserId}`]: true });
    }
    if (unread && currentUserId) {
      query.$and.push({ [`readBy.${currentUserId}`]: { $ne: true } });
    }

    const docs = await Article.find(query)
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

