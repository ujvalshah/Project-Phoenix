/**
 * ============================================================================
 * USE YOUTUBE TITLE HOOK: Backend-First Title Resolution
 * ============================================================================
 * 
 * PURPOSE:
 * - Display YouTube video titles with backend as source of truth
 * - Fetch ONLY if title missing from backend data
 * - Persist fetched titles to backend for canonical storage
 * - Implement in-flight deduplication and negative caching
 * 
 * CANONICAL RESOLUTION RULE (NON-NEGOTIABLE):
 * 1. If backendTitle exists → use immediately, never fetch
 * 2. If backendTitle missing → fetch from YouTube oEmbed
 *    - On success: persist to backend + update local UI
 *    - On failure: show fallback, do not write to backend
 * 
 * ARCHITECTURE:
 * - Backend stores: media.previewMetadata.title
 * - Backend stores: media.previewMetadata.titleSource = "youtube-oembed"
 * - Backend stores: media.previewMetadata.titleFetchedAt = ISO timestamp
 * - All users see the same canonical title
 * 
 * USAGE:
 * const title = useYouTubeTitle({
 *   url: primaryMedia?.url,
 *   backendTitle: primaryMedia?.previewMetadata?.title,
 *   nuggetId: article.id,
 *   fallback: 'YouTube Video'
 * });
 * 
 * ============================================================================
 */

import { useState, useEffect, useRef } from 'react';
import { fetchYouTubeMetadata, extractYouTubeVideoId } from '@/utils/youtubeMetadata';

/**
 * Parameters for useYouTubeTitle hook
 */
export interface UseYouTubeTitleParams {
  url: string | null | undefined;
  backendTitle?: string | null; // Title from backend (media.previewMetadata.title)
  nuggetId?: string | null; // Nugget ID for backend persistence
  fallback?: string; // Fallback text if no title found
  onTitlePersisted?: (title: string) => void; // Callback when title is persisted to backend
}

/**
 * React hook to fetch and display YouTube video titles
 * 
 * BACKEND-FIRST RESOLUTION:
 * - If backendTitle exists: return immediately (never fetch)
 * - If backendTitle missing: fetch from YouTube and persist
 * 
 * FEATURES:
 * - In-flight deduplication (via fetchYouTubeMetadata)
 * - Negative caching (via fetchYouTubeMetadata)
 * - Backend persistence (one-time, idempotent)
 * - Non-blocking rendering
 * 
 * @param params - Configuration object
 * @returns string - Video title or fallback
 */
export function useYouTubeTitle(params: UseYouTubeTitleParams | string | null | undefined, legacyFallback?: string): string {
  // Support legacy API: useYouTubeTitle(url, fallback)
  const isLegacyAPI = typeof params === 'string' || params === null || params === undefined;
  const {
    url,
    backendTitle,
    nuggetId,
    fallback = 'YouTube Video',
    onTitlePersisted
  } = isLegacyAPI 
    ? { url: params as string | null | undefined, backendTitle: null, nuggetId: null, fallback: legacyFallback || 'YouTube Video', onTitlePersisted: undefined }
    : params;
  
  // CANONICAL RESOLUTION RULE #1: Backend title is source of truth
  const [title, setTitle] = useState<string>(() => {
    if (backendTitle) {
      // Backend title exists → use immediately, never fetch
      return backendTitle;
    }
    return fallback;
  });
  
  // Track if we've already attempted to fetch/persist for this video
  const attemptedVideoIds = useRef(new Set<string>());
  
  useEffect(() => {
    if (!url) {
      setTitle(fallback);
      return;
    }
    
    // CANONICAL RESOLUTION RULE #1: Backend data is source of truth
    if (backendTitle) {
      setTitle(backendTitle);
      return;
    }
    
    // CANONICAL RESOLUTION RULE #2: Fetch only if backend title missing
    const videoId = extractYouTubeVideoId(url);
    if (!videoId) {
      setTitle(fallback);
      return;
    }
    
    // Check if we've already attempted this video (prevent duplicate fetches)
    if (attemptedVideoIds.current.has(videoId)) {
      return;
    }
    
    // Mark as attempted
    attemptedVideoIds.current.add(videoId);
    
    // Fetch title from YouTube oEmbed API
    fetchYouTubeMetadata(url).then(metadata => {
      if (metadata?.title) {
        // Update local UI immediately
        setTitle(metadata.title);
        
        // Persist to backend (if nuggetId provided)
        if (nuggetId) {
          persistYouTubeTitleToBackend(nuggetId, metadata)
            .then(() => {
              console.debug(`[YouTube Title] Persisted title for video ${videoId} to nugget ${nuggetId}`);
              onTitlePersisted?.(metadata.title);
            })
            .catch(error => {
              console.warn(`[YouTube Title] Failed to persist title for video ${videoId}:`, error);
              // Don't revert UI on persistence failure - user still sees the title
            });
        }
      } else {
        // Fetch failed → show fallback
        setTitle(fallback);
      }
    }).catch(() => {
      // Fetch error → show fallback
      setTitle(fallback);
    });
  }, [url, backendTitle, nuggetId, fallback, onTitlePersisted]);
  
  return title;
}

/**
 * Persist YouTube title to backend
 * 
 * BACKEND UPDATE:
 * - PATCH /api/articles/:id
 * - Update media.previewMetadata.title (if not already set)
 * - Update media.previewMetadata.titleSource = "youtube-oembed"
 * - Update media.previewMetadata.titleFetchedAt = ISO timestamp
 * 
 * IDEMPOTENT: Safe to call multiple times (backend guards against overwriting)
 * 
 * @param nuggetId - Nugget ID to update
 * @param metadata - YouTube metadata from oEmbed API
 * @returns Promise<void>
 */
async function persistYouTubeTitleToBackend(
  nuggetId: string,
  metadata: { title: string; fetchedAt: string; source: string }
): Promise<void> {
  try {
    // Dynamic import to avoid circular dependencies
    const { apiClient } = await import('@/services/apiClient');
    
    // BACKEND UPDATE: Partial update to media.previewMetadata
    // Backend will only update if title is not already set
    const updatePayload = {
      media: {
        previewMetadata: {
          title: metadata.title,
          titleSource: metadata.source,
          titleFetchedAt: metadata.fetchedAt
        }
      }
    };
    
    // Use PATCH for partial update (idempotent)
    await apiClient.patch(`/articles/${nuggetId}`, updatePayload);
  } catch (error) {
    // Log but don't throw - persistence failure shouldn't break UI
    console.error('[YouTube Title] Backend persistence failed:', error);
    throw error;
  }
}

