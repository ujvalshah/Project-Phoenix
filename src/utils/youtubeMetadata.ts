/**
 * ============================================================================
 * YOUTUBE METADATA FETCHER: Hardened Title Extraction with Backend Persistence
 * ============================================================================
 * 
 * PURPOSE:
 * - Extract YouTube video titles reliably using YouTube's oEmbed API
 * - Implement in-flight request deduplication
 * - Implement negative caching for failed requests
 * - Return structured metadata for backend persistence
 * - Backend data is source of truth (never overwrite existing titles)
 * 
 * ARCHITECTURE:
 * - Backend stores titles in: media.previewMetadata.title
 * - Client fetches ONLY if backend title is missing
 * - Fetched titles are persisted to backend immediately
 * - All users see the same canonical title
 * 
 * ============================================================================
 */

/**
 * Extract YouTube video ID from various URL formats
 */
export function extractYouTubeVideoId(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    // youtu.be format
    if (hostname.includes('youtu.be')) {
      return urlObj.pathname.slice(1).split('?')[0];
    }
    
    // youtube.com format
    if (hostname.includes('youtube.com')) {
      // /watch?v=VIDEO_ID
      const vParam = urlObj.searchParams.get('v');
      if (vParam) return vParam;
      
      // /embed/VIDEO_ID
      const embedMatch = urlObj.pathname.match(/\/embed\/([^/?]+)/);
      if (embedMatch) return embedMatch[1];
      
      // /v/VIDEO_ID
      const vMatch = urlObj.pathname.match(/\/v\/([^/?]+)/);
      if (vMatch) return vMatch[1];
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Structured result from YouTube metadata fetch
 */
export interface YouTubeMetadataResult {
  title: string;
  fetchedAt: string; // ISO timestamp
  source: 'youtube-oembed';
}

/**
 * In-memory cache for successful YouTube title fetches
 * Maps videoId -> title
 */
const titleCache = new Map<string, string>();

/**
 * In-memory cache for failed fetches (negative caching)
 * Maps videoId -> failure timestamp
 * Prevents repeated requests for videos that fail
 */
const failureCache = new Map<string, number>();

/**
 * In-flight request tracking for deduplication
 * Maps videoId -> Promise<YouTubeMetadataResult | null>
 * Prevents concurrent duplicate requests
 */
const inFlightRequests = new Map<string, Promise<YouTubeMetadataResult | null>>();

/**
 * Negative cache TTL: 24 hours
 * After a failed fetch, don't retry for this duration
 */
const NEGATIVE_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Check if a video ID is in the negative cache (recent failure)
 */
function isInNegativeCache(videoId: string): boolean {
  const failedAt = failureCache.get(videoId);
  if (!failedAt) return false;
  
  const now = Date.now();
  const age = now - failedAt;
  
  if (age > NEGATIVE_CACHE_TTL_MS) {
    // TTL expired, remove from cache
    failureCache.delete(videoId);
    return false;
  }
  
  return true;
}

/**
 * Fetch YouTube video metadata using oEmbed API with deduplication
 * 
 * FEATURES:
 * - In-flight deduplication: reuses existing promise for same video
 * - Negative caching: doesn't retry failed fetches for 24 hours
 * - Success caching: caches successful fetches indefinitely
 * - Returns structured metadata for backend persistence
 * 
 * @param url - YouTube video URL
 * @returns Promise<YouTubeMetadataResult | null> - Metadata or null if failed
 */
export async function fetchYouTubeMetadata(url: string): Promise<YouTubeMetadataResult | null> {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) return null;
  
  // Check negative cache first (failed recently)
  if (isInNegativeCache(videoId)) {
    console.debug(`[YouTube Metadata] Skipping fetch for ${videoId} (negative cache)`);
    return null;
  }
  
  // Check success cache
  if (titleCache.has(videoId)) {
    const title = titleCache.get(videoId)!;
    return {
      title,
      fetchedAt: new Date().toISOString(),
      source: 'youtube-oembed'
    };
  }
  
  // Check in-flight requests (deduplication)
  const existingRequest = inFlightRequests.get(videoId);
  if (existingRequest) {
    console.debug(`[YouTube Metadata] Reusing in-flight request for ${videoId}`);
    return existingRequest;
  }
  
  // Create new fetch promise
  const fetchPromise = (async (): Promise<YouTubeMetadataResult | null> => {
    try {
      // Use YouTube's oEmbed API (no API key required)
      const oEmbedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
      
      const response = await fetch(oEmbedUrl);
      
      if (!response.ok) {
        // Add to negative cache
        failureCache.set(videoId, Date.now());
        return null;
      }
      
      const data = await response.json();
      const title = data.title?.trim();
      
      if (!title) {
        // Add to negative cache
        failureCache.set(videoId, Date.now());
        return null;
      }
      
      // Cache the successful result
      titleCache.set(videoId, title);
      
      return {
        title,
        fetchedAt: new Date().toISOString(),
        source: 'youtube-oembed'
      };
    } catch (error) {
      console.warn('[YouTube Metadata] Failed to fetch title for video:', videoId, error);
      // Add to negative cache
      failureCache.set(videoId, Date.now());
      return null;
    } finally {
      // Remove from in-flight tracking
      inFlightRequests.delete(videoId);
    }
  })();
  
  // Track in-flight request
  inFlightRequests.set(videoId, fetchPromise);
  
  return fetchPromise;
}

/**
 * Legacy compatibility: Fetch YouTube video title using oEmbed API
 * 
 * @deprecated Use fetchYouTubeMetadata() for new code (returns structured data)
 * @param url - YouTube video URL
 * @returns Promise<string | null> - Video title or null if failed
 */
export async function fetchYouTubeTitle(url: string): Promise<string | null> {
  const metadata = await fetchYouTubeMetadata(url);
  return metadata?.title || null;
}

/**
 * Get YouTube video title with caching (synchronous)
 * Returns cached value immediately if available, otherwise fetches
 * 
 * @deprecated Use useYouTubeTitle hook in React components for better state management
 * @param url - YouTube video URL
 * @returns string - Video title or fallback
 */
export function getYouTubeTitle(url: string): string {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) return 'YouTube Video';
  
  // Return cached title if available
  const cached = titleCache.get(videoId);
  if (cached) return cached;
  
  // If not cached, start fetching (async) and return placeholder
  fetchYouTubeMetadata(url).then(metadata => {
    if (metadata?.title) {
      // Update cache when fetch completes
      titleCache.set(videoId, metadata.title);
    }
  }).catch(() => {
    // Silently ignore errors
  });
  
  return 'YouTube Video'; // Placeholder while loading
}

/**
 * Preload YouTube title (fire and forget)
 * Useful for prefetching titles in the background
 * 
 * @param url - YouTube video URL
 */
export function preloadYouTubeTitle(url: string): void {
  fetchYouTubeMetadata(url).catch(() => {
    // Silently ignore errors for background prefetch
  });
}

/**
 * Clear all caches (success, failure, in-flight)
 * Useful for testing or memory management
 */
export function clearYouTubeTitleCache(): void {
  titleCache.clear();
  failureCache.clear();
  inFlightRequests.clear();
}

