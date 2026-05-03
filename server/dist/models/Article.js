import mongoose, { Schema } from 'mongoose';
const NuggetMediaSchema = new Schema({
    type: { type: String, required: true },
    url: { type: String, required: true },
    thumbnail_url: { type: String },
    aspect_ratio: { type: String },
    filename: { type: String },
    previewMetadata: {
        type: {
            url: String,
            finalUrl: String,
            providerName: String,
            siteName: String,
            title: String,
            description: String,
            imageUrl: String,
            faviconUrl: String,
            authorName: String,
            publishDate: String,
            mediaType: String,
            // YouTube title persistence fields
            titleSource: String,
            titleFetchedAt: String
        },
        required: false
    },
    // Masonry layout visibility flag (optional for backward compatibility)
    showInMasonry: { type: Boolean, required: false },
    showInGrid: { type: Boolean, required: false },
    // Masonry tile title (optional)
    masonryTitle: { type: String, required: false, maxlength: 80 },
    position: { type: Number, required: false },
    order: { type: Number, required: false }
}, { _id: false });
const EngagementSchema = new Schema({
    bookmarks: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
    views: { type: Number, default: 0 }
}, { _id: false });
const DocumentSchema = new Schema({
    title: { type: String, required: true },
    url: { type: String, required: true },
    type: { type: String, required: true },
    size: { type: String, required: true }
}, { _id: false });
/**
 * External Link Schema
 * For card "Link" button - separate from media URLs
 */
const ExternalLinkSchema = new Schema({
    id: { type: String, required: true },
    url: { type: String, required: true },
    label: { type: String, required: false },
    isPrimary: { type: Boolean, required: true, default: false },
    domain: { type: String, required: false },
    favicon: { type: String, required: false },
    addedAt: { type: String, required: false }
}, { _id: false });
/**
 * Layout Visibility Schema
 * Controls which layouts display this nugget
 */
