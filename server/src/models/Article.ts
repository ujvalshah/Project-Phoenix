import mongoose, { Schema, Document } from 'mongoose';

// Media types matching frontend
export type MediaType = 'image' | 'video' | 'document' | 'link' | 'text' | 'youtube' | 'twitter' | 'linkedin' | 'instagram' | 'tiktok' | 'rich';

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
  likes: number;
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

export interface IArticle extends Document {
  title?: string;
  excerpt?: string; // Short summary/description
  content: string;
  authorId: string;
  authorName: string;
  category: string; // Single category (legacy)
  categories?: string[]; // Array of categories (new) - display names
  categoryIds?: string[]; // Array of Tag ObjectIds for stable references
  publishedAt: string;
  tags: string[];
  readTime?: number; // Estimated read time in minutes
  visibility?: 'public' | 'private'; // Default: public
  
  // Media fields (matching frontend Article interface)
  media?: INuggetMedia | null;
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
  likes: { type: Number, default: 0 },
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

const ArticleSchema = new Schema<IArticle>({
  title: { type: String, required: false },
  excerpt: { type: String }, // Optional excerpt
  content: { type: String, default: '' }, // Optional - validation handled by Zod schema
  authorId: { type: String, required: true },
  authorName: { type: String, required: true },
  category: { type: String, required: true }, // Keep for backward compatibility
  categories: { type: [String], default: [] }, // Display names
  categoryIds: { type: [String], default: [] }, // Tag ObjectIds for stable matching
  publishedAt: { type: String, required: true },
  tags: { type: [String], default: [] },
  readTime: { type: Number }, // Optional read time
  visibility: { type: String, enum: ['public', 'private'], default: 'public' },
  
  // Media fields
  media: { type: NuggetMediaSchema, default: null },
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
  isCustomCreatedAt: { type: Boolean, default: false }
}, {
  timestamps: false // We manage our own timestamps
});

// Explicit indexes for performance
ArticleSchema.index({ authorId: 1 }); // Ownership queries
ArticleSchema.index({ publishedAt: -1 }); // List sorting (latest first)
ArticleSchema.index({ createdAt: -1 }); // List sorting (if using created_at)
ArticleSchema.index({ visibility: 1, publishedAt: -1 }); // Visibility filters with sorting
ArticleSchema.index({ 'categories': 1 }); // Category filtering
ArticleSchema.index({ tags: 1 }); // Tag filtering
// Audit Phase-2 Fix: Add compound index for authorId + visibility (common privacy filtering pattern)
ArticleSchema.index({ authorId: 1, visibility: 1 }); // User's articles by visibility
// Audit Phase-2 Fix: Add index for categoryIds array field (for stable category references)
ArticleSchema.index({ categoryIds: 1 });
// Audit Phase-2 Fix: Add index for media.url field (for YouTube cache lookup in AI controller)
ArticleSchema.index({ 'media.url': 1 });

export const Article = mongoose.model<IArticle>('Article', ArticleSchema);


