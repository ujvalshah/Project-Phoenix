/**
 * Batch Processing Service - CSV/Excel & Link Metadata
 * 
 * Handles standard batch upload operations:
 * - CSV/Excel file parsing
 * - Link metadata extraction via OpenGraph
 * - URL validation and normalization
 * 
 * NOTE: AI/Gemini processing has been moved to geminiService.ts and aiController.ts
 * This service is intentionally "fast and boring" - no AI calls.
 */

import { Article, IArticle } from '../models/Article.js';

// ============================================================================
// TYPES
// ============================================================================

export interface BatchRow {
  id: string;
  url: string;
  title?: string;
  excerpt?: string;
  status: 'pending' | 'processing' | 'success' | 'error' | 'draft';
  errorMessage?: string;
  articleId?: string;
  isYouTube?: boolean;
  metadata?: LinkMetadata;
}

export interface LinkMetadata {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  author?: string;
  publishedTime?: string;
  url?: string;
}

export interface BatchProcessOptions {
  authorId: string;
  authorName: string;
  defaultVisibility?: 'public' | 'private';
  defaultCategory?: string;
  onProgress?: (current: number, total: number, row: BatchRow) => void;
  onError?: (row: BatchRow, error: Error) => void;
  onSuccess?: (row: BatchRow, article: IArticle) => void;
}

export interface BatchResult {
  row: BatchRow;
  article?: IArticle;
  error?: string;
}

// ============================================================================
// URL HELPERS
// ============================================================================

/**
 * Check if a URL is a YouTube video URL
 */
export function isYouTubeUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    const host = url.hostname.toLowerCase();
    
    if (host === 'youtu.be') {
      return url.pathname.length > 1;
    }
    
    if (host.includes('youtube.com')) {
      if (url.pathname === '/watch' && url.searchParams.has('v')) return true;
      if (url.pathname.startsWith('/embed/')) return true;
      if (url.pathname.startsWith('/v/')) return true;
    }
    
    return false;
  } catch {
    return false;
  }
}

/**
 * Extract YouTube video ID from URL
 */
