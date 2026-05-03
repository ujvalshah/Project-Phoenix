import { Tag } from '../models/Tag.js';
import { Article } from '../models/Article.js';
import { normalizeDoc, normalizeDocs, invalidateTagNameCache } from '../utils/db.js';
import { z } from 'zod';
import { calculateTagUsageCounts } from '../utils/tagUsageHelpers.js';
import { resolveTagIdsToNames } from '../utils/tagHelpers.js';
import { createRequestLogger } from '../utils/logger.js';
import { captureException } from '../utils/sentry.js';
import { createOrResolveTag, createOrResolveTags } from '../services/tagCreationService.js';
import { buildApiCacheKey, getOrSetCachedJson, invalidateApiResponseCachePrefix } from '../services/apiResponseCacheService.js';
const TAG_TAXONOMY_CACHE_NAMESPACE = 'tags:taxonomy:v1';
const TAG_TAXONOMY_CACHE_TTL_SECONDS = 60;
// Validation schemas
//
// Dimension fields (`dimension`, `sortOrder`, `aliases`, `isOfficial`) are
// optional on create/update so the same endpoints serve both:
//   - free-form tags (no dimension), used by the legacy admin tag manager
//   - dimension tags (format/domain/subtopic), used by the AdminTaggingPage
//     inline editor.
// The DB-level dimension validator (validateDimensionTagIds) protects article
// writes; this controller just needs to persist whatever the admin sends.
const createTagSchema = z.object({
    name: z.string().min(1, 'Tag name is required').max(50, 'Tag name too long'),
    status: z.enum(['active', 'pending', 'deprecated']).optional().default('active'),
    dimension: z.enum(['format', 'domain', 'subtopic']).optional(),
    sortOrder: z.number().int().min(0).optional(),
    aliases: z.array(z.string().trim().min(1)).optional(),
    isOfficial: z.boolean().optional(),
});
const updateTagSchema = z.object({
    name: z.string().min(1, 'Tag name is required').max(50, 'Tag name too long').optional(),
    type: z.enum(['category', 'tag']).optional(), // Legacy field - ignored, all tags are treated as 'tag'
    status: z.enum(['active', 'pending', 'deprecated']).optional(),
    isOfficial: z.boolean().optional(),
    dimension: z.enum(['format', 'domain', 'subtopic']).nullable().optional(),
    sortOrder: z.number().int().min(0).optional(),
    aliases: z.array(z.string().trim().min(1)).optional(),
});
export const getTags = async (req, res) => {
    try {
        // Support format query parameter
        // format=simple: Returns array of strings (rawName values) - LEGACY
        // format=full: Returns array of full tag objects with IDs - NEW (Phase 2)
        // no format: Returns full tag objects for Admin Panel
        if (req.query.format === 'simple') {
            // LEGACY: Even simple format should have pagination for safety
            const page = Math.max(parseInt(req.query.page) || 1, 1);
            const limit = Math.min(Math.max(parseInt(req.query.limit) || 100, 1), 500);
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
            const page = Math.max(parseInt(req.query.page) || 1, 1);
            const limit = Math.min(Math.max(parseInt(req.query.limit) || 100, 1), 500);
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
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 25, 1), 100);
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
    }
    catch (error) {
        // Audit Phase-1 Fix: Use structured logging and Sentry capture
        const requestLogger = createRequestLogger(req.id || 'unknown', req?.user?.userId, req.path);
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
export const createTag = async (req, res) => {
    try {
        // Validate input - only name and status allowed
        const validationResult = createTagSchema.safeParse(req.body);
        if (!validationResult.success) {
            return res.status(400).json({
                message: 'Validation failed',
                errors: validationResult.error.errors
            });
        }
        const { name, status = 'active', dimension, sortOrder, aliases, isOfficial } = validationResult.data;
        // Use shared tag creation service. This always resolves to an existing tag
        // (by canonicalName) or creates a new one. We then patch dimension fields
        // if provided — that way "create a Climate domain tag" via the admin UI
        // either upgrades an existing free-form "Climate" tag or creates a fresh
        // dimension tag, both producing a single Tag doc.
        const tag = await createOrResolveTag(name, { status });
        if (dimension !== undefined || sortOrder !== undefined || aliases !== undefined || isOfficial !== undefined) {
            const patch = {};
            if (dimension !== undefined)
                patch.dimension = dimension;
            if (sortOrder !== undefined)
                patch.sortOrder = sortOrder;
            if (isOfficial !== undefined)
                patch.isOfficial = isOfficial;
            const update = { $set: patch };
            if (aliases !== undefined) {
                // Replace alias list wholesale — the UI sends the canonical set.
                update.$set.aliases = aliases;
            }
            await Tag.updateOne({ _id: tag.id }, update);
            Object.assign(tag, patch, aliases !== undefined ? { aliases } : {});
        }
        // Check if tag was newly created by querying if it exists with this exact canonicalName
        // If it existed before, it would have been returned; if it's new, we just created it
        // We'll use a simple heuristic: try to find the tag and check if it matches our expectations
        // Since createOrResolveTag handles all cases, we'll return 201 for new tags, 200 for existing
        // The service logs will indicate if it was created or resolved
        // For simplicity, always return 201 (created) since the service handles both cases
        // The frontend doesn't need to distinguish - it just needs the tag object
        invalidateTagNameCache();
        await invalidateApiResponseCachePrefix(TAG_TAXONOMY_CACHE_NAMESPACE);
        res.status(201).json(tag);
    }
    catch (error) {
        // Audit Phase-1 Fix: Use structured logging and Sentry capture
        const requestLogger = createRequestLogger(req.id || 'unknown', req?.user?.userId, req.path);
        requestLogger.error({
            msg: '[Tags] Create tag error',
            error: {
                message: error.message,
                stack: error.stack,
            },
        });
        captureException(error instanceof Error ? error : new Error(String(error)), { requestId: req.id, route: req.path });
        // Handle validation errors from createOrResolveTag
        if (error.message && error.message.includes('cannot be empty')) {
            return res.status(400).json({
                message: error.message
            });
        }
        res.status(500).json({ message: 'Internal server error' });
    }
};
export const updateTag = async (req, res) => {
    try {
        const requestLogger = createRequestLogger(req.id || 'unknown', req?.user?.userId, req.path);
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ message: 'Tag ID is required' });
        }
        requestLogger.debug({ id }, '[Tags] Update tag request');
        // Validate input
        const validationResult = updateTagSchema.safeParse(req.body);
        if (!validationResult.success) {
            requestLogger.warn({ id, errors: validationResult.error.errors }, '[Tags] Validation failed');
            return res.status(400).json({
                message: 'Validation failed',
                errors: validationResult.error.errors
            });
        }
        // Fetch current tag BEFORE updating (needed for article updates)
        const currentTag = await Tag.findById(id);
        if (!currentTag) {
            requestLogger.info({ id }, '[Tags] Tag not found');
            return res.status(404).json({ message: 'Tag not found' });
        }
        const updateData = {};
        let oldName = null;
        let newName = null;
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
            requestLogger.info({
                id,
                oldRawName: oldName,
                oldCanonicalName: currentTag.canonicalName,
                newRawName: newName,
                newCanonicalName: canonicalName
            }, '[Tags] Renaming tag');
            // Check if the new canonicalName would create a duplicate
            // This prevents case variations (e.g., "AI" vs "ai" vs "Ai") from creating separate tags
            const existingTag = await Tag.findOne({
                canonicalName,
                _id: { $ne: id }
            });
            if (existingTag) {
                requestLogger.warn({
                    existingTagId: existingTag._id,
                    existingTagName: existingTag.rawName,
                    requestedName: trimmedName
                }, '[Tags] Duplicate tag found');
                return res.status(409).json({ message: 'A tag with this name already exists' });
            }
            updateData.rawName = trimmedName;
            updateData.canonicalName = canonicalName;
        }
        // Add other fields if provided
        // Type field is ignored - all tags are treated as 'tag' type
        if (validationResult.data.status !== undefined) {
            updateData.status = validationResult.data.status;
        }
        if (validationResult.data.isOfficial !== undefined) {
            updateData.isOfficial = validationResult.data.isOfficial;
        }
        // Dimension taxonomy fields — let admins assign/clear a dimension and
        // tweak ordering & aliases without going through the seed script.
        if (validationResult.data.dimension !== undefined) {
            updateData.dimension = validationResult.data.dimension; // null clears
        }
        if (validationResult.data.sortOrder !== undefined) {
            updateData.sortOrder = validationResult.data.sortOrder;
        }
        if (validationResult.data.aliases !== undefined) {
            updateData.aliases = validationResult.data.aliases;
        }
        requestLogger.debug({ id, fields: Object.keys(updateData) }, '[Tags] Update data prepared');
        const tag = await Tag.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
        if (!tag) {
            requestLogger.warn({ id }, '[Tags] Tag update failed - tag not found after update');
            return res.status(404).json({ message: 'Tag not found' });
        }
        const normalizedTag = normalizeDoc(tag);
        requestLogger.info({
            id: normalizedTag.id,
            rawName: normalizedTag.rawName,
            canonicalName: normalizedTag.canonicalName,
            name: normalizedTag.name // Virtual field
        }, '[Tags] Tag updated successfully');
        // Tag rename: no article-level propagation needed — articles reference
        // tags by ObjectId (tagIds), which is stable across renames. The tag-name
        // cache is invalidated so API responses reflect the new name immediately.
        invalidateTagNameCache();
        await invalidateApiResponseCachePrefix(TAG_TAXONOMY_CACHE_NAMESPACE);
        res.json(normalizedTag);
    }
    catch (error) {
        // Audit Phase-1 Fix: Use structured logging and Sentry capture
        const requestLogger = createRequestLogger(req.id || 'unknown', req?.user?.userId, req.path);
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
export const deleteTag = async (req, res) => {
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
            return res.status(404).json({ message: 'Tag not found' });
        }
        invalidateTagNameCache();
        await invalidateApiResponseCachePrefix(TAG_TAXONOMY_CACHE_NAMESPACE);
        res.status(204).send();
    }
    catch (error) {
        // Audit Phase-1 Fix: Use structured logging and Sentry capture
        const requestLogger = createRequestLogger(req.id || 'unknown', req?.user?.userId, req.path);
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
/**
 * DELETE /api/categories/by-id/:id
 *
 * Soft-deletes a tag by setting status='deprecated'. We never hard-delete
 * dimension tags because Articles reference them via tagIds — a hard delete
 * would create dangling references and silently strip filters.
 *
 * Free-form tags (no dimension) also use soft delete here for consistency;
 * the legacy DELETE /api/categories/:name endpoint above remains for the old
 * admin tag manager UI but should not be called for dimension tags.
 */
export const softDeleteTagById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ message: 'Tag ID is required' });
        }
        const tag = await Tag.findById(id);
        if (!tag) {
            return res.status(404).json({ message: 'Tag not found' });
        }
        if (tag.status === 'deprecated') {
            return res.json({ message: 'Tag was already deprecated', tag: normalizeDoc(tag) });
        }
        tag.status = 'deprecated';
        await tag.save();
        invalidateTagNameCache();
        await invalidateApiResponseCachePrefix(TAG_TAXONOMY_CACHE_NAMESPACE);
        res.json({ message: 'Tag deprecated', tag: normalizeDoc(tag) });
    }
    catch (error) {
        const requestLogger = createRequestLogger(req.id || 'unknown', req?.user?.userId, req.path);
        requestLogger.error({
            msg: '[Tags] Soft-delete tag error',
            error: { message: error.message, stack: error.stack },
        });
        captureException(error instanceof Error ? error : new Error(String(error)), { requestId: req.id, route: req.path });
        res.status(500).json({ message: 'Internal server error' });
    }
};
/**
 * GET /api/categories/taxonomy/coverage
 *
 * Returns dimension-tag coverage stats across all articles.
 * Used by the AdminTaggingPage "Coverage" badge.
 */
