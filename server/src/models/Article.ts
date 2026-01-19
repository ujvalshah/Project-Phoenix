import mongoose, { Schema, Document } from 'mongoose';

// Media types matching frontend
export type MediaType = 'image' | 'video' | 'document' | 'link' | 'text' | 'youtube';

export interface INuggetMedia {
  type: MediaType;
  url: string;
  thumbnail_url?: string;
  aspect_ratio?: string;
  filename?: string;
  previewMetadata?: {
    url: string;
    finalUrl?: string;
    providerName?: string;
    siteName?: string;
    title?: string;
    description?: string;
    imageUrl?: string;
    faviconUrl?: string;
    authorName?: string;
    publishDate?: string;
    mediaType?: MediaType;
    // YouTube title persistence fields (backend as source of truth)
    titleSource?: string; // e.g., "youtube-oembed"
    titleFetchedAt?: string; // ISO timestamp
  };
  // Masonry layout visibility flag (optional for backward compatibility)
  // If true, this media item will appear as an individual tile in Masonry layout
  // Defaults: primary media → true, all other media → false
  // Backward compatibility: if missing, treat only primary media as selected
  showInMasonry?: boolean;
  // Masonry tile title (optional)
  // Displayed as hover caption at bottom of tile in Masonry layout
  // Max 80 characters, single-line, no markdown
  // Backward compatibility: if missing, no caption is shown
  masonryTitle?: string;
}

export interface IEngagement {
  bookmarks: number;
  shares: number;
  views: number;
}

export interface IDocument {
  title: string;
  url: string;
  type: 'pdf' | 'doc' | 'docx' | 'xls' | 'xlsx' | 'ppt' | 'pptx' | 'txt' | 'zip';
  size: string;
}

/**
 * External Link: Separate from media URLs
 * Used for the card's "Link" button - references to read more, not content sources.
 * Multiple links supported with one marked as primary.
 */
export interface IExternalLink {
  id: string;                 // Unique identifier
  url: string;                // The external URL
  label?: string;             // Optional display label (e.g., "Read on Bloomberg")
  isPrimary: boolean;         // Only one should be true - used for card "Link" button
  domain?: string;            // Extracted domain for display (e.g., "economist.com")
  favicon?: string;           // Favicon URL for visual
  addedAt?: string;           // ISO timestamp when added
}

/**
 * Layout Visibility: Control which views display this nugget
 * Allows selective visibility: show in Grid only, Masonry only, or all layouts.
 * Defaults to all true for backward compatibility.
 */
export interface ILayoutVisibility {
  grid: boolean;              // Standard grid layout
  masonry: boolean;           // Masonry gallery layout
  utility: boolean;           // Compact utility layout
  feed?: boolean;             // Feed layout (optional, defaults to grid visibility)
}

export interface IArticle extends Document {
  title?: string;
  excerpt?: string; // Short summary/description
  content: string;
  authorId: string;
  authorName: string;
  // CATEGORY PHASE-OUT: Removed category, categories, and categoryIds fields
  // Tags are now the only classification field
  publishedAt: string;
  tags: string[]; // Legacy: string array (Phase 1-2: dual-write, Phase 3: remove)
  tagIds?: mongoose.Types.ObjectId[]; // New: ObjectId references to Tag collection (Phase 1+)
  readTime?: number; // Estimated read time in minutes
  visibility?: 'public' | 'private'; // Default: public
  
  // Media fields (matching frontend Article interface)
  media?: INuggetMedia | null;
  // Primary and supporting media (computed fields, but can be explicitly stored)
  primaryMedia?: INuggetMedia | null;
  supportingMedia?: INuggetMedia[]; // Array of media items with masonry flags
  images?: string[]; // Legacy field
  video?: string; // Legacy field
  documents?: IDocument[]; // Legacy field
  themes?: string[];
  mediaIds?: string[]; // Cloudinary Media ObjectIds for tracking uploads
  
  // Engagement metrics
  engagement?: IEngagement;
  
