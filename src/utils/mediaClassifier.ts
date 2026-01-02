/**
 * ============================================================================
 * MEDIA CLASSIFIER: Deterministic Primary/Supporting Media Logic
 * ============================================================================
 * 
 * PURPOSE:
 * - Classify media items as PRIMARY or SUPPORTING
 * - Apply strict, deterministic rules for media selection
 * - Ensure media never competes with analysis text
 * 
 * PRINCIPLES:
 * 1. Exactly ONE primary media per nugget (or none)
 * 2. Primary media priority: YouTube > Image > Document
 * 3. All other media becomes supporting media
 * 4. Never dynamically re-infer primary media (infer once, store)
 * 
 * ============================================================================
 */

import type { Article, PrimaryMedia, SupportingMediaItem, MediaType, NuggetMedia } from '@/types';

/**
 * Media type priority for primary media selection
 * Higher number = higher priority
 */
const MEDIA_TYPE_PRIORITY: Record<string, number> = {
  'youtube': 3,    // Highest priority
  'image': 2,      // Medium priority
  'document': 1,   // Lower priority
  'pdf': 1,
  'doc': 1,
  'docx': 1,
  'link': 0,       // Lowest priority (generic links)
  'twitter': 0,
  'linkedin': 0,
  'text': 0,
};

/**
 * Determine if a media type qualifies as primary media
 */
function isPrimaryMediaType(type: MediaType): boolean {
  return ['youtube', 'image', 'document', 'pdf', 'doc', 'docx'].includes(type);
}

/**
 * Get priority score for a media item
 */
function getMediaPriority(type: MediaType): number {
  return MEDIA_TYPE_PRIORITY[type] || 0;
}

/**
 * Extract YouTube video ID from various YouTube URL formats
 */