const LayoutVisibilitySchema = new Schema({
    grid: { type: Boolean, default: true },
    masonry: { type: Boolean, default: true },
    utility: { type: Boolean, default: true },
    feed: { type: Boolean, default: true }
}, { _id: false });
const ArticleSchema = new Schema({
    title: { type: String, required: false },
    excerpt: { type: String }, // Optional excerpt
    content: { type: String, default: '' }, // Optional - validation handled by Zod schema
    authorId: { type: String, required: true },
    authorName: { type: String, required: true },
    // CATEGORY PHASE-OUT: Removed category and categories fields
    // Tags are now the only classification field
    // DEPRECATED: categoryIds may exist in DB for backward compatibility (read-only)
    // This field is NOT validated, NOT saved on create/update, and NOT exposed in API responses
    // categoryIds: { type: [String] }, // Deprecated - kept in DB schema only for backward compatibility
    publishedAt: { type: String, required: false, default: null },
    status: { type: String, enum: ['draft', 'published'], default: 'published' },
    // Indexes: explicit `ArticleSchema.index({ tagIds: 1 })` below (avoid duplicate with `index: true` here).
    tagIds: [{ type: Schema.Types.ObjectId, ref: 'Tag' }],
    readTime: { type: Number }, // Optional read time
    visibility: { type: String, enum: ['public', 'private'], default: 'public' },
    // Media fields
    media: { type: NuggetMediaSchema, default: null },
    // Primary and supporting media (computed fields, but can be explicitly stored)
    primaryMedia: { type: NuggetMediaSchema, required: false },
    supportingMedia: { type: [NuggetMediaSchema], default: [] },
    images: { type: [String], default: [] }, // Legacy
    video: { type: String }, // Legacy
    documents: { type: [DocumentSchema], default: [] }, // Legacy
    themes: { type: [String], default: [] },
    mediaIds: { type: [String], default: [] }, // Cloudinary Media ObjectIds
    readBy: { type: Map, of: Boolean, default: {} },
    // Engagement
    engagement: { type: EngagementSchema },
    // System
    source_type: { type: String },
    created_at: { type: String },
    updated_at: { type: String },
    // Admin-only: Flag to indicate if createdAt was manually set
    isCustomCreatedAt: { type: Boolean, default: false },
    // ════════════════════════════════════════════════════════════════════════════
    // NEW FIELDS: External Links, Layout Visibility, Display Image
    // ════════════════════════════════════════════════════════════════════════════
    // External links for card "Link" button (separate from media URLs)
    externalLinks: { type: [ExternalLinkSchema], default: [] },
    // Layout visibility (defaults to all true for backward compatibility)
    layoutVisibility: { type: LayoutVisibilitySchema, required: false },
    // Display image index (which media item shows as card thumbnail)
    displayImageIndex: { type: Number, required: false },
    // Disclaimer fields
    showDisclaimer: { type: Boolean, required: false },
    disclaimerText: { type: String, required: false, maxlength: 500 },
    // Content stream routing (standard feed vs Market Pulse)
    contentStream: { type: String, enum: ['standard', 'pulse', 'both'], default: 'standard' }
}, {
    timestamps: false // We manage our own timestamps
});
// Explicit indexes for performance
ArticleSchema.index({ authorId: 1 }); // Ownership queries
ArticleSchema.index({ publishedAt: -1 }); // List sorting (latest first)
ArticleSchema.index({ status: 1, publishedAt: -1 }); // Published feed and draft listing
ArticleSchema.index({ createdAt: -1 }); // List sorting (if using created_at)
ArticleSchema.index({ visibility: 1, status: 1, publishedAt: -1 }); // Visibility/status filters with sorting
// CATEGORY PHASE-OUT: Removed category and categoryIds indexes
ArticleSchema.index({ tagIds: 1 });
ArticleSchema.index({ tagIds: 1, publishedAt: -1 }); // Compound index for tag-filtered feed queries
// Audit Phase-2 Fix: Add compound index for authorId + visibility (common privacy filtering pattern)
ArticleSchema.index({ authorId: 1, visibility: 1 }); // User's articles by visibility
ArticleSchema.index({ authorId: 1, status: 1 }); // User's drafts vs published
// Audit Phase-2 Fix: Add index for media.url field (for YouTube cache lookup in AI controller)
ArticleSchema.index({ 'media.url': 1 });
// Content stream + date compound index for feed routing queries
ArticleSchema.index({ contentStream: 1, publishedAt: -1 });
// Text index for full-text search on title, excerpt, and content (weighted: title > excerpt > content)
ArticleSchema.index({ title: 'text', excerpt: 'text', content: 'text' }, { weights: { title: 10, excerpt: 5, content: 1 }, name: 'article_text_search', background: true });
/**
 * Content Truncation Detection Instrumentation
 *
 * Logs suspicious content truncation when:
 * - Content field changes
 * - Previous value length > 20
 * - New value is exactly '...' or length <= 5
 */
async function logContentTruncation(articleId, oldContent, newContent, source_type, mediaType, context) {
    try {
        const { getLogger } = await import('../utils/logger.js');
        const logger = getLogger();
        // Capture stack trace
        const stackTrace = new Error().stack || 'No stack trace available';
        logger.warn({
            msg: '[CONTENT_TRUNCATION_DETECTED] Suspicious content truncation detected',
            articleId,
            updatedAt: new Date().toISOString(),
            source_type: source_type || 'unknown',
            mediaType: mediaType || 'unknown',
            oldContentLength: oldContent.length,
            newContentLength: newContent.length,
            newContent: newContent,
            oldContentPreview: oldContent.substring(0, 100) + (oldContent.length > 100 ? '...' : ''),
            context: context || 'unknown',
            stackTrace: stackTrace.split('\n').slice(2, 10).join('\n'), // First 8 lines of stack (skip Error and logContentTruncation)
        });
    }
    catch (error) {
        // Best effort only; avoid noisy fallback logging in model hooks.
        void error;
    }
}
/**
 * Check if content truncation is suspicious
 */