  // System fields
  source_type?: string; // 'link' | 'video' | 'note' | 'idea' | etc
  created_at?: string;
  updated_at?: string;
  // Admin-only: Flag to indicate if createdAt was manually set
  isCustomCreatedAt?: boolean;

  // ════════════════════════════════════════════════════════════════════════════
  // NEW FIELDS: External Links, Layout Visibility, Display Image
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * External links for the card's "Link" button
   * Separate from media URLs - these are references, not content sources
   * One link should be marked as isPrimary for the card button
   */
  externalLinks?: IExternalLink[];

  /**
   * Layout visibility configuration
   * Controls which views/layouts this nugget appears in
   * Defaults to all true for backward compatibility
   */
  layoutVisibility?: ILayoutVisibility;

  /**
   * Index of the media item to display as card thumbnail
   * If not set, uses first media item (backward compatible)
   */
  displayImageIndex?: number;
}

const NuggetMediaSchema = new Schema<INuggetMedia>({
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
  // Masonry tile title (optional)
  masonryTitle: { type: String, required: false, maxlength: 80 }
}, { _id: false });

const EngagementSchema = new Schema<IEngagement>({
  bookmarks: { type: Number, default: 0 },
  shares: { type: Number, default: 0 },
  views: { type: Number, default: 0 }
}, { _id: false });

const DocumentSchema = new Schema<IDocument>({
  title: { type: String, required: true },
  url: { type: String, required: true },
  type: { type: String, required: true },
  size: { type: String, required: true }
}, { _id: false });

/**
 * External Link Schema
 * For card "Link" button - separate from media URLs
 */
const ExternalLinkSchema = new Schema<IExternalLink>({
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
const LayoutVisibilitySchema = new Schema<ILayoutVisibility>({
  grid: { type: Boolean, default: true },
  masonry: { type: Boolean, default: true },
  utility: { type: Boolean, default: true },
  feed: { type: Boolean, default: true }
}, { _id: false });

const ArticleSchema = new Schema<IArticle>({
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
  publishedAt: { type: String, required: true },
  tags: { type: [String], default: [] }, // Legacy: string array (Phase 1-2: dual-write, Phase 3: remove)
  tagIds: [{ type: Schema.Types.ObjectId, ref: 'Tag', index: true }], // New: ObjectId references
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
  displayImageIndex: { type: Number, required: false }
}, {
  timestamps: false // We manage our own timestamps
});

// Explicit indexes for performance
ArticleSchema.index({ authorId: 1 }); // Ownership queries
ArticleSchema.index({ publishedAt: -1 }); // List sorting (latest first)
ArticleSchema.index({ createdAt: -1 }); // List sorting (if using created_at)
ArticleSchema.index({ visibility: 1, publishedAt: -1 }); // Visibility filters with sorting
// CATEGORY PHASE-OUT: Removed category and categoryIds indexes
ArticleSchema.index({ tags: 1 }); // Tag filtering (legacy)
ArticleSchema.index({ tagIds: 1 }); // Tag filtering (new - Phase 1+)
ArticleSchema.index({ tagIds: 1, publishedAt: -1 }); // Compound index for tag-filtered feed queries
// Audit Phase-2 Fix: Add compound index for authorId + visibility (common privacy filtering pattern)
ArticleSchema.index({ authorId: 1, visibility: 1 }); // User's articles by visibility
// Audit Phase-2 Fix: Add index for media.url field (for YouTube cache lookup in AI controller)
ArticleSchema.index({ 'media.url': 1 });

/**
 * Content Truncation Detection Instrumentation
 * 
 * Logs suspicious content truncation when:
 * - Content field changes
 * - Previous value length > 20
 * - New value is exactly '...' or length <= 5
 */
async function logContentTruncation(
  articleId: string,
  oldContent: string,
  newContent: string,
  source_type?: string,
  mediaType?: string,
  context?: string
): Promise<void> {
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
  } catch (error) {
    // Fallback to console if logger not available
    console.error('[CONTENT_TRUNCATION_DETECTED] Failed to log truncation:', error);
    console.warn('[CONTENT_TRUNCATION_DETECTED]', {
      articleId,
      oldContentLength: oldContent.length,
      newContentLength: newContent.length,
      newContent,
      source_type,
      mediaType,
      context,
    });
  }
}

/**
 * Check if content truncation is suspicious
 */
function isSuspiciousTruncation(oldContent: string, newContent: string): boolean {
  if (!oldContent || !newContent) return false;
  
  const oldLength = oldContent.length;
  const newLength = newContent.length;
  
  // Must have old content > 20 chars
  if (oldLength <= 20) return false;
  
  // New content must be exactly '...' or length <= 5
  if (newContent === '...') return true;
  if (newLength <= 5) return true;
  
  return false;
}

// Pre-save hook: Detect content truncation on document.save()
// NOTE: Use async without next — in Mongoose async pre hooks, Kareem does not pass next;
// calling next() throws "next is not a function" in production (Mongoose 9 / Kareem 2).
ArticleSchema.pre('save', async function() {
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
      
      await logContentTruncation(
        articleId,
        oldContent,
        newContent,
        source_type,
        mediaType,
        'pre-save hook (document.save())'
      );
    }
  } catch (error) {
    // Don't block save if logging fails
    console.error('[Article Model] Error in pre-save content truncation check:', error);
  }
});