function extractYouTubeId(url: string): string | null {
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
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Get YouTube thumbnail URL from video ID
 */
function getYouTubeThumbnail(videoId: string): string {
  // Use high quality thumbnail (hqdefault is 480x360)
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

/**
 * Convert legacy NuggetMedia to PrimaryMedia format
 */
function convertToPrimaryMedia(media: NuggetMedia): PrimaryMedia {
  const primaryMedia: PrimaryMedia = {
    type: media.type,
    url: media.url,
    aspect_ratio: media.aspect_ratio,
    previewMetadata: media.previewMetadata,
  };
  
  // Set thumbnail based on type
  if (media.type === 'youtube') {
    const videoId = extractYouTubeId(media.url);
    if (videoId) {
      primaryMedia.thumbnail = getYouTubeThumbnail(videoId);
    } else if (media.thumbnail_url) {
      primaryMedia.thumbnail = media.thumbnail_url;
    } else if (media.previewMetadata?.imageUrl) {
      primaryMedia.thumbnail = media.previewMetadata.imageUrl;
    }
  } else if (media.type === 'image') {
    primaryMedia.thumbnail = media.url;
  } else if (media.previewMetadata?.imageUrl) {
    primaryMedia.thumbnail = media.previewMetadata.imageUrl;
  }
  
  return primaryMedia;
}

/**
 * Convert legacy NuggetMedia to SupportingMediaItem format
 */
function convertToSupportingMedia(media: NuggetMedia): SupportingMediaItem {
  return {
    type: media.type,
    url: media.url,
    thumbnail: media.thumbnail_url || media.previewMetadata?.imageUrl,
    filename: media.filename,
    title: media.previewMetadata?.title,
    previewMetadata: media.previewMetadata,
  };
}

/**
 * ============================================================================
 * CLASSIFY MEDIA: Main Classification Function
 * ============================================================================
 * 
 * Takes an Article with legacy media fields and classifies media into:
 * - primaryMedia: The single most important media item
 * - supportingMedia: All other media items
 * 
 * ALGORITHM:
 * 1. Collect all media from legacy fields (media, images, video, documents)
 * 2. If article already has primaryMedia/supportingMedia, use those (don't re-infer)
 * 3. Otherwise, apply priority rules to select primary media
 * 4. All remaining media becomes supporting media
 * 
 * PRIORITY RULES:
 * - YouTube videos beat everything
 * - Images beat documents
 * - Documents are lowest priority
 * - Within same type, first occurrence wins
 * 
 */
export function classifyArticleMedia(article: Article): {
  primaryMedia: PrimaryMedia | null;
  supportingMedia: SupportingMediaItem[];
} {
  // If article already has explicit primary/supporting media, use those
  // NEVER re-infer once classified (deterministic guarantee)
  if (article.primaryMedia !== undefined || article.supportingMedia !== undefined) {
    return {
      primaryMedia: article.primaryMedia || null,
      supportingMedia: article.supportingMedia || [],
    };
  }
  
  // Collect all media items from legacy fields
  const allMediaItems: Array<{ type: MediaType; url: string; source: 'media' | 'images' | 'video' | 'documents'; data?: any }> = [];
  
  // 1. Primary media field (NuggetMedia)
  if (article.media) {
    allMediaItems.push({
      type: article.media.type,
      url: article.media.url,
      source: 'media',
      data: article.media,
    });
  }
  
  // 2. Legacy images array
  if (article.images && article.images.length > 0) {
    article.images.forEach((imageUrl) => {
      allMediaItems.push({
        type: 'image',
        url: imageUrl,
        source: 'images',
      });
    });
  }
  
  // 3. Legacy video field
  if (article.video) {
    const videoType: MediaType = article.video.includes('youtube.com') || article.video.includes('youtu.be') 
      ? 'youtube' 
      : 'video';
    allMediaItems.push({
      type: videoType,
      url: article.video,
      source: 'video',
    });
  }
  
  // 4. Legacy documents array
  if (article.documents && article.documents.length > 0) {
    article.documents.forEach((doc) => {
      allMediaItems.push({
        type: 'document',
        url: doc.url,
        source: 'documents',
        data: doc,
      });
    });
  }
  
  // If no media at all, return null/empty
  if (allMediaItems.length === 0) {
    return {
      primaryMedia: null,
      supportingMedia: [],
    };
  }
  
  // ============================================================================
  // SELECT PRIMARY MEDIA (Highest Priority)
  // ============================================================================
  
  // Sort by priority (highest first)
  const sortedMedia = [...allMediaItems].sort((a, b) => {
    return getMediaPriority(b.type) - getMediaPriority(a.type);
  });
  
  // Find first media item that qualifies as primary
  const primaryCandidate = sortedMedia.find(item => isPrimaryMediaType(item.type));
  
  let primaryMedia: PrimaryMedia | null = null;
  let primaryMediaUrl: string | null = null;
  
  if (primaryCandidate) {
    primaryMediaUrl = primaryCandidate.url;
    
    if (primaryCandidate.source === 'media' && primaryCandidate.data) {
      // Convert from NuggetMedia
      primaryMedia = convertToPrimaryMedia(primaryCandidate.data);
    } else {
      // Create primary media from scratch
      primaryMedia = {
        type: primaryCandidate.type,
        url: primaryCandidate.url,
      };
      
      // Set thumbnail based on type
      if (primaryCandidate.type === 'youtube') {
        const videoId = extractYouTubeId(primaryCandidate.url);
        if (videoId) {
          primaryMedia.thumbnail = getYouTubeThumbnail(videoId);
        }
      } else if (primaryCandidate.type === 'image') {
        primaryMedia.thumbnail = primaryCandidate.url;
      }
      
      // Add document metadata if available
      if (primaryCandidate.source === 'documents' && primaryCandidate.data) {
        primaryMedia.previewMetadata = {
          url: primaryCandidate.url,
          title: primaryCandidate.data.title,
        };
      }
    }
  }
  
  // ============================================================================
  // COLLECT SUPPORTING MEDIA (Everything Else)
  // ============================================================================
  
  const supportingMedia: SupportingMediaItem[] = [];
  
  for (const item of allMediaItems) {
    // Skip the item that became primary media
    if (item.url === primaryMediaUrl) continue;
    
    if (item.source === 'media' && item.data) {
      supportingMedia.push(convertToSupportingMedia(item.data));
    } else if (item.source === 'images') {
      supportingMedia.push({
        type: 'image',
        url: item.url,
        thumbnail: item.url,
      });
    } else if (item.source === 'video') {
      const supportingItem: SupportingMediaItem = {
        type: item.type,
        url: item.url,
      };
      
      if (item.type === 'youtube') {
        const videoId = extractYouTubeId(item.url);
        if (videoId) {
          supportingItem.thumbnail = getYouTubeThumbnail(videoId);
        }
      }
      
      supportingMedia.push(supportingItem);
    } else if (item.source === 'documents' && item.data) {
      supportingMedia.push({
        type: 'document',
        url: item.url,
        filename: item.data.title,
        title: item.data.title,
      });
    }
  }
  
  return {
    primaryMedia,
    supportingMedia,
  };
}

/**
 * ============================================================================
 * GET THUMBNAIL URL: Deterministic Thumbnail Selection
 * ============================================================================
 * 
 * Returns the thumbnail URL for a nugget based on primary media only.
 * Supporting media NEVER influences thumbnail selection.
 * 
 * ALGORITHM:
 * - IF primaryMedia exists:
 *   - IF type === "youtube" → return YouTube thumbnail
 *   - ELSE IF type === "image" → return image URL
 *   - ELSE → return null (use system fallback)
 * - ELSE → return null (use system fallback)
 * 
 */
export function getThumbnailUrl(article: Article): string | null {
  // First check if article has explicit primaryMedia
  if (article.primaryMedia) {
    if (article.primaryMedia.thumbnail) {
      return article.primaryMedia.thumbnail;
    }
    
    // Fallback: generate thumbnail based on type
    if (article.primaryMedia.type === 'youtube') {
      const videoId = extractYouTubeId(article.primaryMedia.url);
      if (videoId) {
        return getYouTubeThumbnail(videoId);
      }
    } else if (article.primaryMedia.type === 'image') {
      return article.primaryMedia.url;
    }
    
    return null;
  }
  
  // Fallback: classify media and get primary media thumbnail
  const classified = classifyArticleMedia(article);
  if (classified.primaryMedia) {
    return classified.primaryMedia.thumbnail || null;
  }
  
  return null;
}

/**
 * Get count of supporting media items
 * Used to display "+N sources" indicator in cards
 */
export function getSupportingMediaCount(article: Article): number {
  if (article.supportingMedia) {
    return article.supportingMedia.length;
  }
  
  const classified = classifyArticleMedia(article);
  return classified.supportingMedia.length;
}

/**
 * Check if article has any media at all
 */
export function hasAnyMedia(article: Article): boolean {
  if (article.primaryMedia || (article.supportingMedia && article.supportingMedia.length > 0)) {
    return true;
  }
  
  // Check legacy fields
  return !!(
    article.media ||
    (article.images && article.images.length > 0) ||
    article.video ||
    (article.documents && article.documents.length > 0)
  );
}

/**
 * ============================================================================
 * GET ALL IMAGES: Collect all image URLs from article
 * ============================================================================
 * 
 * PURPOSE:
 * Returns an array of all image URLs from both primary and supporting media.
 * Used for multi-image grid thumbnail rendering in cards.
 * 
 * LOGIC:
 * 1. If primaryMedia is an image, include it first
 * 2. Add all supporting images
 * 3. Fall back to legacy images array if no classified media exists
 * 
 * @returns Array of image URLs (may be empty)
 */
export function getAllImageUrls(article: Article): string[] {
  const imageUrls: string[] = [];
  const seenUrls = new Set<string>(); // Deduplicate URLs
  
  // Helper to add URL if not seen
  const addImageUrl = (url: string | undefined) => {
    if (url && typeof url === 'string' && url.trim()) {
      const normalized = url.toLowerCase().trim();
      if (!seenUrls.has(normalized)) {
        seenUrls.add(normalized);
        imageUrls.push(url); // Keep original casing
      }
    }
  };
  
  // Check if article has classified media
  const hasClassifiedMedia = article.primaryMedia !== undefined || article.supportingMedia !== undefined;
  
  if (hasClassifiedMedia) {
    // Add primary media if it's an image
    if (article.primaryMedia?.type === 'image' && article.primaryMedia.url) {
      addImageUrl(article.primaryMedia.url);
    }
    
    // Add supporting images
    if (article.supportingMedia) {
      article.supportingMedia.forEach(media => {
        if (media.type === 'image' && media.url) {
          addImageUrl(media.url);
        }
      });
    }
  } else {
    // Fall back to classifying media on the fly
    const classified = classifyArticleMedia(article);
    
    // Add primary media if it's an image
    if (classified.primaryMedia?.type === 'image' && classified.primaryMedia.url) {
      addImageUrl(classified.primaryMedia.url);
    }
    
    // Add supporting images
    classified.supportingMedia.forEach(media => {
      if (media.type === 'image' && media.url) {
        addImageUrl(media.url);
      }
    });
  }
  
  // CRITICAL: Also include legacy images array (for backward compatibility)
  // This ensures images stored in the images array are always included
  if (article.images && Array.isArray(article.images)) {
    article.images.forEach(url => addImageUrl(url));
  }
  
  // Also check media field if it's an image type
  if (article.media?.type === 'image' && article.media.url) {
    addImageUrl(article.media.url);
  }
  
  // Check media.previewMetadata.imageUrl (for OG image URLs)
  if (article.media?.previewMetadata?.imageUrl) {
    addImageUrl(article.media.previewMetadata.imageUrl);
  }
  
  return imageUrls;
}

