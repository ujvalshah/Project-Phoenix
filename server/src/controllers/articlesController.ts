import { Request, Response } from 'express';
import { Article } from '../models/Article.js';
import { Collection } from '../models/Collection.js';
import { Tag } from '../models/Tag.js';
import { normalizeDoc, normalizeDocs, normalizeArticleDoc, normalizeArticleDocs } from '../utils/db.js';
import { createArticleSchema, updateArticleSchema } from '../utils/validation.js';
import { validateDimensionTagIds } from '../utils/validateDimensionTagIds.js';
import { cleanupCollectionEntries } from '../utils/collectionHelpers.js';
import { resolveTagNamesToIds } from '../utils/tagHelpers.js';
import { createRequestLogger } from '../utils/logger.js';
import { escapeRegExp, createSearchRegex, createExactMatchRegex } from '../utils/escapeRegExp.js';
import { z } from 'zod';
import { verifyToken } from '../utils/jwt.js';
import {
  getUnseenCountForFeed,
  getUnseenFeedCountsForUser,
  markFeedSeenForUser,
  type FeedBadgeKey,
} from '../services/unseenBadgeService.js';
import {
  sendErrorResponse,
  sendValidationError,
  sendUnauthorizedError,
  sendForbiddenError,
  sendNotFoundError,
  sendPayloadTooLargeError,
  sendInternalError
} from '../utils/errorResponse.js';

// ── Lightweight in-memory query cache (LRU, TTL 60s) ────────────────────────
const SEARCH_CACHE_TTL_MS = 60_000;
const SEARCH_CACHE_MAX = 100;

interface CacheEntry {
  data: unknown;
  total: number;
  createdAt: number;
}

const _searchCache = new Map<string, CacheEntry>();

function getCachedResult(key: string): CacheEntry | null {
  const entry = _searchCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > SEARCH_CACHE_TTL_MS) {
    _searchCache.delete(key);
    return null;
  }
  return entry;
}

function setCachedResult(key: string, data: unknown, total: number): void {
  // Evict oldest entries if cache is full
  if (_searchCache.size >= SEARCH_CACHE_MAX) {
    const firstKey = _searchCache.keys().next().value;
    if (firstKey !== undefined) _searchCache.delete(firstKey);
  }
  _searchCache.set(key, { data, total, createdAt: Date.now() });
}

/** Invalidate the search cache (call after article create/update/delete). */
export function invalidateSearchCache(): void {
  _searchCache.clear();
}

/**
 * Optionally extract user from token (for privacy filtering)
 * Returns userId if token is present and valid, otherwise undefined
 * Does not throw errors - silently fails if token is missing/invalid
 */
function getOptionalUserId(req: Request): string | undefined {
  // First check if middleware already set req.user
  const requestUser = (req as any).user;
  if (requestUser?.userId) {
    return requestUser.userId;
  }
  if (requestUser?.id) {
    return requestUser.id;
  }
  
  // Cookie-based auth is the canonical browser path in this app.
  const cookieToken = (req as any).cookies?.access_token as string | undefined;

  // Fallback: Authorization header for API clients.
  const authHeader = req.headers['authorization'];
  const headerToken = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  const token = cookieToken || headerToken;
  
  if (!token) {
    return undefined;
  }
  
  try {
    const decoded = verifyToken(token);
    return decoded.userId;
  } catch (error) {
    // Token invalid/expired - silently ignore (this is optional auth)
    return undefined;
  }
}

function appendAndQueryCondition(query: Record<string, any>, condition: Record<string, any>): void {
  if (query.$and && Array.isArray(query.$and)) {
    query.$and.push(condition);
    return;
  }

  const keys = Object.keys(query);
  if (keys.length === 0) {
    Object.assign(query, condition);
    return;
  }

  const currentQuery = { ...query };
  Object.keys(query).forEach((key) => {
    delete query[key];
  });
  query.$and = [currentQuery, condition];
}

function cloneQueryForSearch(baseQuery: Record<string, any>): Record<string, any> {
  const nextQuery: Record<string, any> = { ...baseQuery };
  if (Array.isArray(baseQuery.$and)) {
    nextQuery.$and = [...baseQuery.$and];
  }
  if (Array.isArray(baseQuery.$or)) {
    nextQuery.$or = [...baseQuery.$or];
  }
  return nextQuery;
}

function mergeSearchConditions(
  baseQuery: Record<string, any>,
  searchConditions: Record<string, unknown>[],
): Record<string, any> {
  const nextQuery = cloneQueryForSearch(baseQuery);
  if (searchConditions.length === 0) return nextQuery;

  const existingOr =
    Array.isArray(nextQuery.$or) && nextQuery.$or.length > 0 ? [...nextQuery.$or] : null;
  if (existingOr) {
    delete nextQuery.$or;
    const existingAnd =
      Array.isArray(nextQuery.$and) && nextQuery.$and.length > 0 ? [...nextQuery.$and] : [];
    nextQuery.$and = [...existingAnd, { $or: existingOr }, { $or: searchConditions }];
    return nextQuery;
  }

  if (searchConditions.length === 1) {
    Object.assign(nextQuery, searchConditions[0]);
    return nextQuery;
  }

  nextQuery.$or = searchConditions;
  return nextQuery;
}

/**
 * Phase 2: Resolve tag IDs from category names
 * Maps category names to Tag ObjectIds for stable references
 */
async function resolveCategoryIds(categoryNames: string[]): Promise<string[]> {
  if (!categoryNames || categoryNames.length === 0) {
    return [];
  }

  try {
    // Find tags by canonical name (case-insensitive)
    const canonicalNames = categoryNames.map(name => name.trim().toLowerCase());
    const tags = await Tag.find({
      canonicalName: { $in: canonicalNames }
    }).lean();

    // Map found tags to their ObjectIds
    const tagMap = new Map(tags.map(tag => [tag.canonicalName, tag._id.toString()]));
    
    // Return IDs in the same order as input names
    const categoryIds = canonicalNames
      .map(canonical => tagMap.get(canonical))
      .filter((id): id is string => id !== undefined);

    console.log(`[Articles] Resolved ${categoryNames.length} category names to ${categoryIds.length} IDs`);
    return categoryIds;
  } catch (error: any) {
    console.error('[Articles] Error resolving category IDs:', error);
    return []; // Fail gracefully - categoryIds is optional
  }
}