// Pre-updateOne hook: Detect content truncation on Model.updateOne()
// NOTE: Use async without next — same as pre('save'); calling next() throws in Mongoose 9.
ArticleSchema.pre('updateOne', async function() {
  const update = this.getUpdate() as any;
  
  // Check if content is being updated
  if (!update || (!update.$set?.content && !update.content)) {
    return;
  }
  
  const newContent = update.$set?.content || update.content || '';
  
  try {
    const query = this.getQuery();
    const Model = (this as any).model || mongoose.model('Article');
    const oldDoc = await Model.findOne(query).lean();
    
    if (!oldDoc) {
      return;
    }
    
    const oldContent = oldDoc.content || '';
    
    if (isSuspiciousTruncation(oldContent, newContent)) {
      const articleId = oldDoc._id.toString();
      const source_type = oldDoc.source_type;
      const mediaType = oldDoc.media?.type;
      
      await logContentTruncation(
        articleId,
        oldContent,
        newContent,
        source_type,
        mediaType,
        'pre-updateOne hook (Model.updateOne())'
      );
    }
  } catch (error) {
    console.error('[Article Model] Error in pre-updateOne content truncation check:', error);
  }
});

// Pre-findOneAndUpdate hook: Detect content truncation on Model.findOneAndUpdate()
// NOTE: Use async without next — same as pre('save'); calling next() throws in Mongoose 9.
ArticleSchema.pre('findOneAndUpdate', async function() {
  const update = this.getUpdate() as any;
  
  // Check if content is being updated
  if (!update || (!update.$set?.content && !update.content)) {
    return;
  }
  
  const newContent = update.$set?.content || update.content || '';
  
  try {
    const query = this.getQuery();
    const Model = (this as any).model || mongoose.model('Article');
    const oldDoc = await Model.findOne(query).lean();
    
    if (!oldDoc) {
      return;
    }
    
    const oldContent = oldDoc.content || '';
    
    if (isSuspiciousTruncation(oldContent, newContent)) {
      const articleId = oldDoc._id.toString();
      const source_type = oldDoc.source_type;
      const mediaType = oldDoc.media?.type;
      
      await logContentTruncation(
        articleId,
        oldContent,
        newContent,
        source_type,
        mediaType,
        'pre-findOneAndUpdate hook (Model.findOneAndUpdate())'
      );
    }
  } catch (error) {
    console.error('[Article Model] Error in pre-findOneAndUpdate content truncation check:', error);
  }
});

export const Article = mongoose.model<IArticle>('Article', ArticleSchema);


