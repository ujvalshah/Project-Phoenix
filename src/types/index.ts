import type { AuthProvider } from './auth';

// --- Domain Models ---

export interface Document {
  title: string;
  url: string;
  type: 'pdf' | 'doc' | 'docx' | 'xls' | 'xlsx' | 'ppt' | 'pptx' | 'txt' | 'zip';
  size: string;
}

export type MediaType = 'image' | 'video' | 'document' | 'link' | 'text' | 'youtube';

export interface PreviewMetadata {
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
}

export interface NuggetMedia {
  type: MediaType;
  url: string;
  thumbnail_url?: string;
  aspect_ratio?: string;
  filename?: string;
  previewMetadata?: PreviewMetadata;
  // Masonry layout visibility flag
  // If true, this media item will appear as an individual tile in Masonry layout
  // Defaults: primary media → true, all other media → false
  // Backward compatibility: if missing, treat only primary media as selected
  showInMasonry?: boolean;
  // Masonry tile title (optional)
  // Displayed as hover caption at bottom of tile in Masonry layout
  // Max 80 characters, single-line, no markdown
  // Backward compatibility: if missing, no caption is shown
  masonryTitle?: string;
  // Flag to allow metadata override (e.g., YouTube title override)
  // Set to true when user explicitly edits caption/title in edit mode
  allowMetadataOverride?: boolean;
}

export interface Engagement {
  bookmarks: number;
  shares: number;
  views: number;
}

export interface Contributor {
  userId: string;
  name: string;
  username?: string;
  avatarUrl?: string;
  addedAt?: string;
}

export interface DisplayAuthor {
  name: string;
  avatarUrl?: string;
}

/**
 * Tag interface for Phase 2 implementation
 * Tags have stable IDs that don't change when renamed
 */
export interface Tag {
  id: string; // MongoDB ObjectId
  rawName: string; // Display name (user-entered casing)
  canonicalName: string; // Normalized lowercase for matching
  usageCount: number;
  type: 'category' | 'tag';
  status: 'active' | 'pending' | 'deprecated';
  isOfficial: boolean;
}

/**
 * ============================================================================
 * MEDIA CLASSIFICATION: PRIMARY vs SUPPORTING
 * ============================================================================
 * 
 * PRIMARY MEDIA:
 * - Exactly ONE primary media item per nugget (or none)
 * - Determines thumbnail representation in cards
 * - Priority: YouTube > Image > Document
 * - Explicitly selected OR inferred once and stored
 * 
 * SUPPORTING MEDIA:
 * - Zero or more additional media items
 * - Rendered in drawer only, never in cards
 * - Includes: additional images, videos, documents
 * - Never influences thumbnail or card layout
 * 
 * DETERMINISTIC THUMBNAIL LOGIC:
 * - IF primaryMedia.type === "youtube" → use YouTube thumbnail
 * - ELSE IF primaryMedia.type === "image" → use that image
 * - ELSE → use system fallback
 */

export interface PrimaryMedia {
  type: MediaType;
  url: string;
  thumbnail?: string; // Cached thumbnail URL (YouTube thumbnail or image URL)
  aspect_ratio?: string;
  previewMetadata?: PreviewMetadata;
  // Masonry layout visibility flag
  // Primary media always shows in Masonry (defaults to true, cannot be deselected)
  // Backward compatibility: if missing, treat as true (primary media always visible)
  showInMasonry?: boolean;
  // Masonry tile title (optional)
  // Displayed as hover caption at bottom of tile in Masonry layout
  // Max 80 characters, single-line, no markdown
  // Backward compatibility: if missing, no caption is shown
  masonryTitle?: string;
}

export interface SupportingMediaItem {
  type: MediaType;
  url: string;
  thumbnail?: string;
  filename?: string;
  title?: string;
  previewMetadata?: PreviewMetadata;
  // Masonry layout visibility flag
  // If true, this supporting media item will appear as an individual tile in Masonry layout
  // Defaults to false (only primary media shows by default)
  // Backward compatibility: if missing, treat as false (not shown in Masonry)
  showInMasonry?: boolean;
  // Masonry tile title (optional)
  // Displayed as hover caption at bottom of tile in Masonry layout
  // Max 80 characters, single-line, no markdown
  // Backward compatibility: if missing, no caption is shown
  masonryTitle?: string;
  // V2: Explicit order for carousel display
  // If missing, use array index as order
  // Backward compatibility: if missing, treat as array index
  order?: number;
}

/**
 * ============================================================================
 * EXTERNAL LINK: Separate from media URLs
 * ============================================================================
 * External links are for the card's "Link" button - references to read more,
 * NOT content sources. Multiple links supported with one marked as primary.
 */
export interface ExternalLink {
  id: string;                 // Unique identifier
  url: string;                // The external URL
  label?: string;             // Optional display label (e.g., "Read on Bloomberg")
  isPrimary: boolean;         // Only one should be true - used for card "Link" button
  domain?: string;            // Extracted domain for display (e.g., "economist.com")
  favicon?: string;           // Favicon URL for visual
  addedAt?: string;           // ISO timestamp when added
}