export const getArticles = async (req: Request, res: Response) => {
  try {
    const {
      authorId,
      q,
      category,
      categories,
      tag,
      sort,
      collectionId,
      favorites,
      unread,
      formats,
      timeRange,
      youtubeOnly,
      nonYoutubeOnly,
      // Dimension-based tag filtering (Phase: three-axis taxonomy)
      formatTagIds: rawFormatTagIds,
      domainTagIds: rawDomainTagIds,
      subtopicTagIds: rawSubtopicTagIds,
      // Content stream routing (standard vs Market Pulse)
      contentStream,
      searchMode,
      visibility,
    } = req.query;
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 25, 1), 100);
    const skip = (page - 1) * limit;

    // Get current user from token (optional - for privacy filtering)
    // This allows authenticated users to see their own private articles
    const currentUserId = getOptionalUserId(req);

    // Build MongoDB query object
    let query: any = {};
    let hybridSearchContext: { trimmedQ: string; regex: RegExp; matchingTagIds: unknown[] } | null = null;

    // Collection filter: restrict to articles in a specific community collection.
    // Supports current ID-based filters and legacy name-based values from older URLs.
    if (collectionId && typeof collectionId === 'string') {
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
            }
      )
        .select('_id entries type parentId')
        .lean();

      if (!collection || collection.type !== 'public') {
        // Non-existent or private collection -> empty result (not a 404, so the feed degrades gracefully)
        return res.json({ data: [], total: 0, page, limit, hasMore: false });
      }

      const selectedCollectionId = String((collection as any)._id);
      const allEntries = [...(collection.entries || [])];

      // Parent collections in the filter UI represent an "All in parent" scope.
      // Include child entries to support legacy parent data where entries were not backfilled.
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
            .map((e: { articleId?: string }) => e.articleId)
            .filter((id): id is string => typeof id === 'string' && id.length > 0)
        )
      );
      if (articleIds.length === 0) {
        return res.json({ data: [], total: 0, page, limit, hasMore: false });
      }
      query._id = { $in: articleIds };
    }

    // Author filter
    if (authorId) {
      query.authorId = authorId;
    }
    
    // PRIVACY FILTER: Apply based on context
    // Rule 1: If filtering by authorId and it's the current user, show ALL their articles (public + private)
    // Rule 2: Otherwise, only show public articles (or articles without visibility set, defaulting to public)
    const isViewingOwnArticles = currentUserId && authorId === currentUserId;
    
    const publicVisibilityFilter = [
      { visibility: 'public' },
      { visibility: { $exists: false } }, // Default to public if field doesn't exist
      { visibility: null } // Handle null as public
    ];
    const requestedVisibility =
      visibility === 'public' || visibility === 'private' ? visibility : undefined;
    
    if (!isViewingOwnArticles) {
      // Public feed or viewing another user's articles: only show public
      query.$or = publicVisibilityFilter;
    } else if (requestedVisibility === 'private') {
      // Owner requesting drafts
      query.visibility = 'private';
    } else if (requestedVisibility === 'public') {
      // Owner explicitly requesting published items (includes legacy missing visibility)
      query.$or = publicVisibilityFilter;
    }
    // If isViewingOwnArticles is true, no privacy filter needed - user can see all their articles

    // Content stream filter: route articles to standard feed or Market Pulse
    // 'standard' → match 'standard' OR 'both' (or missing field for backward compat)
    // 'pulse' → match 'pulse' OR 'both'
    // omitted → return all (backward compatible)
    if (contentStream && typeof contentStream === 'string') {
      if (contentStream === 'pulse') {
        query.contentStream = { $in: ['pulse', 'both'] };
      } else if (contentStream === 'standard') {
        // Include documents without contentStream field (backward compat: default to standard)
        query.$and = [
          ...(query.$and || []),
          { $or: [
            { contentStream: { $in: ['standard', 'both'] } },
            { contentStream: { $exists: false } },
            { contentStream: null }
          ]}
        ];
      } else if (contentStream === 'both') {
        // Admin filter: exact match for articles tagged to appear in both streams
        query.contentStream = 'both';
      }
    }

    // Search query — use MongoDB $text index for word-level search (queries >= 3 chars),
    // fall back to regex for short/partial queries. Both paths are ReDoS-safe.
    const useRelevanceMode = searchMode === 'relevance';
    const useHybridMode = searchMode === 'hybrid';
    if (q && typeof q === 'string' && q.trim().length > 0) {
      const trimmedQ = q.trim();

      // P2-5: Resolve matching tag names to tagIds for search
      const regex = createSearchRegex(q);
      const matchingTags = await Tag.find({
        rawName: regex,
        status: 'active',
      }).select('_id').lean();
      const matchingTagIds = matchingTags.map((t) => t._id);

      if (trimmedQ.length >= 3) {
        // Use $text index for efficient full-text search (word-level matching)
        const textCondition: Record<string, unknown> = { $text: { $search: trimmedQ } };
        const searchConditions: Record<string, unknown>[] = [textCondition];
        // Recall fix: include tag matches in BOTH modes. Previously we skipped
        // tag matches in relevance mode to keep textScore "stable"; the side
        // effect was a hard recall cliff at 3 chars (articles tagged "AI" but
        // whose body never mentions "ai" disappeared from results).
        // Tag-only hits have textScore 0 and naturally sort below text hits,
        // then fall to the publishedAt tiebreaker — which matches user intent.
        if (matchingTagIds.length > 0) {
          searchConditions.push({ tagIds: { $in: matchingTagIds } });
        }
        if (useHybridMode) {
          // Hybrid mode runs this relevance branch as phase 1 at execution time,
          // then supplements with a regex fallback phase to safely add partial matching.
          hybridSearchContext = { trimmedQ, regex, matchingTagIds };
        } else {
          query = mergeSearchConditions(query, searchConditions);
        }
      } else {
        // Short queries: fall back to regex for substring matching
        const searchConditions: Record<string, unknown>[] = [
          { title: regex },
          { excerpt: regex },
        ];

        if (matchingTagIds.length > 0) {
          searchConditions.push({ tagIds: { $in: matchingTagIds } });
        }
        query = mergeSearchConditions(query, searchConditions);
      }
    }
    
    // Category filter (case-insensitive, supports both single and array)
    // SECURITY: createExactMatchRegex escapes user input to prevent ReDoS
    // SPECIAL CASE: "Today" category requires date filtering instead of category matching
    if (category && typeof category === 'string' && category === 'Today') {
      // "Today" category: filter by publishedAt date (start of today to end of today)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayEnd = new Date(today);
      todayEnd.setHours(23, 59, 59, 999);
      
      // Filter by publishedAt date range (ISO string comparison)
      query.publishedAt = {
        $gte: today.toISOString(),
        $lte: todayEnd.toISOString()
      };
    } else if (category && typeof category === 'string') {
      // Single category: case-insensitive exact match
      query.categories = { $in: [createExactMatchRegex(category)] };
    } else if (categories) {
      // Multiple categories: handle both string and array
      const categoryArray = Array.isArray(categories) 
        ? categories 
        : [categories];
      
      // Check if "Today" is in the array - if so, apply date filter
      const hasToday = categoryArray.some((cat: any) => 
        typeof cat === 'string' && cat === 'Today'
      );
      
      if (hasToday) {
        // If "Today" is in the array, apply date filter
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayEnd = new Date(today);
        todayEnd.setHours(23, 59, 59, 999);
        
        query.publishedAt = {
          $gte: today.toISOString(),
          $lte: todayEnd.toISOString()
        };
        
        // Also filter by other categories if any
        const otherCategories = categoryArray.filter((cat: any) => 
          typeof cat === 'string' && cat !== 'Today'
        );
        
        if (otherCategories.length > 0) {
          query.categories = { 
            $in: otherCategories.map((cat: string) => createExactMatchRegex(cat))
          };
        }
      } else {
        // No "Today" in array, apply normal category filter
        query.categories = { 
          $in: categoryArray
            .filter((cat): cat is string => typeof cat === 'string')
            .map((cat: string) => createExactMatchRegex(cat))
        };
      }
    }
    
    // Tag filter: resolve tag name to tagId and query via tagIds (Phase 2-4 migration)
    // Separate from category filter — allows filtering by a specific tag within a category
    if (tag && typeof tag === 'string' && tag.trim().length > 0) {
      const tagDoc = await Tag.findOne({
        canonicalName: tag.trim().toLowerCase(),
        status: 'active',
      }).select('_id').lean();
      if (tagDoc) {
        appendAndQueryCondition(query, { tagIds: tagDoc._id });
      } else {
        // Tag name doesn't resolve to any active tag — return empty results
        return res.json({ data: [], total: 0, page, limit, hasMore: false });
      }
    }

    // Format filter (source_type field: 'link' | 'twitter' | 'video' | 'document')
    if (formats) {
      const fmtArray = Array.isArray(formats) ? formats : [formats];
      const validFormats = fmtArray.filter((f): f is string => typeof f === 'string' && f.trim().length > 0);
      if (validFormats.length > 0) {
        query.source_type = { $in: validFormats };
      }
    }

    // Admin/workflow filter: explicit YouTube vs non-YouTube by media metadata
    const isYoutubeOnly = youtubeOnly === '1' || youtubeOnly === 'true';
    const isNonYoutubeOnly = nonYoutubeOnly === '1' || nonYoutubeOnly === 'true';
    if (isYoutubeOnly && !isNonYoutubeOnly) {
      appendAndQueryCondition(query, {
        $or: [
          { 'media.type': 'youtube' },
          { 'primaryMedia.type': 'youtube' }
        ]
      });
    } else if (isNonYoutubeOnly && !isYoutubeOnly) {
      appendAndQueryCondition(query, {
        $and: [
          { 'media.type': { $ne: 'youtube' } },
          { 'primaryMedia.type': { $ne: 'youtube' } }
        ]
      });
    }

    // Time range filter (relative date window)
    if (timeRange && typeof timeRange === 'string' && timeRange !== 'all') {
      const now = new Date();
      let rangeStart: Date | null = null;

      if (timeRange === '24h') {
        rangeStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      } else if (timeRange === '7d') {
        rangeStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }

      if (rangeStart) {
        // Layer on top of any existing publishedAt constraint (e.g. "Today" category)
        query.publishedAt = {
          ...(query.publishedAt || {}),
          $gte: rangeStart.toISOString(),
        };
      }
    }

    // ── Dimension-based tag filtering (three-axis taxonomy) ─────────────────
    // OR within each dimension, AND across dimensions
    // e.g. (Podcast OR Report) AND (Technology OR Geopolitics) AND (AI OR India)
    {
      const parseIds = (raw: unknown) =>
        raw
          ? (Array.isArray(raw) ? raw : [raw])
              .filter((id): id is string => typeof id === 'string' && id.length > 0)
          : [];

      const formatIds = parseIds(rawFormatTagIds);
      const domainIds = parseIds(rawDomainTagIds);
      const subtopicIds = parseIds(rawSubtopicTagIds);

      if (formatIds.length > 0) {
        appendAndQueryCondition(query, { tagIds: { $in: formatIds } });
      }
      if (domainIds.length > 0) {
        appendAndQueryCondition(query, { tagIds: { $in: domainIds } });
      }
      if (subtopicIds.length > 0) {
        appendAndQueryCondition(query, { tagIds: { $in: subtopicIds } });
      }
    }

    // Favorites filter — requires authenticated user
    // Articles are "favorited" via a user-specific flag; skip if no currentUserId
    if (favorites === '1' && currentUserId) {
      query[`favorites.${currentUserId}`] = true;
    }

    // Unread filter — requires authenticated user
    if (unread === '1' && currentUserId) {
      query[`readBy.${currentUserId}`] = { $ne: true };
    }

    // Sort parameter (map frontend values to MongoDB sort)
    const sortMap: Record<string, any> = {
      'latest': { publishedAt: -1 },
      'oldest': { publishedAt: 1 },
      'title': { title: 1 },
      'title-desc': { title: -1 }
    };
    // Relevance-first when searching with >= 3 chars and caller requests it.
    const hasSearchQuery = typeof q === 'string' && q.trim().length >= 3;
    const sortOrder =
      hasSearchQuery && useRelevanceMode
        ? { score: { $meta: 'textScore' }, publishedAt: -1, _id: -1 }
        : (sortMap[sort as string] || { publishedAt: -1, _id: -1 }); // Default: latest first
    
    // Build a stable cache key from the fully-constructed query + sort + pagination
    const cacheKey = JSON.stringify({
      query,
      sort: sortOrder,
      skip,
      limit,
      searchMode: typeof searchMode === 'string' ? searchMode : 'latest',
      q: typeof q === 'string' ? q.trim() : '',
      hybrid: hybridSearchContext
        ? { trimmedQ: hybridSearchContext.trimmedQ, tagCount: hybridSearchContext.matchingTagIds.length }
        : null,
    });
    const cached = getCachedResult(cacheKey);
    if (cached) {
      return res.json({
        data: cached.data,
        total: cached.total,
        page,
        limit,
        hasMore: page * limit < cached.total,
      });
    }

    if (hybridSearchContext) {
      const relevanceConditions: Record<string, unknown>[] = [
        { $text: { $search: hybridSearchContext.trimmedQ } },
      ];
      if (hybridSearchContext.matchingTagIds.length > 0) {
        relevanceConditions.push({ tagIds: { $in: hybridSearchContext.matchingTagIds } });
      }
      const fallbackConditions: Record<string, unknown>[] = [
        { title: hybridSearchContext.regex },
        { excerpt: hybridSearchContext.regex },
      ];
      if (hybridSearchContext.matchingTagIds.length > 0) {
        fallbackConditions.push({ tagIds: { $in: hybridSearchContext.matchingTagIds } });
      }

      const relevanceQuery = mergeSearchConditions(query, relevanceConditions);
      const fallbackQuery = mergeSearchConditions(query, fallbackConditions);
      const relevanceSort = { score: { $meta: 'textScore' }, publishedAt: -1, _id: -1 };
      const fallbackSort = sortMap[sort as string] || { publishedAt: -1, _id: -1 };
      const fetchWindow = skip + limit;

      const [relevanceIds, fallbackIds, relevanceDocs, fallbackDocs] = await Promise.all([
        Article.find(relevanceQuery).distinct('_id'),
        Article.find(fallbackQuery).distinct('_id'),
        Article.find(relevanceQuery, { score: { $meta: 'textScore' } })
          .sort(relevanceSort)
          .limit(fetchWindow)
          .lean(),
        Article.find(fallbackQuery)
          .sort(fallbackSort)
          .limit(fetchWindow)
          .lean(),
      ]);

      const merged: any[] = [];
      const seenIds = new Set<string>();
      const pushUnique = (doc: any) => {
        const id = String(doc?._id ?? '');
        if (!id || seenIds.has(id)) return;
        seenIds.add(id);
        merged.push(doc);
      };
      relevanceDocs.forEach(pushUnique);
      fallbackDocs.forEach(pushUnique);

      const pageSlice = merged.slice(skip, skip + limit);
      const normalizedData = await normalizeArticleDocs(pageSlice);
      const total = new Set<string>([
        ...relevanceIds.map((id) => String(id)),
        ...fallbackIds.map((id) => String(id)),
      ]).size;

      setCachedResult(cacheKey, normalizedData, total);
      return res.json({
        data: normalizedData,
        total,
        page,
        limit,
        hasMore: page * limit < total,
      });
    }

    const [articles, total] = await Promise.all([
      Article.find(
        query,
        hasSearchQuery && useRelevanceMode ? { score: { $meta: 'textScore' } } : undefined,
      )
        .sort(sortOrder)
        .skip(skip)
        .limit(limit)
        .lean(), // Use lean() for read-only queries
      Article.countDocuments(query)
    ]);

    const normalizedData = await normalizeArticleDocs(articles);
    setCachedResult(cacheKey, normalizedData, total);

    res.json({
      data: normalizedData,
      total,
      page,
      limit,
      hasMore: page * limit < total
    });
  } catch (error: any) {
    console.error('[Articles] Get articles error:', error);
    sendInternalError(res);
  }
};

