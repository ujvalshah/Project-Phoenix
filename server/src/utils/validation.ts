import { z } from 'zod';

/**
 * Validation schemas for request bodies
 */

// Schema for previewMetadata (nested object)
const previewMetadataSchema = z.object({
  url: z.string().optional(),
  finalUrl: z.string().optional(),
  providerName: z.string().optional(),
  siteName: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  faviconUrl: z.string().optional(),
  authorName: z.string().optional(),
  publishDate: z.string().optional(),
  mediaType: z.string().optional(),
  // YouTube title persistence fields
  titleSource: z.string().optional(), // e.g., "youtube-oembed"
  titleFetchedAt: z.string().optional(), // ISO timestamp
}).optional();

// Schema for media object (all fields optional for partial updates)
const mediaSchema = z.object({
  type: z.string().optional(),
  url: z.string().optional(),
  thumbnail_url: z.string().optional(),
  aspect_ratio: z.string().optional(),
  filename: z.string().optional(),
  previewMetadata: previewMetadataSchema,
  // Masonry layout visibility flag (optional for backward compatibility)
  showInMasonry: z.boolean().optional(),
  // Masonry tile title (optional, max 80 characters, single-line)
  masonryTitle: z.string().max(80, 'Masonry title must be 80 characters or less').optional(),
  // Metadata override flag: true when user explicitly edits caption/title
  // This allows intentional overrides of YouTube titles and other metadata
  allowMetadataOverride: z.boolean().optional(),
}).optional().nullable();

// Schema for primary media (same structure as media but separate field)
const primaryMediaSchema = mediaSchema;

// Schema for supporting media item (array of media objects with masonry flags)
const supportingMediaItemSchema = z.object({
  type: z.string().optional(),
  url: z.string().optional(),
  thumbnail: z.string().optional(),
  thumbnail_url: z.string().optional(),
  aspect_ratio: z.string().optional(),
  filename: z.string().optional(),
  title: z.string().optional(),
  previewMetadata: previewMetadataSchema,
  // Masonry layout visibility flag (optional for backward compatibility)
  showInMasonry: z.boolean().optional(),
  // Masonry tile title (optional, max 80 characters, single-line)
  masonryTitle: z.string().max(80, 'Masonry title must be 80 characters or less').optional(),
});

// Coerce null/undefined to empty array for supportingMedia
// Use preprocess to handle null/undefined before validation
const supportingMediaSchema = z.preprocess(
  (val) => Array.isArray(val) ? val : [],
  z.array(supportingMediaItemSchema)
).optional();

// Schema for document object
// Coerce null/undefined to empty array
const documentSchema = z.preprocess(
  (val) => Array.isArray(val) ? val : [],
  z.object({
    title: z.string(),
    url: z.string(),
    type: z.string(),
    size: z.string(),
  }).array()
).optional();

// ════════════════════════════════════════════════════════════════════════════
// NEW SCHEMAS: External Links, Layout Visibility
// ════════════════════════════════════════════════════════════════════════════

/**
 * Schema for external link
 * For card "Link" button - separate from media URLs
 */
const externalLinkSchema = z.object({
  id: z.string(),
  url: z.string().url('Invalid URL format'),
  label: z.string().max(100, 'Label too long').optional(),
  isPrimary: z.boolean().default(false),
  domain: z.string().optional(),
  favicon: z.string().optional(),
  addedAt: z.string().optional(),
});

/**
 * Schema for external links array
 * Coerce null/undefined to empty array
 */
const externalLinksSchema = z.preprocess(
  (val) => Array.isArray(val) ? val : [],
  z.array(externalLinkSchema)
).optional();

/**
 * Schema for layout visibility
 * Controls which layouts display this nugget
 */
const layoutVisibilitySchema = z.object({
  grid: z.boolean().default(true),
  masonry: z.boolean().default(true),
  utility: z.boolean().default(true),
  feed: z.boolean().default(true).optional(),
}).optional();

// Base schema for article creation/updates (without refinement)
const baseArticleSchema = z.object({
  title: z.string().max(200, 'Title too long').optional(),
  excerpt: z.string().optional(),
  // Content is optional - only required if there's no media, images, or documents
  // This allows users to create nuggets with just URLs/images
  content: z.string().default(''),
  authorId: z.string().min(1, 'Author ID is required'),
  authorName: z.string().min(1, 'Author name is required'),
  // CATEGORY PHASE-OUT: Removed category, categories, and categoryIds validation
  // Tags are now the only classification field
  publishedAt: z.string().optional(),
  // Coerce null/undefined to empty array for tags (defensive coding)
  // Use preprocess to handle null/undefined before validation, then default to []
  tags: z.preprocess(
    (val) => Array.isArray(val) ? val : [],
    z.array(z.string())
  ).default([]),
  readTime: z.number().optional(),
  visibility: z.enum(['public', 'private']).default('public'),
  // Media and attachment fields
  media: mediaSchema,
  // Primary and supporting media (computed fields, but can be explicitly set)
  primaryMedia: primaryMediaSchema,
  supportingMedia: supportingMediaSchema,
  // Coerce null/undefined to empty array for images (defensive coding)
  images: z.preprocess(
    (val) => Array.isArray(val) ? val : [],
    z.array(z.string())
  ).optional(),
  documents: documentSchema,
  source_type: z.string().optional(),
  // Cloudinary media tracking (array of MongoDB Media ObjectIds)
  // Coerce null/undefined to empty array for mediaIds (defensive coding)
  mediaIds: z.preprocess(
    (val) => Array.isArray(val) ? val : [],
    z.array(z.string())
  ).optional(),
  // Legacy fields
  video: z.string().optional(),
  // Coerce null/undefined to empty array for themes (defensive coding)
  themes: z.preprocess(
    (val) => Array.isArray(val) ? val : [],
    z.array(z.string())
  ).optional(),
  // Display author (for aliases)
  displayAuthor: z.object({
    name: z.string(),
    avatarUrl: z.string().optional(),
  }).optional(),
  // Admin-only: Custom creation date (optional ISO string)
  customCreatedAt: z.string().refine(
    (val) => {
      if (!val) return true; // Optional field
      const date = new Date(val);
      return !isNaN(date.getTime());
    },
    { message: 'Invalid date format' }
  ).optional(),

  // ════════════════════════════════════════════════════════════════════════════
  // NEW FIELDS: External Links, Layout Visibility, Display Image Index
  // ════════════════════════════════════════════════════════════════════════════

  // External links for card "Link" button (separate from media URLs)
  externalLinks: externalLinksSchema,

  // Layout visibility (defaults to all true for backward compatibility)
  layoutVisibility: layoutVisibilitySchema,

  // Display image index (which media item shows as card thumbnail)
  displayImageIndex: z.number().int().min(0).optional(),
});

