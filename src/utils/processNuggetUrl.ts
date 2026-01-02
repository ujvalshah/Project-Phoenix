/**
 * Shared URL Processing Utility
 * 
 * This module provides unified URL + metadata processing logic
 * that works identically for both Create and Edit workflows.
 * 
 * CRITICAL: This ensures parity between Create and Edit flows.
 */

import { unfurlUrl } from '@/services/unfurlService';
import { detectProviderFromUrl, shouldFetchMetadata } from '@/utils/urlUtils';
import type { NuggetMedia } from '@/types';

export interface ProcessNuggetUrlOptions {
  /**
   * Whether to skip metadata fetching (for images or unsupported URLs)
   */
  skipMetadata?: boolean;
  
  /**
   * Cancel key for request cancellation
   */
  cancelKey?: string;
  
  /**
   * Whether to skip cache (force fresh fetch)
   */
  skipCache?: boolean;
}

export interface ProcessNuggetUrlResult {
  /**
   * The processed media object with metadata
   */
  media: NuggetMedia | null;
  
  /**
   * Whether metadata fetch is in progress
   */
  isLoading: boolean;
  
  /**
   * Any error that occurred during processing
   */
  error: Error | null;
}

/**
 * Process a URL and fetch metadata if needed
 * 
 * This is the SINGLE SOURCE OF TRUTH for URL processing.
 * Both Create and Edit workflows MUST use this function.
 * 
 * @param url - The URL to process
 * @param options - Processing options
 * @returns Promise resolving to processed media or null
 */
export async function processNuggetUrl(
  url: string,
  options: ProcessNuggetUrlOptions = {}
): Promise<NuggetMedia | null> {
  if (!url || !url.trim()) {
    return null;
  }

  const { skipMetadata = false, cancelKey, skipCache } = options;

  // Check if this URL should have metadata fetched
  const shouldFetch = !skipMetadata && shouldFetchMetadata(url);
  
  if (!shouldFetch) {
    // For URLs that don't need metadata (images, etc.), create minimal media object
    const urlType = detectProviderFromUrl(url);
    return {
      type: urlType === 'image' ? 'image' : 'link',
      url: url,
      previewMetadata: {
        url: url,
        title: url,
      },
    };
  }

  // Fetch metadata for URLs that support it
  try {
    const metadata = await unfurlUrl(url, { skipCache, cancelKey });
    return metadata;
  } catch (error) {
    console.error('[processNuggetUrl] Failed to fetch metadata:', error);
    // Return minimal media object on error
    return {
      type: detectProviderFromUrl(url),
      url: url,
      previewMetadata: {
        url: url,
        title: url,
      },
    };
  }
}

/**
 * Detect URL changes between two URL arrays
 * 
 * Returns information about what changed:
 * - added: URLs that are new
 * - removed: URLs that were removed
 * - changed: Whether any URLs changed
 * 
 * @param previousUrls - Previous URL array
 * @param currentUrls - Current URL array
 * @returns Change detection result
 */
export function detectUrlChanges(
  previousUrls: string[],
  currentUrls: string[]
): {
  added: string[];
  removed: string[];
  changed: boolean;
  primaryUrlChanged: boolean;
} {
  const previousSet = new Set(previousUrls);
  const currentSet = new Set(currentUrls);
  
  const added = currentUrls.filter(url => !previousSet.has(url));
  const removed = previousUrls.filter(url => !currentSet.has(url));
  const changed = added.length > 0 || removed.length > 0;
  
  // Check if primary URL (first non-image URL) changed
  const getPrimaryUrl = (urls: string[]) => {
    return urls.find(url => {
      const type = detectProviderFromUrl(url);
      return type !== 'image' && shouldFetchMetadata(url);
    });
  };
  
  const previousPrimary = getPrimaryUrl(previousUrls);
  const currentPrimary = getPrimaryUrl(currentUrls);
  const primaryUrlChanged = previousPrimary !== currentPrimary;
  
  return {
    added,
    removed,
    changed,
    primaryUrlChanged,
  };
}

/**
 * Get the primary URL from an array of URLs
 * 
 * Primary URL is the first non-image URL that should have metadata fetched.
 * This is used for media object creation.
 * 
 * @param urls - Array of URLs
 * @returns Primary URL or null
 */
export function getPrimaryUrl(urls: string[]): string | null {
  if (!urls || urls.length === 0) {
    return null;
  }
  
  // Find first non-image URL that should have metadata fetched
  const primaryUrl = urls.find(url => {
    const type = detectProviderFromUrl(url);
    return type !== 'image' && shouldFetchMetadata(url);
  });
  
  return primaryUrl || urls[0] || null;
}