export const getArticleById = async (req: Request, res: Response) => {
  try {
    const article = await Article.findById(req.params.id).lean();
    if (!article) return sendNotFoundError(res, 'Article not found');
    
    // PRIVACY CHECK: Verify user has access to this article
    const currentUserId = getOptionalUserId(req);
    const isPrivate = article.visibility === 'private';
    const isOwner = article.authorId === currentUserId;
    
    // If article is private and user is not the owner, deny access
    if (isPrivate && !isOwner) {
      return sendForbiddenError(res, 'This article is private');
    }
    
    // If article is private and no user is authenticated, deny access
    if (isPrivate && !currentUserId) {
      return sendUnauthorizedError(res, 'Authentication required to view private articles');
    }
    
    res.json(await normalizeArticleDoc(article));
  } catch (error: any) {
    console.error('[Articles] Get article by ID error:', error);
    sendInternalError(res);
  }
};

export const createArticle = async (req: Request, res: Response) => {
  invalidateSearchCache();
  try {
    // Validate input
    const validationResult = createArticleSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(err => ({
        path: err.path,
        message: err.message,
        code: err.code
      }));
      return sendValidationError(res, 'Validation failed', errors);
    }

    const data = validationResult.data;

    // CRITICAL FIX: Deduplicate images array to prevent duplicates
    // Also log for debugging image creation flow
    if (data.images && Array.isArray(data.images)) {
      console.log(`[Articles] Create: Received ${data.images.length} images in payload`);
      const imageMap = new Map<string, string>();
      for (const img of data.images) {
        if (img && typeof img === 'string' && img.trim()) {
          const normalized = img.toLowerCase().trim();
          if (!imageMap.has(normalized)) {
            imageMap.set(normalized, img); // Keep original casing
          } else {
            console.log(`[Articles] Create: Duplicate image detected and removed: ${img}`);
          }
        }
      }
      const deduplicated = Array.from(imageMap.values());
      if (deduplicated.length !== data.images.length) {
        console.log(`[Articles] Create: Deduplicated ${data.images.length} → ${deduplicated.length} images`);
      }
      data.images = deduplicated;
    }

    // Log payload size for debugging (especially for images)
    const payloadSize = JSON.stringify(data).length;
    if (payloadSize > 1000000) { // > 1MB
      console.warn(`[Articles] Large payload detected: ${(payloadSize / 1024 / 1024).toFixed(2)}MB`);
      if (data.images && data.images.length > 0) {
        const imagesSize = data.images.reduce((sum: number, img: string) => sum + (img?.length || 0), 0);
        console.warn(`[Articles] Images total size: ${(imagesSize / 1024 / 1024).toFixed(2)}MB`);
      }
    }

    // Resolve free-form tag names to tagIds and merge with dimension picker IDs.
    // tags[] is no longer persisted — tagIds is the sole storage field.
    // IMPORTANT: This must run BEFORE validateDimensionTagIds so that tags
    // submitted as names (from TagSelector) are included in the dimension check.
    const resolvedFromNames = await resolveTagNamesToIds(data.tags || []);
    const dimensionTagIds = (data.tagIds || []).filter(Boolean);
    const mergedIdSet = new Set([
      ...dimensionTagIds,
      ...resolvedFromNames.map(id => id.toString()),
    ]);
    data.tagIds = Array.from(mergedIdSet);
    delete data.tags; // Not persisted — prevent Mongoose strict-mode warning

    // Dimension-tag guardrail: every new nugget must carry at least one
    // `format` tag and one `domain` tag. Prevents coverage from drifting back
    // below 100% as new content is added.
    const dimensionCheck = await validateDimensionTagIds(data.tagIds);
    if (!dimensionCheck.ok) {
      return sendValidationError(res, 'Validation failed', dimensionCheck.errors);
    }

    // Phase 2: Resolve categoryIds from category names
    const categoryIds = await resolveCategoryIds(data.categories || []);

    // Admin-only: Handle custom creation date
    const currentUserId = (req as any).user?.userId;
    const userRole = (req as any).user?.role;
    const isAdmin = userRole === 'admin';
    
    let publishedAt = data.publishedAt || new Date().toISOString();
    let isCustomCreatedAt = false;
    
    // Only allow customCreatedAt if user is admin and field is provided
    if (isAdmin && data.customCreatedAt) {
      try {
        const customDate = new Date(data.customCreatedAt);
        // Validate: reject invalid dates
        if (isNaN(customDate.getTime())) {
          return sendValidationError(res, 'Invalid customCreatedAt date', [{
            path: ['customCreatedAt'],
            message: 'Invalid date format',
            code: 'custom'
          }]);
        }
        
        // Optional: Reject future dates (uncomment if business rules require it)
        // const now = new Date();
        // if (customDate > now) {
        //   return sendValidationError(res, 'Custom date cannot be in the future', [{
        //     path: ['customCreatedAt'],
        //     message: 'Custom date cannot be in the future',
        //     code: 'custom'
        //   }]);
        // }
        
        publishedAt = customDate.toISOString();
        isCustomCreatedAt = true;
      } catch (error) {
        return sendValidationError(res, 'Invalid customCreatedAt date', [{
          path: ['customCreatedAt'],
          message: 'Invalid date format',
          code: 'custom'
        }]);
      }
    } else if (data.customCreatedAt && !isAdmin) {
      // Non-admin trying to set custom date - silently ignore (security: don't reveal this feature exists)
      // Just use default timestamp
    }
    
    const newArticle = await Article.create({
      ...data,
      categoryIds, // Add resolved Tag ObjectIds
      publishedAt,
      isCustomCreatedAt
    });

    res.status(201).json(await normalizeArticleDoc(newArticle));
  } catch (error: any) {
    console.error('[Articles] Create article error:', error);
    console.error('[Articles] Error name:', error.name);
    console.error('[Articles] Error message:', error.message);
    console.error('[Articles] Error stack:', error.stack);
    
    // Log more details for debugging
    if (error.name === 'ValidationError') {
      console.error('[Articles] Mongoose validation errors:', error.errors);
      const errors = Object.keys(error.errors).map(key => ({
        path: key,
        message: error.errors[key].message
      }));
      return sendValidationError(res, 'Validation failed', errors);
    }
    
    // Check for BSON size limit (MongoDB document size limit is 16MB)
    if (error.message && error.message.includes('BSON')) {
      console.error('[Articles] Document size limit exceeded');
      return sendPayloadTooLargeError(res, 'Payload too large. Please reduce image sizes or use fewer images.');
    }
    
    sendInternalError(res);
  }
};

