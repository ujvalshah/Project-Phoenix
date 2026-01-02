/**
 * Unfurl Service
 * 
 * Calls the backend /api/unfurl endpoint to fetch rich metadata
 * for URLs and transforms it into the frontend NuggetMedia format.
 */

import { apiClient } from './apiClient';
import type { NuggetMedia, PreviewMetadata } from '@/types';
import type { Nugget } from '@/types/nugget';

/**
 * Transform backend Nugget to frontend NuggetMedia format
 */
function transformNuggetToMedia(nugget: Nugget, url: string): NuggetMedia {
  const previewMetadata: PreviewMetadata = {
    url: nugget.url,
    title: nugget.title,
    description: nugget.description,
    siteName: nugget.source.name,
    imageUrl: nugget.media?.src,
    faviconUrl: nugget.source.favicon,
    authorName: nugget.author,
    publishDate: nugget.publishedAt,
    mediaType: nugget.contentType === 'video' ? 'youtube' : 
               nugget.contentType === 'social' ? 'twitter' :
               nugget.contentType === 'image' ? 'image' :
               nugget.contentType === 'document' ? 'document' : 'link',
  };

  // Determine media type for NuggetMedia
  let mediaType: NuggetMedia['type'] = 'link';
  if (nugget.contentType === 'video') {
    mediaType = 'youtube';
  } else if (nugget.contentType === 'social') {
    mediaType = 'twitter';
  } else if (nugget.contentType === 'image') {
    mediaType = 'image';
  } else if (nugget.contentType === 'document') {
    mediaType = 'document';
  }

  const nuggetMedia: NuggetMedia = {
    type: mediaType,
    url: nugget.url,
    previewMetadata,
  };

  // Add aspect ratio if available
  if (nugget.media?.aspectRatio) {
    nuggetMedia.aspect_ratio = nugget.media.aspectRatio.toString();
  }

  // Add thumbnail if it's a video
  if (nugget.media?.src && nugget.contentType === 'video') {
    nuggetMedia.thumbnail_url = nugget.media.src;
  }

  return nuggetMedia;
}

/**
 * Unfurl a URL and return rich metadata
 * 
 * @param url - The URL to unfurl
 * @param options - Optional configuration
 * @returns NuggetMedia with rich preview metadata, or null if failed
 */
export async function unfurlUrl(
  url: string,
  options: { skipCache?: boolean; cancelKey?: string } = {}
): Promise<NuggetMedia | null> {
  try {
    // Use URL as cancelKey if not provided, ensuring each URL gets unique cancellation
    // This prevents batch requests from cancelling each other
    const cancelKey = options.cancelKey || `unfurl:${url}`;
    
    const response = await apiClient.post<Nugget>(
      '/unfurl',
      { url },
      undefined, // headers
      cancelKey
    );

    if (!response) {
      return null;
    }

    return transformNuggetToMedia(response, url);
  } catch (error) {
    console.error('[Unfurl] Failed to fetch metadata:', error);
    return null;
  }
}