export function extractYouTubeVideoId(urlString: string): string | null {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname.toLowerCase();
    
    if (hostname.includes('youtube.com') && url.pathname === '/watch') {
      return url.searchParams.get('v');
    }
    
    if (hostname === 'youtu.be') {
      return url.pathname.slice(1).split('?')[0];
    }
    
    if (hostname.includes('youtube.com') && url.pathname.startsWith('/embed/')) {
      return url.pathname.slice(7).split('?')[0];
    }
    
    if (hostname.includes('youtube.com') && url.pathname.startsWith('/v/')) {
      return url.pathname.slice(3).split('?')[0];
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Validate and normalize a URL
 */
export function normalizeUrl(urlString: string): string | null {
  try {
    const url = new URL(urlString.trim());
    return url.href;
  } catch {
    // Try adding https:// if missing
    try {
      const url = new URL(`https://${urlString.trim()}`);
      return url.href;
    } catch {
      return null;
    }
  }
}

/**
 * Check if a URL is valid
 */
export function isValidUrl(urlString: string): boolean {
  return normalizeUrl(urlString) !== null;
}

// ============================================================================
// BATCH ROW HELPERS
// ============================================================================

/**
 * Generate unique batch row ID
 */
function generateId(): string {
  return `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create batch rows from URL array
 */
export function createBatchRows(urls: string[]): BatchRow[] {
  return urls
    .filter(url => url && url.trim())
    .map(url => {
      const normalizedUrl = normalizeUrl(url.trim());
      return {
        id: generateId(),
        url: normalizedUrl || url.trim(),
        status: normalizedUrl ? 'pending' as const : 'error' as const,
        errorMessage: normalizedUrl ? undefined : 'Invalid URL format',
        isYouTube: normalizedUrl ? isYouTubeUrl(normalizedUrl) : false,
      };
    });
}

/**
 * Create batch rows from CSV/Excel data
 * Expects rows with at minimum a 'url' column
 */
export function createBatchRowsFromData(data: Array<Record<string, string>>): BatchRow[] {
  return data
    .filter(row => row.url || row.URL || row.link || row.Link)
    .map(row => {
      const rawUrl = row.url || row.URL || row.link || row.Link || '';
      const normalizedUrl = normalizeUrl(rawUrl.trim());
      const title = row.title || row.Title || row.name || row.Name;
      const excerpt = row.excerpt || row.Excerpt || row.description || row.Description;
      
      return {
        id: generateId(),
        url: normalizedUrl || rawUrl.trim(),
        title: title?.trim(),
        excerpt: excerpt?.trim(),
        status: normalizedUrl ? 'pending' as const : 'error' as const,
        errorMessage: normalizedUrl ? undefined : 'Invalid URL format',
        isYouTube: normalizedUrl ? isYouTubeUrl(normalizedUrl) : false,
      };
    });
}

// ============================================================================
// BATCH PROCESSING (Non-AI)
// ============================================================================

/**
 * Process a batch of URLs as articles (no AI)
 * 
 * This is the "fast and boring" path:
 * - Validates URLs
 * - Creates articles with provided or fetched metadata
 * - Does NOT call any AI services
 * 
 * For YouTube AI processing, use the AI controller endpoints.
 */
export async function processBatchUrls(
  rows: BatchRow[],
  options: BatchProcessOptions
): Promise<BatchResult[]> {
  const {
    authorId,
    authorName,
    defaultVisibility = 'private',
    defaultCategory = 'Uncategorized',
    onProgress,
    onError,
    onSuccess,
  } = options;

  console.log(`[BatchService] Processing ${rows.length} URLs (non-AI)`);

  const results: BatchResult[] = [];
  let processed = 0;

  for (const row of rows) {
    processed++;
    row.status = 'processing';
    
    if (onProgress) {
      onProgress(processed, rows.length, row);
    }

    // Skip invalid URLs
    if (!isValidUrl(row.url)) {
      row.status = 'error';
      row.errorMessage = 'Invalid URL format';
      results.push({ row, error: row.errorMessage });
      if (onError) {
        onError(row, new Error(row.errorMessage));
      }
      continue;
    }

    try {
      // Create article with basic metadata
      const articleData = {
        title: row.title || extractTitleFromUrl(row.url),
        excerpt: row.excerpt || '',
        content: '',
        authorId,
        authorName,
        category: defaultCategory,
        categories: [defaultCategory],
        tags: [],
        publishedAt: new Date().toISOString(),
        visibility: defaultVisibility,
        source_type: row.isYouTube ? 'youtube' : 'link',
        
        media: {
          type: row.isYouTube ? 'youtube' as const : 'link' as const,
          url: row.url,
          previewMetadata: row.metadata ? {
            url: row.url,
            title: row.metadata.title,
            description: row.metadata.description,
            image: row.metadata.image,
            siteName: row.metadata.siteName,
          } : undefined,
        },
        
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const savedArticle = await Article.create(articleData);
      
      row.status = 'success';
      row.articleId = savedArticle._id.toString();
      
      if (onSuccess) {
        onSuccess(row, savedArticle);
      }
      
      results.push({ row, article: savedArticle });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      row.status = 'error';
      row.errorMessage = errorMessage;
      
      if (onError) {
        onError(row, error instanceof Error ? error : new Error(errorMessage));
      }
      
      results.push({ row, error: errorMessage });
    }
  }

  const successCount = results.filter(r => r.article).length;
  console.log(`[BatchService] Complete: ${successCount}/${rows.length} saved`);

  return results;
}

/**
 * Extract a reasonable title from a URL
 */
function extractTitleFromUrl(urlString: string): string {
  try {
    const url = new URL(urlString);
    
    // For YouTube, try to get video title placeholder
    if (isYouTubeUrl(urlString)) {
      const videoId = extractYouTubeVideoId(urlString);
      return videoId ? `YouTube Video (${videoId})` : 'YouTube Video';
    }
    
    // Use pathname as title, clean it up
    let title = url.pathname
      .split('/')
      .filter(Boolean)
      .pop() || url.hostname;
    
    // Clean up common patterns
    title = title
      .replace(/[-_]/g, ' ')
      .replace(/\.(html|htm|php|aspx?)$/i, '')
      .trim();
    
    // Capitalize first letter of each word
    title = title
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    return title || url.hostname;
  } catch {
    return 'Untitled';
  }
}

// ============================================================================
// DRAFT MANAGEMENT
// ============================================================================

/**
 * Get all draft articles for a user
 */
export async function getDraftArticles(authorId: string): Promise<IArticle[]> {
  return Article.find({
    authorId,
    source_type: { $in: ['ai-draft', 'draft'] },
  }).sort({ created_at: -1 });
}

/**
 * Publish a draft article
 */
export async function publishDraft(articleId: string): Promise<IArticle | null> {
  return Article.findByIdAndUpdate(
    articleId,
    {
      visibility: 'public',
      source_type: 'published',
      updated_at: new Date().toISOString(),
    },
    { new: true }
  );
}

/**
 * Publish multiple drafts
 */
export async function publishDrafts(articleIds: string[]): Promise<number> {
  const result = await Article.updateMany(
    { _id: { $in: articleIds } },
    {
      visibility: 'public',
      source_type: 'published',
      updated_at: new Date().toISOString(),
    }
  );
  return result.modifiedCount;
}

/**
 * Delete a draft article
 */
export async function deleteDraft(articleId: string): Promise<boolean> {
  const result = await Article.findOneAndDelete({
    _id: articleId,
    source_type: { $in: ['ai-draft', 'draft'] },
  });
  return !!result;
}

// ============================================================================
// STATISTICS
// ============================================================================

/**
 * Get batch processing statistics for a user
 */
export async function getBatchStats(authorId: string): Promise<{
  totalDrafts: number;
  aiDrafts: number;
  published: number;
}> {
  const [totalDrafts, aiDrafts, published] = await Promise.all([
    Article.countDocuments({ authorId, source_type: { $in: ['ai-draft', 'draft'] } }),
    Article.countDocuments({ authorId, source_type: 'ai-draft' }),
    Article.countDocuments({ authorId, source_type: { $in: ['published', 'ai-published'] } }),
  ]);

  return { totalDrafts, aiDrafts, published };
}