export const updateArticle = async (req: Request, res: Response) => {
  invalidateSearchCache();
  try {
    // Get current user from authentication middleware
    const currentUserId = (req as any).user?.userId;
    if (!currentUserId) {
      return sendUnauthorizedError(res, 'Authentication required');
    }

    // Find article first to verify ownership
    const existingArticle = await Article.findById(req.params.id).lean();
    if (!existingArticle) {
      return sendNotFoundError(res, 'Article not found');
    }

    // Verify ownership (user must be the author or admin)
    const userRole = (req as any).user?.role;
    const isAdmin = userRole === 'admin';
    
    // Allow admin or author to edit
    if (existingArticle.authorId !== currentUserId && !isAdmin) {
      return sendForbiddenError(res, 'You can only edit your own articles');
    }

    // Validate input
    const validationResult = updateArticleSchema.safeParse(req.body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(err => ({
        path: err.path,
        message: err.message,
        code: err.code
      }));
      return sendValidationError(res, 'Validation failed', errors);
    }

    // DATA LOSS GUARD: Restrict the validated payload to keys the client
    // actually sent. Zod's .partial() does NOT strip .default() values — so
    // fields like `content: ''` and `contentStream: 'standard'` get synthesized
    // for any field the client omits, and a downstream `$set` would clobber
    // the stored value. A lightweight PATCH (e.g., visibility toggle) must
    // never erase content or flip the content stream.
    const clientSentKeys = new Set(
      req.body && typeof req.body === 'object' ? Object.keys(req.body) : []
    );
    for (const key of Object.keys(validationResult.data)) {
      if (!clientSentKeys.has(key)) {
        delete (validationResult.data as Record<string, unknown>)[key];
      }
    }

    // NOTE: Dimension-tag guardrail moved AFTER tag name → tagId resolution
    // (see below) so that free-form tag names are included in the check.

    // CRITICAL FIX: Deduplicate images array to prevent duplicates
    // Also check against existing images to prevent re-adding duplicates
    if (validationResult.data.images && Array.isArray(validationResult.data.images)) {
      console.log(`[Articles] Update: Received ${validationResult.data.images.length} images in payload`);
      console.log(`[Articles] Update: Existing article has ${(existingArticle.images || []).length} images`);
      
      // Get existing images (normalized for comparison)
      const existingImagesSet = new Set(
        (existingArticle.images || []).map((img: string) => 
          img && typeof img === 'string' ? img.toLowerCase().trim() : ''
        ).filter(Boolean)
      );
      
      const imageMap = new Map<string, string>();
      let duplicatesRemoved = 0;
      
      for (const img of validationResult.data.images) {
        if (img && typeof img === 'string' && img.trim()) {
          const normalized = img.toLowerCase().trim();
          
          // Check if this image already exists in the article
          if (existingImagesSet.has(normalized)) {
            console.log(`[Articles] Update: Image already exists in article, keeping: ${img}`);
            // Keep it - it's an existing image that should remain
            if (!imageMap.has(normalized)) {
              imageMap.set(normalized, img);
            }
          } else if (!imageMap.has(normalized)) {
            // New image, add it
            imageMap.set(normalized, img);
          } else {
            // Duplicate in the payload itself
            duplicatesRemoved++;
            console.log(`[Articles] Update: Duplicate image in payload, removed: ${img}`);
          }
        }
      }
      
      const deduplicated = Array.from(imageMap.values());
      if (deduplicated.length !== validationResult.data.images.length || duplicatesRemoved > 0) {
        console.log(`[Articles] Update: Deduplicated ${validationResult.data.images.length} → ${deduplicated.length} images (removed ${duplicatesRemoved} duplicates)`);
      }
      validationResult.data.images = deduplicated;
    }

    // GUARD: Prevent overwriting existing YouTube titles (backend is source of truth)
    // If backend already has media.previewMetadata.title, don't allow updates to it
    const updates = { ...validationResult.data };
    if (
      existingArticle.media?.previewMetadata?.title &&
      updates.media?.previewMetadata?.title
    ) {
      console.debug(
        `[Articles] Ignoring YouTube title update for article ${req.params.id} - backend title already exists`
      );
      // Remove title fields from update to preserve existing backend data
      if (updates.media.previewMetadata) {
        delete updates.media.previewMetadata.title;
        delete updates.media.previewMetadata.titleSource;
        delete updates.media.previewMetadata.titleFetchedAt;
      }
    }

    // CRITICAL FIX: Convert nested media.previewMetadata updates to dot notation
    // This prevents Mongoose from replacing the entire media object (which fails validation)
    // when we only want to update previewMetadata fields
    let mongoUpdate: any = { ...updates };
    
    // Admin-only: Handle custom creation date
    if (isAdmin && updates.customCreatedAt !== undefined) {
      if (updates.customCreatedAt) {
        try {
          const customDate = new Date(updates.customCreatedAt);
          // Validate: reject invalid dates
          if (isNaN(customDate.getTime())) {
            return sendValidationError(res, 'Invalid customCreatedAt date', [{
              path: ['customCreatedAt'],
              message: 'Invalid date format',
              code: 'custom'
            }]);
          }
          
          // Optional: Reject future dates (uncomment if business rules require it)
          // const now = new Date();
          // if (customDate > now) {
          //   return sendValidationError(res, 'Custom date cannot be in the future', [{
          //     path: ['customCreatedAt'],
          //     message: 'Custom date cannot be in the future',
          //     code: 'custom'
          //   }]);
          // }
          
          mongoUpdate.publishedAt = customDate.toISOString();
          mongoUpdate.isCustomCreatedAt = true;
        } catch (error) {
          return sendValidationError(res, 'Invalid customCreatedAt date', [{
            path: ['customCreatedAt'],
            message: 'Invalid date format',
            code: 'custom'
          }]);
        }
      } else {
        // Empty string/null - reset to automatic timestamp
        mongoUpdate.publishedAt = new Date().toISOString();
        mongoUpdate.isCustomCreatedAt = false;
      }
      // Remove customCreatedAt from update (it's not a field in the model)
      delete mongoUpdate.customCreatedAt;
    } else if (updates.customCreatedAt !== undefined && !isAdmin) {
      // Non-admin trying to set custom date - silently ignore (security: don't reveal this feature exists)
      delete mongoUpdate.customCreatedAt;
    }
    
    // Resolve tag names → tagIds and merge with dimension picker IDs.
    // tags[] is no longer persisted — tagIds is the sole storage field.
    if (updates.tags !== undefined || updates.tagIds !== undefined) {
      const resolvedFromNames = updates.tags
        ? await resolveTagNamesToIds(updates.tags)
        : [];
      const incomingTagIds = (updates.tagIds || []).filter(Boolean);
      const existingTagIds = (existingArticle.tagIds || []).map((id: { toString(): string }) => id.toString());

      const mergedIdSet = new Set([
        ...(incomingTagIds.length > 0 || resolvedFromNames.length > 0
          ? [...incomingTagIds, ...resolvedFromNames.map(id => id.toString())]
          : existingTagIds),
      ]);
      mongoUpdate.tagIds = Array.from(mergedIdSet);

      // Dimension-tag guardrail: the merged set must still contain at least one
      // `format` tag and one `domain` tag — an edit cannot strip an article
      // below dimension coverage. Runs AFTER tag name resolution so that
      // free-form tags are included.
      const dimensionCheck = await validateDimensionTagIds(mongoUpdate.tagIds);
      if (!dimensionCheck.ok) {
        return sendValidationError(res, 'Validation failed', dimensionCheck.errors);
      }
    }
    delete mongoUpdate.tags; // Not persisted

    // Phase 2: Resolve categoryIds if categories are being updated
    if (updates.categories && Array.isArray(updates.categories)) {
      const categoryIds = await resolveCategoryIds(updates.categories);
      mongoUpdate.categoryIds = categoryIds;
    }
    
    if (updates.media && !updates.media.type && !updates.media.url && updates.media.previewMetadata) {
      // This is a partial media update (only previewMetadata) - use dot notation
      delete mongoUpdate.media;
      
      // Convert previewMetadata fields to dot notation
      const previewMetadata = updates.media.previewMetadata;
      if (previewMetadata.title) {
        mongoUpdate['media.previewMetadata.title'] = previewMetadata.title;
      }
      if (previewMetadata.titleSource) {
        mongoUpdate['media.previewMetadata.titleSource'] = previewMetadata.titleSource;
      }
      if (previewMetadata.titleFetchedAt) {
        mongoUpdate['media.previewMetadata.titleFetchedAt'] = previewMetadata.titleFetchedAt;
      }
      // Add other previewMetadata fields as needed
      if (previewMetadata.url) {
        mongoUpdate['media.previewMetadata.url'] = previewMetadata.url;
      }
      if (previewMetadata.title !== undefined) {
        mongoUpdate['media.previewMetadata.title'] = previewMetadata.title;
      }
      if (previewMetadata.description !== undefined) {
        mongoUpdate['media.previewMetadata.description'] = previewMetadata.description;
      }
      
      console.debug(`[Articles] Using dot notation for media.previewMetadata update on article ${req.params.id}`);
    }

    const article = await Article.findByIdAndUpdate(
      req.params.id,
      { $set: mongoUpdate },
      { new: true, runValidators: false } // Disable runValidators for partial updates
    ).lean();

    if (!article) return sendNotFoundError(res, 'Article not found');

    // Notifications for private→public transitions are dispatched by the
    // Article schema's post('findOneAndUpdate') hook. Do not also dispatch
    // here: two Date.now() calls would produce different publishEventIds and
    // thus different dedupe keys, leading to duplicate notifications.

    res.json(await normalizeArticleDoc(article));
  } catch (error: any) {
    console.error('[Articles] Update article error:', error);
    sendInternalError(res);
  }
};