export const getTaxonomyCoverage = async (req, res) => {
    try {
        const dimensionTags = await Tag.find({
            dimension: { $exists: true, $ne: null },
            status: 'active',
        })
            .select('_id dimension')
            .lean();
        const formatIds = dimensionTags.filter(t => t.dimension === 'format').map(t => t._id);
        const domainIds = dimensionTags.filter(t => t.dimension === 'domain').map(t => t._id);
        const subtopicIds = dimensionTags.filter(t => t.dimension === 'subtopic').map(t => t._id);
        const allIds = [...formatIds, ...domainIds, ...subtopicIds];
        const [total, withAny, withFormat, withDomain, withSubtopic] = await Promise.all([
            Article.countDocuments({}),
            Article.countDocuments({ tagIds: { $in: allIds } }),
            Article.countDocuments({ tagIds: { $in: formatIds } }),
            Article.countDocuments({ tagIds: { $in: domainIds } }),
            Article.countDocuments({ tagIds: { $in: subtopicIds } }),
        ]);
        res.json({
            total,
            withAny,
            withFormat,
            withDomain,
            withSubtopic,
            missingAny: total - withAny,
            missingFormat: total - withFormat,
            missingDomain: total - withDomain,
        });
    }
    catch (error) {
        const requestLogger = createRequestLogger(req.id || 'unknown', req?.user?.userId, req.path);
        const err = error instanceof Error ? error : new Error(String(error));
        requestLogger.error({
            msg: '[Tags] Taxonomy coverage error',
            error: { message: err.message, stack: err.stack },
        });
        captureException(err, { requestId: req.id, route: req.path });
        res.status(500).json({ message: 'Internal server error' });
    }
};
export const resolveTags = async (req, res) => {
    try {
        const { tagIds } = req.body;
        if (!Array.isArray(tagIds)) {
            return res.status(400).json({ message: 'tagIds must be an array' });
        }
        const tags = await resolveTagIdsToNames(tagIds.map((id) => typeof id === 'string' ? id : id.toString()));
        res.json({
            tags: tags.map((name, index) => ({
                id: tagIds[index],
                rawName: name
            }))
        });
    }
    catch (error) {
        const requestLogger = createRequestLogger(req.id || 'unknown', req?.user?.userId, req.path);
        requestLogger.error({
            msg: '[Tags] Resolve tags error',
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
 * GET /api/categories/taxonomy
 * Returns the three-axis tag taxonomy: formats + domains + subtopics.
 * All three are flat arrays sorted by sortOrder.
 * Cached-friendly: the taxonomy changes infrequently.
 */
export const getTagTaxonomy = async (req, res) => {
    try {
        const cacheKey = buildApiCacheKey(TAG_TAXONOMY_CACHE_NAMESPACE, ['active']);
        const payload = await getOrSetCachedJson(cacheKey, TAG_TAXONOMY_CACHE_TTL_SECONDS, async () => {
            // Fetch all active dimension tags in one query
            const dimensionTags = await Tag.find({
                dimension: { $exists: true, $ne: null },
                status: 'active',
            })
                .sort({ sortOrder: 1, rawName: 1 })
                .lean();
            // Compute usage counts for all dimension tags in one aggregation
            const tagIds = dimensionTags.map(t => t._id);
            const usageAgg = await Article.aggregate([
                { $match: { tagIds: { $in: tagIds } } },
                { $unwind: '$tagIds' },
                { $match: { tagIds: { $in: tagIds } } },
                { $group: { _id: '$tagIds', count: { $sum: 1 } } },
            ]);
            const usageMap = new Map();
            for (const row of usageAgg) {
                usageMap.set(row._id.toString(), row.count);
            }
            const normalize = (t) => ({
                id: t._id.toString(),
                rawName: t.rawName,
                canonicalName: t.canonicalName,
                dimension: t.dimension,
                sortOrder: t.sortOrder ?? 0,
                usageCount: usageMap.get(t._id.toString()) || 0,
            });
            // Partition into three flat arrays
            const formats = dimensionTags.filter(t => t.dimension === 'format').map(normalize);
            const domains = dimensionTags.filter(t => t.dimension === 'domain').map(normalize);
            const subtopics = dimensionTags.filter(t => t.dimension === 'subtopic').map(normalize);
            return { formats, domains, subtopics };
        }, {
            route: 'GET /api/categories/taxonomy',
            namespace: TAG_TAXONOMY_CACHE_NAMESPACE,
            requestId: String(req.id ?? ''),
        });
        res.json(payload);
    }
    catch (error) {
        const requestLogger = createRequestLogger(req.id || 'unknown', req?.user?.userId, req.path);
        const err = error instanceof Error ? error : new Error(String(error));
        requestLogger.error({
            msg: '[Tags] Get taxonomy error',
            error: { message: err.message, stack: err.stack },
        });
        captureException(err, { requestId: req.id, route: req.path });
        res.status(500).json({ message: 'Internal server error' });
    }
};
/**
 * POST /api/categories/taxonomy/reorder
 * Bulk-update sortOrder for tags within a single dimension.
 *
 * Body options:
 *   { dimension: 'format'|'domain', tagIds: string[] }
 *     → Sets sortOrder = index for each tag in the given order (custom mode).
 *
 *   { dimension: 'format'|'domain', mode: 'a-z'|'most-nuggets'|'latest' }
 *     → Auto-sorts active tags in that dimension by the chosen criterion
 *       and persists the resulting sortOrder values.
 */
const reorderTaxonomySchema = z.object({
    dimension: z.enum(['format', 'domain']),
    tagIds: z.array(z.string().min(1)).optional(),
    mode: z.enum(['a-z', 'most-nuggets', 'latest']).optional(),
}).refine((d) => d.tagIds !== undefined || d.mode !== undefined, { message: 'Either tagIds (custom order) or mode (auto-sort) is required' });
export const reorderTaxonomy = async (req, res) => {
    try {
        const parsed = reorderTaxonomySchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ message: 'Validation failed', errors: parsed.error.errors });
        }
        const { dimension, tagIds, mode } = parsed.data;
        if (tagIds) {
            // Custom order — set sortOrder = index
            const ops = tagIds.map((id, index) => ({
                updateOne: {
                    filter: { _id: id, dimension },
                    update: { $set: { sortOrder: index } },
                },
            }));
            await Tag.bulkWrite(ops);
            return res.json({ message: 'Reordered', count: tagIds.length });
        }
        // Auto-sort mode — fetch, sort, persist
        const tags = await Tag.find({ dimension, status: 'active' }).lean();
        if (mode === 'a-z') {
            tags.sort((a, b) => (a.rawName || '').localeCompare(b.rawName || ''));
        }
        else if (mode === 'latest') {
            // Most recently created first
            tags.sort((a, b) => {
                const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return bTime - aTime;
            });
        }
        else if (mode === 'most-nuggets') {
            // Need usage counts from articles
            const tagIdList = tags.map(t => t._id);
            const usageAgg = await Article.aggregate([
                { $match: { tagIds: { $in: tagIdList } } },
                { $unwind: '$tagIds' },
                { $match: { tagIds: { $in: tagIdList } } },
                { $group: { _id: '$tagIds', count: { $sum: 1 } } },
            ]);
            const usageMap = new Map();
            for (const row of usageAgg) {
                usageMap.set(row._id.toString(), row.count);
            }
            tags.sort((a, b) => (usageMap.get(b._id.toString()) || 0) - (usageMap.get(a._id.toString()) || 0));
        }
        const ops = tags.map((t, index) => ({
            updateOne: {
                filter: { _id: t._id },
                update: { $set: { sortOrder: index } },
            },
        }));
        if (ops.length > 0) {
            await Tag.bulkWrite(ops);
        }
        await invalidateApiResponseCachePrefix(TAG_TAXONOMY_CACHE_NAMESPACE);
        return res.json({ message: `Sorted by ${mode}`, count: tags.length });
    }
    catch (error) {
        const requestLogger = createRequestLogger(req.id || 'unknown', req?.user?.userId, req.path);
        const err = error instanceof Error ? error : new Error(String(error));
        requestLogger.error({
            msg: '[Tags] Reorder taxonomy error',
            error: { message: err.message, stack: err.stack },
        });
        captureException(err, { requestId: req.id, route: req.path });
        res.status(500).json({ message: 'Internal server error' });
    }
};
export const syncArticleTags = async (req, res) => {
    try {
        const requestLogger = createRequestLogger(req.id || 'unknown', req?.user?.userId, req.path);
        requestLogger.info({ msg: '[Tags] Starting article tags sync' });
        // Get all articles and extract distinct tag values
        const articles = await Article.find({
            tags: { $exists: true, $ne: [] }
        }).select('tags').lean();
        // Extract all unique tag values (case-insensitive)
        const articleTagSet = new Set();
        for (const article of articles) {
            if (article.tags && Array.isArray(article.tags)) {
                for (const tag of article.tags) {
                    if (tag && typeof tag === 'string' && tag.trim()) {
                        articleTagSet.add(tag.trim());
                    }
                }
            }
        }
        const articleTags = Array.from(articleTagSet);
        if (articleTags.length === 0) {
            return res.json({
                message: 'No tags found in articles',
                totalArticleTags: 0,
                existingTags: 0,
                missingTags: 0,
                inserted: 0
            });
        }
        // Get all existing tags from Tags collection
        const existingTags = await Tag.find({}).lean();
        const existingCanonicalNames = new Set(existingTags.map(t => t.canonicalName || t.rawName?.toLowerCase() || ''));
        // Find missing tags
        const missingTags = [];
        for (const articleTag of articleTags) {
            const canonicalName = articleTag.toLowerCase();
            if (!existingCanonicalNames.has(canonicalName)) {
                missingTags.push(articleTag);
            }
        }
        // Insert missing tags as ACTIVE using shared service
        // This ensures consistency with tag creation pipeline
        let inserted = 0;
        let errors = 0;
        const insertedTags = [];
        // Use batch create/resolve for better performance
        const tagResults = await createOrResolveTags(missingTags, { status: 'active' });
        // Count newly created tags (tags that didn't exist before)
        // Since createOrResolveTag always returns a tag, we count all resolved tags as "inserted"
        // (they were either created or reactivated, both are valid sync operations)
        for (const [canonicalName, tag] of tagResults.entries()) {
            inserted++;
            insertedTags.push(tag.rawName || canonicalName);
        }
        // Handle any tags that failed to create
        const processedCanonicalNames = new Set(tagResults.keys());
        for (const tagName of missingTags) {
            const canonicalName = tagName.toLowerCase().trim();
            if (!processedCanonicalNames.has(canonicalName)) {
                errors++;
                requestLogger.warn({
                    msg: '[Tags] Tag failed to create/resolve during sync',
                    tagName,
                    canonicalName
                });
            }
        }
        requestLogger.info({
            msg: '[Tags] Article tags sync complete',
            totalArticleTags: articleTags.length,
            existingTags: existingTags.length,
            missingTags: missingTags.length,
            inserted,
            errors
        });
        await invalidateApiResponseCachePrefix(TAG_TAXONOMY_CACHE_NAMESPACE);
        res.json({
            message: 'Sync completed',
            totalArticleTags: articleTags.length,
            existingTags: existingTags.length,
            missingTags: missingTags.length,
            inserted,
            errors,
            insertedTags: insertedTags.slice(0, 50) // Limit response size
        });
    }
    catch (error) {
        const requestLogger = createRequestLogger(req.id || 'unknown', req?.user?.userId, req.path);
        requestLogger.error({
            msg: '[Tags] Sync article tags error',
            error: {
                message: error.message,
                stack: error.stack,
            },
        });
        captureException(error instanceof Error ? error : new Error(String(error)), { requestId: req.id, route: req.path });
        res.status(500).json({ message: 'Internal server error' });
    }
};
//# sourceMappingURL=tagsController.js.map