/**
 * ============================================================================
 * LAYOUT VISIBILITY: Control which views display this nugget
 * ============================================================================
 * Allows selective visibility: show in Grid only, Masonry only, or all layouts.
 * Defaults to all true for backward compatibility.
 */
export interface LayoutVisibility {
  grid: boolean;              // Standard grid layout
  masonry: boolean;           // Masonry gallery layout (requires media with showInMasonry)
  utility: boolean;           // Compact utility layout
  feed?: boolean;             // Feed layout (optional, defaults to grid visibility)
}

/**
 * Default layout visibility for new nuggets
 * All layouts enabled by default
 */
export const DEFAULT_LAYOUT_VISIBILITY: LayoutVisibility = {
  grid: true,
  masonry: true,
  utility: true,
  feed: true,
};

export interface Article {
  id: string;
  title?: string;
  excerpt: string;
  content: string;
  author: {
    id: string;
    name: string;
    avatar_url?: string;
  };
  // New field for masking the real author
  displayAuthor?: DisplayAuthor;
  
  publishedAt: string; // ISO date string
  // CATEGORY PHASE-OUT: Removed categories and categoryIds fields - tags are now the only classification field
  tags: string[];
  readTime: number; 
  visibility?: 'public' | 'private';
  
  // ============================================================================
  // MEDIA FIELDS (NEW ARCHITECTURE)
  // ============================================================================
  
  // Primary media - exactly one (or null)
  // This is the SOURCE OF TRUTH for thumbnail and card representation
  primaryMedia?: PrimaryMedia | null;
  
  // Supporting media - zero or more
  // Rendered only in drawer, never in cards or inline expansion
  supportingMedia?: SupportingMediaItem[];
  
  // ============================================================================
  // LEGACY MEDIA FIELDS (BACKWARDS COMPATIBILITY)
  // ============================================================================
  // These fields are maintained for backwards compatibility
  // New code should use primaryMedia/supportingMedia
  
  media?: NuggetMedia | null;
  // Media IDs array - explicit references to MongoDB Media documents
  // CRITICAL: Never parse media IDs from content text. Media references are explicit.
  mediaIds?: string[]; // Array of MongoDB Media document IDs (ObjectId as strings)
  // Legacy fields
  images?: string[]; 
  video?: string; 
  documents?: Document[]; 
  themes?: string[]; 

  // System
  created_at?: string;
  updated_at?: string;
  engagement?: Engagement;
  source_type?: string; // 'link' | 'video' | 'note' | 'idea' | etc

  // Admin-only: Custom creation date
  customCreatedAt?: string | null;
  isCustomCreatedAt?: boolean;

  // ============================================================================
  // EXTERNAL LINKS (NEW - Separated from media URLs)
  // ============================================================================
  // External links for the card's "Link" button
  // Separate from media URLs - these are references, not content sources
  // One link should be marked as isPrimary for the card button
  externalLinks?: ExternalLink[];

  // ============================================================================
  // LAYOUT VISIBILITY (NEW)
  // ============================================================================
  // Controls which views/layouts this nugget appears in
  // Defaults to all true for backward compatibility
  layoutVisibility?: LayoutVisibility;

  // ============================================================================
  // DISPLAY IMAGE SELECTION (NEW)
  // ============================================================================
  // Index of the media item to display as card thumbnail
  // If not set, uses first media item (backward compatible)
  displayImageIndex?: number;

  // Contextual
  addedBy?: Contributor; // When inside a collection
}

// Alias
export type Nugget = Article;

export interface User {
  id: string;
  name: string; // Display Name
  username?: string; // Added for auth
  email: string;
  role: 'admin' | 'user';
  status: 'active' | 'blocked';
  joinedAt: string;
  
  // Auth Specific
  authProvider?: AuthProvider;
  emailVerified?: boolean;
  phoneNumber?: string;
  avatarUrl?: string;
  
  // Extended profile fields (from ModularUser)
  pincode?: string;
  city?: string;
  country?: string;
  gender?: string;
  dateOfBirth?: string;
  website?: string;
  bio?: string;
  location?: string;
  
  preferences?: {
      interestedCategories: string[];
  };
  lastFeedVisit?: string;
}

export interface Collection {
  id: string;
  name: string;
  description: string;
  creatorId: string;
  createdAt: string;
  updatedAt?: string;
  followersCount: number;
  followers?: string[]; // Array of userIds who follow this collection
  entries: CollectionEntry[];
  validEntriesCount?: number; // Backend-validated count (preferred over entries.length)
  type: 'public' | 'private';
  
  // Display
  creator?: {
    id: string;
    name: string;
    avatar?: string;
  };
}

export interface CollectionEntry {
  articleId: string;
  addedByUserId: string;
  addedAt: string;
  flaggedBy: string[];
}

// --- UI & State ---

export type Theme = 'light' | 'dark';
export type SortOrder = 'latest' | 'oldest';

export interface FilterState {
  query: string;
  categories: string[];
  tag: string | null;
  sort: SortOrder;
  limit?: number;
}