export const deleteArticle = async (req: Request, res: Response) => {
  invalidateSearchCache();
  try {
    const articleId = req.params.id;
    
    // Delete the article first
    const article = await Article.findByIdAndDelete(articleId);
    if (!article) return sendNotFoundError(res, 'Article not found');
    
    // Cascade cleanup: Remove article references from all collections
    // This maintains referential integrity
    const collectionsUpdated = await cleanupCollectionEntries(articleId);
    if (collectionsUpdated > 0) {
      console.log(`[Articles] Cleaned up article ${articleId} from ${collectionsUpdated} collection(s)`);
    }
    
    // Mark associated media as orphaned (MongoDB-first cleanup)
    try {
      const { markMediaAsOrphaned } = await import('../services/mediaCleanupService.js');
      const orphanedCount = await markMediaAsOrphaned('nugget', articleId);
      if (orphanedCount > 0) {
        console.log(`[Articles] Marked ${orphanedCount} media files as orphaned for article ${articleId}`);
      }
    } catch (mediaError: any) {
      // Log but don't fail article deletion if media cleanup fails
      console.error(`[Articles] Failed to mark media as orphaned:`, mediaError.message);
    }
    
    res.status(204).send();
  } catch (error: any) {
    console.error('[Articles] Delete article error:', error);
    sendInternalError(res);
  }
};