// Create schema with refinement: at least one of content/media/images/documents must be present
// AND at least one tag must be present (tags are mandatory)
// Use .strict() to reject unknown fields
export const createArticleSchema = baseArticleSchema.strict().refine(
  (data) => {
    // At least one of: content, media, images, or documents must be present
    const hasContent = data.content && data.content.trim().length > 0;
    const hasMedia = data.media !== null && data.media !== undefined;
    const hasImages = data.images && data.images.length > 0;
    const hasDocuments = data.documents && data.documents.length > 0;
    
    return hasContent || hasMedia || hasImages || hasDocuments;
  },
  {
    message: 'Please provide content, a URL, images, or documents',
    path: ['content'], // Error will appear on content field
  }
).refine(
  (data) => {
    // Tags are mandatory - at least one tag must be present
    const tags = data.tags || [];
    return tags.length > 0 && tags.every(tag => typeof tag === 'string' && tag.trim().length > 0);
  },
  {
    message: 'At least one tag is required',
    path: ['tags'], // Error will appear on tags field
  }
);

export const updateArticleSchema = baseArticleSchema.partial().strict();

export const createCollectionSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  // creatorId is optional - backend uses authenticated user ID (security: prevents spoofing)
  creatorId: z.string().optional(),
  type: z.enum(['private', 'public']).default('public')
}).strict();

// FOLLOW-UP REFACTOR: Explicitly exclude creatorId from updates (P1-19)
// Prevents ownership transfer via update - creatorId cannot be changed
// Use .omit() to explicitly exclude fields that should never be updated
export const updateCollectionSchema = createCollectionSchema.partial().strict().omit({ creatorId: true });

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(['admin', 'user']).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  preferences: z.object({
    interestedCategories: z.array(z.string())
  }).optional(),
  lastFeedVisit: z.string().optional(),
  profile: z.object({
    displayName: z.string().optional(),
    avatarUrl: z.string().optional(),
    bio: z.string().optional(),
    location: z.string().optional(),
    website: z.string().optional(),
    username: z.string().optional(),
    phoneNumber: z.string().optional(),
    avatarColor: z.string().optional(),
    pincode: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    gender: z.string().optional(),
    dateOfBirth: z.string().optional(),
    title: z.string().optional(),
    company: z.string().optional(),
    twitter: z.string().optional(),
    linkedin: z.string().optional(),
  }).optional(),
  // Allow legacy flat fields for backward compatibility
  bio: z.string().optional(),
  location: z.string().optional(),
  website: z.string().optional(),
  avatarUrl: z.string().optional(),
  title: z.string().optional(),
  company: z.string().optional(),
  twitter: z.string().optional(),
  linkedin: z.string().optional(),
}).strict();

export const addEntrySchema = z.object({
  articleId: z.string().min(1, 'Article ID is required'),
  // userId is optional - backend uses authenticated user ID (security: prevents spoofing)
  userId: z.string().optional()
}).strict();

export const flagEntrySchema = z.object({
  // userId is optional - backend uses authenticated user ID (security: prevents spoofing)
  userId: z.string().optional()
}).strict();

/**
 * Central logging helper for categoryIds deprecation
 * Logs when categoryIds is detected in incoming requests
 */
export function logCategoryIdsDeprecation(
  requestId: string | undefined,
  userId: string | undefined,
  route: string,
  categoryIds: any
): void {
  const { getLogger } = require('./logger.js');
  const logger = getLogger();
  logger.warn({
    msg: '[CATEGORY_IDS] Ignored legacy field in request',
    requestId: requestId || 'unknown',
    userId,
    route,
    categoryIds: Array.isArray(categoryIds) ? categoryIds : undefined,
    categoryIdsType: typeof categoryIds,
  });
}

/**
 * Preprocess request body to remove deprecated categoryIds field
 * This ensures categoryIds is stripped before validation (since schemas use .strict())
 */
export function preprocessArticleRequest(
  body: any,
  requestId: string | undefined,
  userId: string | undefined,
  route: string
): any {
  if (body && 'categoryIds' in body) {
    logCategoryIdsDeprecation(requestId, userId, route, body.categoryIds);
    const { categoryIds, ...rest } = body;
    return rest;
  }
  return body;
}

/**
 * Validation middleware factory
 */
export function validate(schema: z.ZodSchema) {
  return (req: any, res: any, next: any) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: result.error.errors
      });
    }
    req.body = result.data;
    next();
  };
}