function isSuspiciousTruncation(oldContent, newContent) {
    if (!oldContent || !newContent)
        return false;
    const oldLength = oldContent.length;
    const newLength = newContent.length;
    // Must have old content > 20 chars
    if (oldLength <= 20)
        return false;
    // New content must be exactly '...' or length <= 5
    if (newContent === '...')
        return true;
    if (newLength <= 5)
        return true;
    return false;
}
// Pre-save hook: Detect content truncation on document.save()
// NOTE: Use async without next — in Mongoose async pre hooks, Kareem does not pass next;
// calling next() throws "next is not a function" in production (Mongoose 9 / Kareem 2).
ArticleSchema.pre('save', async function () {
    // Only check on updates (not new documents)
    if (this.isNew) {
        return;
    }
    // Only check if content is modified
    if (!this.isModified('content')) {
        return;
    }
    try {
        // Get old document from database
        const oldDoc = await this.constructor.findById(this._id).lean();
        if (!oldDoc) {
            return; // Document doesn't exist, skip check
        }
        const oldContent = oldDoc.content || '';
        const newContent = this.get('content') || '';
        if (isSuspiciousTruncation(oldContent, newContent)) {
            const articleId = this._id.toString();
            const source_type = oldDoc.source_type;
            const mediaType = oldDoc.media?.type;
            await logContentTruncation(articleId, oldContent, newContent, source_type, mediaType, 'pre-save hook (document.save())');
        }
    }
    catch (error) {
        try {
            const { getLogger } = await import('../utils/logger.js');
            getLogger().error({ err: error }, '[Article Model] Error in pre-save content truncation check');
        }
        catch {
            // Best effort logging only.
        }
    }
});
// Pre-updateOne hook: Detect content truncation on Model.updateOne()
// NOTE: Use async without next — same as pre('save'); calling next() throws in Mongoose 9.
ArticleSchema.pre('updateOne', async function () {
    const update = this.getUpdate();
    // Check if content is being updated
    if (!update || (!update.$set?.content && !update.content)) {
        return;
    }
    const newContent = update.$set?.content || update.content || '';
    try {
        const query = this.getQuery();
        const Model = this.model || mongoose.model('Article');
        const oldDoc = await Model.findOne(query).lean();
        if (!oldDoc) {
            return;
        }
        const oldContent = oldDoc.content || '';
        if (isSuspiciousTruncation(oldContent, newContent)) {
            const articleId = oldDoc._id.toString();
            const source_type = oldDoc.source_type;
            const mediaType = oldDoc.media?.type;
            await logContentTruncation(articleId, oldContent, newContent, source_type, mediaType, 'pre-updateOne hook (Model.updateOne())');
        }
    }
    catch (error) {
        try {
            const { getLogger } = await import('../utils/logger.js');
            getLogger().error({ err: error }, '[Article Model] Error in pre-updateOne content truncation check');
        }
        catch {
            // Best effort logging only.
        }
    }
});
// Pre-findOneAndUpdate hook: Detect content truncation on Model.findOneAndUpdate()
// NOTE: Use async without next — same as pre('save'); calling next() throws in Mongoose 9.
ArticleSchema.pre('findOneAndUpdate', async function () {
    const update = this.getUpdate();
    // Check if content is being updated
    if (!update || (!update.$set?.content && !update.content)) {
        return;
    }
    const newContent = update.$set?.content || update.content || '';
    try {
        const query = this.getQuery();
        const Model = this.model || mongoose.model('Article');
        const oldDoc = await Model.findOne(query).lean();
        if (!oldDoc) {
            return;
        }
        const oldContent = oldDoc.content || '';
        if (isSuspiciousTruncation(oldContent, newContent)) {
            const articleId = oldDoc._id.toString();
            const source_type = oldDoc.source_type;
            const mediaType = oldDoc.media?.type;
            await logContentTruncation(articleId, oldContent, newContent, source_type, mediaType, 'pre-findOneAndUpdate hook (Model.findOneAndUpdate())');
        }
    }
    catch (error) {
        try {
            const { getLogger } = await import('../utils/logger.js');
            getLogger().error({ err: error }, '[Article Model] Error in pre-findOneAndUpdate content truncation check');
        }
        catch {
            // Best effort logging only.
        }
    }
});
// Track pre-save lifecycle fields to detect publish transition exactly once.
ArticleSchema.pre('save', async function () {
    this.$locals ||= {};
    this.$locals.wasNew = this.isNew;
    if (this.isNew) {
        this.$locals.previousVisibility = undefined;
        this.$locals.previousStatus = undefined;
        return;
    }
    try {
        const oldDoc = await this.constructor.findById(this._id).select('visibility status').lean();
        this.$locals.previousVisibility = oldDoc?.visibility;
        this.$locals.previousStatus = oldDoc?.status;
    }
    catch {
        this.$locals.previousVisibility = undefined;
        this.$locals.previousStatus = undefined;
    }
});
// Helper: fire fan-out after a detected public transition. Best-effort; the
// notification service import is lazy so model loads can't cycle on startup.
function dispatchArticlePublished(articleId, publishEventId) {
    import('../services/notificationService.js')
        .then(({ onArticlePublished }) => {
        onArticlePublished(articleId, publishEventId).catch(async (err) => {
            const { getLogger } = await import('../utils/logger.js');
            getLogger().error({ err, articleId }, '[Notifications] post-publish dispatch failed');
        });
    })
        .catch(() => {
        // Notification service not available — silently skip
    });
}
function isPublishedStatus(status) {
    // Backward compatibility: missing status in legacy rows behaves as published.
    return status === 'published' || status === undefined || status === null;
}
// Post-save hook: trigger notifications only when a nugget becomes public + published.
ArticleSchema.post('save', function (doc) {
    const locals = doc.$locals || {};
    const wasNew = locals.wasNew === true;
    const previousVisibility = locals.previousVisibility;
    const previousStatus = locals.previousStatus;
    const isPublicNow = doc.visibility === 'public';
    const isPublishedNow = isPublishedStatus(doc.status);
    const becamePublic = previousVisibility === 'private' && isPublicNow;
    const becamePublished = previousStatus === 'draft' && isPublishedNow;
    const createdPublic = wasNew && isPublicNow && isPublishedNow;
    const visibilityAndStatusTransition = !wasNew && isPublicNow && isPublishedNow && (becamePublic || becamePublished);
    if (!createdPublic && !visibilityAndStatusTransition) {
        return;
    }
    dispatchArticlePublished(doc._id.toString(), Date.now());
});
// findOneAndUpdate / findByIdAndUpdate path — the admin & author edit flows
// use this, NOT .save(), so without a hook here visibility/status publish
// transitions would silently ship the article without notifying anyone. Snapshot
// current lifecycle fields in
// the query options so the post hook can compare without a second round-trip.
ArticleSchema.pre('findOneAndUpdate', async function () {
    const update = this.getUpdate();
    if (!update)
        return;
    // Extract the proposed visibility (supports both shorthand and $set form).
    const setPart = update.$set || {};
    const hasVisibilityField = Object.prototype.hasOwnProperty.call(setPart, 'visibility') ||
        Object.prototype.hasOwnProperty.call(update, 'visibility');
    const hasStatusField = Object.prototype.hasOwnProperty.call(setPart, 'status') ||
        Object.prototype.hasOwnProperty.call(update, 'status');
    if (!hasVisibilityField && !hasStatusField) {
        // No lifecycle change in this update — nothing to notify about.
        this._notifyVisibilityState = null;
        return;
    }
    try {
        const query = this.getQuery();
        const Model = this.model
            || mongoose.model('Article');
        const oldDoc = await Model.findOne(query).select('_id visibility status').lean();
        this._notifyVisibilityState = oldDoc
            ? { id: String(oldDoc._id), previousVisibility: oldDoc.visibility, previousStatus: oldDoc.status }
            : null;
    }
    catch {
        this._notifyVisibilityState = null;
    }
});
ArticleSchema.post('findOneAndUpdate', function (doc) {
    if (!doc)
        return;
    const state = this
        ._notifyVisibilityState;
    if (!state)
        return;
    const becamePublic = state.previousVisibility === 'private' && doc.visibility === 'public';
    const becamePublished = state.previousStatus === 'draft' && isPublishedStatus(doc.status);
    const isPublicPublishedNow = doc.visibility === 'public' && isPublishedStatus(doc.status);
    if (!isPublicPublishedNow)
        return;
    if (!becamePublic && !becamePublished)
        return;
    dispatchArticlePublished(state.id, Date.now());
});
export const Article = mongoose.model('Article', ArticleSchema);
//# sourceMappingURL=Article.js.map