/**
 * Normalize image URL for comparison (strip query/hash so frontend and stored URLs match).
 * Must match frontend normalizeImageUrl logic so DELETE /articles/:id/images finds the image.
 */
function normalizeImageUrlForCompare(url: string): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  try {
    const urlObj = new URL(trimmed);
    return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`.toLowerCase();
  } catch {
    return trimmed.toLowerCase();
  }
}

/**
 * Delete a specific image from an article's images array
 * 
 * DELETE /api/articles/:id/images
 * 
 * Body: { imageUrl: string }
 */
export const deleteArticleImage = async (req: Request, res: Response) => {
  try {
    const currentUserId = (req as any).user?.userId;
    if (!currentUserId) {
      return sendUnauthorizedError(res, 'Authentication required');
    }

    const { id } = req.params;
    const { imageUrl } = req.body;

    if (!imageUrl || typeof imageUrl !== 'string') {
      return sendValidationError(res, 'imageUrl is required and must be a string', []);
    }

    // Find article and verify ownership
    const article = await Article.findById(id);
    if (!article) {
      return sendNotFoundError(res, 'Article not found');
    }

    // Verify ownership
    if (article.authorId !== currentUserId) {
      return sendForbiddenError(res, 'You can only edit your own articles');
    }

    // Normalize for comparison (strip query/hash) so stored URL and request URL match
    const normalizedImageUrl = normalizeImageUrlForCompare(imageUrl);

    // Remove image from array (deduplicate by removing all occurrences)
    const currentImages = article.images || [];
    const updatedImages = currentImages.filter((img: string) => {
      if (!img || typeof img !== 'string') return true;
      return normalizeImageUrlForCompare(img) !== normalizedImageUrl;
    });

    // CRITICAL: Also check if image is in media field
    // Images can be stored in: images array, media.url, or media.previewMetadata.imageUrl
    let mediaUpdated = false;
    let updatedMedia = article.media ? { ...article.media } : null;
    
    if (updatedMedia) {
      // Check if media.url matches the image to delete
      if (updatedMedia.url && normalizeImageUrlForCompare(updatedMedia.url) === normalizedImageUrl) {
        if (updatedMedia.type === 'image') {
          // If media type is image and URL matches, clear the entire media object
          updatedMedia = null;
          mediaUpdated = true;
          console.log(`[Articles] Delete image: Removing image from media.url (clearing media object)`);
        } else {
          // If media type is not image, just clear the URL (preserve other metadata)
          updatedMedia.url = '';
          mediaUpdated = true;
          console.log(`[Articles] Delete image: Clearing image URL from media.url`);
        }
      }
      
      // Check if media.previewMetadata.imageUrl matches
      if (updatedMedia.previewMetadata?.imageUrl) {
        const ogImageUrl = normalizeImageUrlForCompare(updatedMedia.previewMetadata.imageUrl);
        if (ogImageUrl === normalizedImageUrl) {
          // Remove imageUrl from previewMetadata but keep other metadata
          updatedMedia.previewMetadata = {
            ...updatedMedia.previewMetadata,
            imageUrl: undefined
          };
          mediaUpdated = true;
          console.log(`[Articles] Delete image: Removing image from media.previewMetadata.imageUrl`);
        }
      }
    }

    // CRITICAL FIX: Also check and remove from primaryMedia and supportingMedia
    // Images can be stored in multiple places, so we need to remove from all locations
    let primaryMediaUpdated = false;
    let updatedPrimaryMedia = article.primaryMedia ? { ...article.primaryMedia } : null;
    
    if (updatedPrimaryMedia && updatedPrimaryMedia.type === 'image' && updatedPrimaryMedia.url) {
      const primaryMediaUrl = normalizeImageUrlForCompare(updatedPrimaryMedia.url);
      if (primaryMediaUrl === normalizedImageUrl) {
        // Remove primaryMedia if it matches the image to delete
        updatedPrimaryMedia = null;
        primaryMediaUpdated = true;
        console.log(`[Articles] Delete image: Removing image from primaryMedia`);
      }
    }
    
    let supportingMediaUpdated = false;
    let updatedSupportingMedia = article.supportingMedia ? [...article.supportingMedia] : [];

    if (updatedSupportingMedia.length > 0) {
      const beforeCount = updatedSupportingMedia.length;
      updatedSupportingMedia = updatedSupportingMedia.filter((media: any) => {
        if (media.type === 'image' && media.url) {
          const supportingUrl = normalizeImageUrlForCompare(media.url);
          return supportingUrl !== normalizedImageUrl;
        }
        return true; // Keep non-image media or media without URL
      });

      if (updatedSupportingMedia.length < beforeCount) {
        supportingMediaUpdated = true;
        // Reindex positions so the canonical order stays contiguous after delete.
        updatedSupportingMedia = updatedSupportingMedia.map((media: any, index: number) => ({
          ...(typeof media?.toObject === 'function' ? media.toObject() : media),
          position: index,
          order: index,
        }));
        console.log(`[Articles] Delete image: Removed ${beforeCount - updatedSupportingMedia.length} image(s) from supportingMedia`);
      }
    }

    // Check if image was actually removed from any source
    const imageRemovedFromArray = updatedImages.length < currentImages.length;
    const imageRemoved = imageRemovedFromArray || mediaUpdated || primaryMediaUpdated || supportingMediaUpdated;
    
    if (!imageRemoved) {
      console.log(`[Articles] Delete image: Image not found in article.`, {
        currentImages: currentImages,
        mediaUrl: article.media?.url,
        mediaImageUrl: article.media?.previewMetadata?.imageUrl,
        primaryMediaUrl: article.primaryMedia?.url,
        supportingMediaCount: article.supportingMedia?.length || 0
      });
      return sendNotFoundError(res, 'Image not found in article');
    }

    console.log(`[Articles] Delete image: Removing image from article.`, {
      imagesBefore: currentImages.length,
      imagesAfter: updatedImages.length,
      mediaUpdated: mediaUpdated,
      primaryMediaUpdated: primaryMediaUpdated,
      supportingMediaUpdated: supportingMediaUpdated,
      removedFromArray: imageRemovedFromArray
    });

    // Also check and remove from mediaIds if this is a Cloudinary URL
    let updatedMediaIds = article.mediaIds || [];
    let removedMediaId: string | null = null;
    
    if (imageUrl.includes('cloudinary.com') || imageUrl.includes('res.cloudinary.com')) {
      // Try to find Media record by secureUrl to get the mediaId
      const { Media } = await import('../models/Media.js');
      const urlMatch = imageUrl.match(/\/v\d+\/(.+?)(?:\.[^.]+)?$/);
      if (urlMatch && urlMatch[1]) {
        const publicId = urlMatch[1].replace(/\.[^.]+$/, '');
        const mediaRecord = await Media.findOne({ 
          'cloudinary.publicId': publicId,
          ownerId: currentUserId,
          status: 'active'
        });
        
        if (mediaRecord) {
          const mediaIdString = mediaRecord._id.toString();
          if (updatedMediaIds.includes(mediaIdString)) {
            updatedMediaIds = updatedMediaIds.filter((id: string) => id !== mediaIdString);
            removedMediaId = mediaIdString;
            console.log(`[Articles] Delete image: Removed mediaId ${mediaIdString} from mediaIds array`);
          }
        }
      }
    }

    // Update article
    article.images = updatedImages;
    if (removedMediaId) {
      article.mediaIds = updatedMediaIds;
    }
    if (mediaUpdated) {
      article.media = updatedMedia;
    }
    if (primaryMediaUpdated) {
      article.primaryMedia = updatedPrimaryMedia;
    }
    if (supportingMediaUpdated) {
      article.supportingMedia = updatedSupportingMedia;
    }
    await article.save();

    // If the image URL is a Cloudinary URL, try to find and delete the media record
    // Extract public_id from Cloudinary URL if possible
    console.log(`[Articles] Delete image: ${imageUrl}`);
    try {
      if (imageUrl.includes('cloudinary.com') || imageUrl.includes('res.cloudinary.com')) {
        // Try to extract public_id from URL
        // Cloudinary URLs can be in format: https://res.cloudinary.com/{cloud_name}/{resource_type}/upload/v{version}/{public_id}.{format}
        const urlMatch = imageUrl.match(/\/v\d+\/(.+?)(?:\.[^.]+)?$/);
        if (urlMatch && urlMatch[1]) {
          const publicId = urlMatch[1].replace(/\.[^.]+$/, ''); // Remove extension
          console.log(`[Articles] Extracted publicId from Cloudinary URL: ${publicId}`);
          
          // Find media record by publicId
          const { Media } = await import('../models/Media.js');
          const mediaRecord = await Media.findOne({ 
            'cloudinary.publicId': publicId,
            ownerId: currentUserId,
            status: 'active'
          });

          if (mediaRecord) {
            console.log(`[Articles] Found media record for deletion: ${mediaRecord._id}`);
            
            // CRITICAL: Check if this Media is used by other articles before deleting from Cloudinary
            const { Article } = await import('../models/Article.js');
            const otherArticlesUsingMedia = await Article.find({
              _id: { $ne: id }, // Exclude current article
              $or: [
                { mediaIds: mediaRecord._id.toString() },
                { images: { $regex: publicId, $options: 'i' } } // Also check images array for this publicId
              ],
              authorId: currentUserId // Only check user's own articles
            }).lean();
            
            const isSharedAcrossNuggets = otherArticlesUsingMedia.length > 0;
            
            if (isSharedAcrossNuggets) {
              console.log(`[Articles] Media ${mediaRecord._id} is used by ${otherArticlesUsingMedia.length} other article(s). Not deleting from Cloudinary.`);
              // Don't delete from Cloudinary if shared, but still remove from this article
            } else {
              console.log(`[Articles] Media ${mediaRecord._id} is only used by this article. Safe to delete from Cloudinary.`);
              
              // Mark media as orphaned (soft delete)
              mediaRecord.status = 'orphaned';
              await mediaRecord.save();
              console.log(`[Articles] Media record marked as orphaned: ${mediaRecord._id}`);

              // Best-effort Cloudinary deletion (only if not shared)
              const { deleteFromCloudinary } = await import('../services/cloudinaryService.js');
              const deleted = await deleteFromCloudinary(publicId, mediaRecord.cloudinary.resourceType);
              if (deleted) {
                console.log(`[Articles] Cloudinary asset deleted successfully: ${publicId}`);
              } else {
                console.warn(`[Articles] Cloudinary deletion failed for: ${publicId} (but MongoDB record marked as orphaned)`);
              }
            }
          } else {
            console.log(`[Articles] No media record found for publicId: ${publicId} (may be external URL)`);
          }
        } else {
          console.log(`[Articles] Could not extract publicId from Cloudinary URL: ${imageUrl}`);
        }
      } else {
        console.log(`[Articles] Image URL is not a Cloudinary URL (external image): ${imageUrl}`);
      }
    } catch (mediaError: any) {
      // Log but don't fail if media cleanup fails
      console.warn(`[Articles] Failed to cleanup media for image ${imageUrl}:`, mediaError.message);
    }

    res.json({
      success: true,
      message: 'Image deleted successfully',
      images: updatedImages
    });
  } catch (error: any) {
    console.error('[Articles] Delete image error:', error);
    sendInternalError(res);
  }
};

/**
 * Get count of articles for the current user
 * Returns total, public, and private counts
 * 
 * GET /api/articles/my/counts
 * Requires authentication
 */
export const getMyArticleCounts = async (req: Request, res: Response) => {
  try {
    // Get current user from authentication middleware
    const currentUserId = (req as any).user?.userId;
    if (!currentUserId) {
      return sendUnauthorizedError(res, 'Authentication required');
    }

    // Build query for user's articles (all visibility levels)
    const userQuery = { authorId: currentUserId };

    // Execute count queries in parallel for efficiency
    const [total, publicCount, privateCount] = await Promise.all([
      Article.countDocuments(userQuery),
      Article.countDocuments({ ...userQuery, visibility: 'public' }),
      Article.countDocuments({ ...userQuery, visibility: 'private' })
    ]);

    res.json({
      total,
      public: publicCount,
      private: privateCount
    });
  } catch (error: any) {
    console.error('[Articles] Get my article counts error:', error);
    sendInternalError(res);
  }
};

const feedSchema = z.object({
  feed: z.enum(['home', 'market-pulse']),
});

function normalizeLegacyStreamToFeed(stream: 'pulse' | 'standard'): FeedBadgeKey {
  return stream === 'pulse' ? 'market-pulse' : 'home';
}

function getAuthedUserId(req: Request, res: Response): string | null {
  const userId = (req as any).user?.userId;
  if (!userId) {
    res.status(401).json({ error: true, message: 'Unauthorized' });
    return null;
  }
  return userId;
}

export const getUnseenFeedCounts = async (req: Request, res: Response) => {
  try {
    const userId = getAuthedUserId(req, res);
    if (!userId) return;
    const counts = await getUnseenFeedCountsForUser(userId);
    res.json(counts);
  } catch (error: unknown) {
    createRequestLogger(req).error({ error }, '[Articles] Get unseen feed counts error');
    sendInternalError(res);
  }
};

export const markFeedSeen = async (req: Request, res: Response) => {
  try {
    const userId = getAuthedUserId(req, res);
    if (!userId) return;
    const parsed = feedSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendValidationError(res, 'Validation failed', parsed.error.errors);
    }
    await markFeedSeenForUser(userId, parsed.data.feed);
    res.json({ ok: true });
  } catch (error: unknown) {
    createRequestLogger(req).error({ error }, '[Articles] Mark feed seen error');
    sendInternalError(res);
  }
};

/**
 * GET /api/articles/pulse/unseen-count — authenticated.
 */
export const getPulseUnseenCount = async (req: Request, res: Response) => {
  try {
    const userId = getAuthedUserId(req, res);
    if (!userId) return;
    const count = await getUnseenCountForFeed(userId, normalizeLegacyStreamToFeed('pulse'));
    res.json({ count });
  } catch (error: unknown) {
    createRequestLogger(req).error({ error }, '[Articles] Get pulse unseen count error');
    sendInternalError(res);
  }
};

/**
 * POST /api/articles/pulse/mark-seen — authenticated.
 */
export const markPulseSeen = async (req: Request, res: Response) => {
  try {
    const userId = getAuthedUserId(req, res);
    if (!userId) return;
    await markFeedSeenForUser(userId, normalizeLegacyStreamToFeed('pulse'));
    res.json({ ok: true });
  } catch (error: unknown) {
    createRequestLogger(req).error({ error }, '[Articles] Mark pulse seen error');
    sendInternalError(res);
  }
};

/**
 * GET /api/articles/standard/unseen-count — authenticated.
 * Same semantics as the Pulse counterpart but for the Home (standard) feed.
 */
export const getStandardUnseenCount = async (req: Request, res: Response) => {
  try {
    const userId = getAuthedUserId(req, res);
    if (!userId) return;
    const count = await getUnseenCountForFeed(userId, normalizeLegacyStreamToFeed('standard'));
    res.json({ count });
  } catch (error: unknown) {
    createRequestLogger(req).error({ error }, '[Articles] Get standard unseen count error');
    sendInternalError(res);
  }
};

/**
 * POST /api/articles/standard/mark-seen — authenticated.
 */
export const markStandardSeen = async (req: Request, res: Response) => {
  try {
    const userId = getAuthedUserId(req, res);
    if (!userId) return;
    await markFeedSeenForUser(userId, normalizeLegacyStreamToFeed('standard'));
    res.json({ ok: true });
  } catch (error: unknown) {
    createRequestLogger(req).error({ error }, '[Articles] Mark standard seen error');
    sendInternalError(res);
  }
};
