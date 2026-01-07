/**
 * useImageManager Hook
 *
 * PHASE 3: Single Source of Truth for Image Management
 *
 * This hook consolidates all image-related state management into a single,
 * consistent interface. It replaces the fragmented state arrays (existingImages,
 * masonryMediaItems, urls, attachments) with a unified canonical state.
 *
 * ARCHITECTURE:
 * - Single `images` array as the source of truth
 * - Derived state computed via useMemo (not stored separately)
 * - Consistent URL normalization using normalizeImageUrl()
 * - Proper lifecycle management for add/delete operations
 *
 * FEATURE FLAG:
 * - Controlled by FEATURE_FLAGS.USE_IMAGE_MANAGER
 * - Can be disabled to fall back to legacy behavior
 */

import { useState, useMemo, useCallback, useRef } from 'react';
import type { Article, MediaType } from '@/types';
import { normalizeImageUrl } from '@/shared/articleNormalization/imageDedup';
import { getAllImageUrls } from '@/utils/mediaClassifier';
import { collectMasonryMediaItems, MasonryMediaItem } from '@/utils/masonryMediaHelper';
import { isFeatureEnabled } from '@/constants/featureFlags';

/**
 * Represents a single image in the unified state
 */
export interface ImageItem {
  /** Unique identifier (hash of normalized URL) */
  id: string;
  /** Original URL (preserve casing for display) */
  url: string;
  /** Normalized URL for comparison */
  normalizedUrl: string;
  /** Source of this image */
  source: 'primary' | 'supporting' | 'legacy' | 'upload' | 'url-input';
  /** Where this image is stored in the Article model */
  storageLocation: 'images' | 'primaryMedia' | 'supportingMedia' | 'media' | 'upload';
  /** Whether to show in Masonry layout */
  showInMasonry: boolean;
  /** Optional title for Masonry tile */
  masonryTitle?: string;
  /** Current status of this image */
  status: 'active' | 'deleting' | 'deleted' | 'uploading' | 'error';
  /** Cloudinary media ID if applicable */
  mediaId?: string;
  /** Media type */
  type: MediaType;
  /** Thumbnail URL */
  thumbnail?: string;
  /** Preview metadata */
  previewMetadata?: any;
}

/**
 * Internal state for the image manager
 */
interface ImageManagerState {
  /** Canonical array of all images */
  images: ImageItem[];
  /** Set of normalized URLs currently being deleted */
  pendingDeletions: Set<string>;
  /** Whether the hook has been initialized with article data */
  isInitialized: boolean;
  /** Set of explicitly deleted image URLs (normalized) */
  explicitlyDeleted: Set<string>;
}

/**
 * Return type for useImageManager hook
 */
export interface UseImageManagerReturn {
  // ============================================================================
  // DERIVED STATE (computed via useMemo, not stored)
  // ============================================================================

  /** All active image URLs (for backward compatibility with existingImages) */
  existingImages: string[];

  /** Masonry media items (for MasonryMediaToggle component) */
  masonryItems: MasonryMediaItem[];

  /** Uploaded image URLs (Cloudinary URLs) */
  uploadedImageUrls: string[];

  /** All image items (canonical state) */
  allImages: ImageItem[];

  // ============================================================================
  // ACTIONS
  // ============================================================================

  /** Add a new image */
  addImage: (
    url: string,
    source: ImageItem['source'],
    options?: {
      mediaId?: string;
      showInMasonry?: boolean;
      masonryTitle?: string;
      type?: MediaType;
      thumbnail?: string;
      previewMetadata?: any;
    }
  ) => void;

  /** Delete an image (returns promise for async API call) */
  deleteImage: (url: string) => void;

  /** Mark deletion as complete (call after API success) */
  confirmDeletion: (url: string) => void;

  /** Rollback deletion (call after API failure) */
  rollbackDeletion: (url: string) => void;

  /** Toggle Masonry visibility for an image */
  toggleMasonry: (url: string, showInMasonry: boolean) => void;

  /** Set Masonry title for an image */
  setMasonryTitle: (url: string, title: string) => void;

  /** Sync state from an Article (for edit mode initialization) */
  syncFromArticle: (article: Article) => void;

  /** Clear all images (for create mode reset) */
  clearAll: () => void;

  // ============================================================================
  // STATE QUERIES
  // ============================================================================

  /** Check if an image is currently being deleted */
  isDeleting: (url: string) => boolean;

  /** Check if an image was explicitly deleted */
  isExplicitlyDeleted: (url: string) => boolean;

  /** Check if there are unsaved changes */
  hasChanges: boolean;

  /** Check if the manager is initialized */
  isInitialized: boolean;

  /** Get explicitly deleted URLs (for normalizeArticleInput) */
  explicitlyDeletedUrls: Set<string>;
}

/**
 * Generate a unique ID for an image based on its normalized URL
 */
function generateImageId(normalizedUrl: string): string {
  // Simple hash for uniqueness
  let hash = 0;
  for (let i = 0; i < normalizedUrl.length; i++) {
    const char = normalizedUrl.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `img-${Math.abs(hash).toString(36)}`;
}

/**
 * Detect media type from URL
 */
function detectMediaType(url: string): MediaType {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?|$)/)) {
    return 'image';
  }
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) {
    return 'youtube';
  }
  if (lowerUrl.match(/\.(mp4|webm|mov|avi)(\?|$)/)) {
    return 'video';
  }
  if (lowerUrl.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx)(\?|$)/)) {
    return 'document';
  }
  return 'image'; // Default to image for unknown URLs
}

/**
 * Convert Article data to ImageItem array
 */
function articleToImageItems(article: Article): ImageItem[] {
  const items: ImageItem[] = [];
  const seenUrls = new Set<string>();

  const addItem = (
    url: string,
    source: ImageItem['source'],
    storageLocation: ImageItem['storageLocation'],
    options: Partial<ImageItem> = {}
  ) => {
    const normalizedUrl = normalizeImageUrl(url);
    if (seenUrls.has(normalizedUrl)) {
      if (isFeatureEnabled('LOG_IMAGE_OPERATIONS')) {
        console.log('[useImageManager] Skipping duplicate:', { url, normalizedUrl, source });
      }
      return;
    }
    seenUrls.add(normalizedUrl);

    items.push({
      id: generateImageId(normalizedUrl),
      url,
      normalizedUrl,
      source,
      storageLocation,
      showInMasonry: options.showInMasonry ?? false,
      masonryTitle: options.masonryTitle,
      status: 'active',
      mediaId: options.mediaId,
      type: options.type ?? detectMediaType(url),
      thumbnail: options.thumbnail ?? url,
      previewMetadata: options.previewMetadata,
    });
  };

  // 1. Primary media
  if (article.primaryMedia?.url) {
    addItem(article.primaryMedia.url, 'primary', 'primaryMedia', {
      showInMasonry: article.primaryMedia.showInMasonry ?? true,
      masonryTitle: article.primaryMedia.masonryTitle,
      type: article.primaryMedia.type,
      thumbnail: article.primaryMedia.thumbnail,
      previewMetadata: article.primaryMedia.previewMetadata,
    });
  }

  // 2. Supporting media (images only)
  if (article.supportingMedia) {
    article.supportingMedia.forEach((media) => {
      if (media.type === 'image' && media.url) {
        addItem(media.url, 'supporting', 'supportingMedia', {
          showInMasonry: media.showInMasonry ?? false,
          masonryTitle: media.masonryTitle,
          type: media.type,
          thumbnail: media.thumbnail,
          previewMetadata: media.previewMetadata,
        });
      }
    });
  }

  // 3. Legacy media field
  if (article.media?.type === 'image' && article.media.url) {
    addItem(article.media.url, 'legacy', 'media', {
      showInMasonry: article.media.showInMasonry ?? false,
      masonryTitle: article.media.masonryTitle,
      type: article.media.type,
      previewMetadata: article.media.previewMetadata,
    });
  }

  // 4. Legacy images array
  if (article.images && Array.isArray(article.images)) {
    article.images.forEach((url) => {
      addItem(url, 'legacy', 'images', {
        showInMasonry: false,
        type: 'image',
      });
    });
  }

  return items;
}

/**
 * useImageManager Hook
 *
 * Single source of truth for all image-related state in CreateNuggetModal.
 *
 * @param mode - 'create' or 'edit' mode
 * @param initialArticle - Article data for edit mode initialization
 */
export function useImageManager(
  mode: 'create' | 'edit',
  initialArticle?: Article
): UseImageManagerReturn {
  // Track initial article ID to detect changes
  const initialArticleIdRef = useRef<string | undefined>(initialArticle?.id);

  // ============================================================================
  // CANONICAL STATE (single source of truth)
  // ============================================================================
  const [state, setState] = useState<ImageManagerState>(() => {
    // Initialize from article in edit mode
    if (mode === 'edit' && initialArticle) {
      return {
        images: articleToImageItems(initialArticle),
        pendingDeletions: new Set(),
        isInitialized: true,
        explicitlyDeleted: new Set(),
      };
    }
    // Empty state for create mode
    return {
      images: [],
      pendingDeletions: new Set(),
      isInitialized: mode === 'create',
      explicitlyDeleted: new Set(),
    };
  });

  // Track changes from initial state
  const [hasChanges, setHasChanges] = useState(false);

  // ============================================================================
  // DERIVED STATE (computed via useMemo)
  // ============================================================================

  /** All active image URLs (backward compatible with existingImages) */
  const existingImages = useMemo(() => {
    return state.images
      .filter((img) => img.status === 'active' && img.type === 'image')
      .map((img) => img.url);
  }, [state.images]);

  /** Masonry media items (for MasonryMediaToggle) */
  const masonryItems = useMemo((): MasonryMediaItem[] => {
    return state.images
      .filter((img) => img.status === 'active')
      .map((img) => ({
        id: img.id, // Use stable image ID (based on URL hash) instead of index-based ID
        type: img.type,
        url: img.url,
        thumbnail: img.thumbnail,
        source: img.source === 'primary' ? 'primary' :
                img.source === 'supporting' ? 'supporting' :
                img.source === 'legacy' ? 'legacy-image' : 'supporting',
        showInMasonry: img.showInMasonry,
        isLocked: false,
        masonryTitle: img.masonryTitle,
        previewMetadata: img.previewMetadata,
      }));
  }, [state.images]);

  /** Uploaded image URLs (Cloudinary URLs) */
  const uploadedImageUrls = useMemo(() => {
    return state.images
      .filter((img) => img.status === 'active' && img.source === 'upload' && img.mediaId)
      .map((img) => img.url);
  }, [state.images]);

  /** All active images */
  const allImages = useMemo(() => {
    return state.images.filter((img) => img.status === 'active');
  }, [state.images]);

  // ============================================================================
  // ACTIONS
  // ============================================================================

  /** Add a new image */
  const addImage = useCallback((
    url: string,
    source: ImageItem['source'],
    options?: {
      mediaId?: string;
      showInMasonry?: boolean;
      masonryTitle?: string;
      type?: MediaType;
      thumbnail?: string;
      previewMetadata?: any;
    }
  ) => {
    const normalizedUrl = normalizeImageUrl(url);

    setState((prev) => {
      // Check for duplicates
      const exists = prev.images.some(
        (img) => img.normalizedUrl === normalizedUrl && img.status === 'active'
      );
      if (exists) {
        if (isFeatureEnabled('LOG_IMAGE_OPERATIONS')) {
          console.log('[useImageManager] addImage: Duplicate skipped', { url, normalizedUrl });
        }
        return prev;
      }

      // Check if explicitly deleted
      if (prev.explicitlyDeleted.has(normalizedUrl)) {
        if (isFeatureEnabled('LOG_IMAGE_OPERATIONS')) {
          console.log('[useImageManager] addImage: Explicitly deleted, skipping', { url });
        }
        return prev;
      }

      const newImage: ImageItem = {
        id: generateImageId(normalizedUrl),
        url,
        normalizedUrl,
        source,
        storageLocation: source === 'upload' ? 'upload' : 'images',
        showInMasonry: options?.showInMasonry ?? (source === 'primary'),
        masonryTitle: options?.masonryTitle,
        status: 'active',
        mediaId: options?.mediaId,
        type: options?.type ?? detectMediaType(url),
        thumbnail: options?.thumbnail ?? url,
        previewMetadata: options?.previewMetadata,
      };

      if (isFeatureEnabled('LOG_IMAGE_OPERATIONS')) {
        console.log('[useImageManager] addImage:', { url, source, newImage });
      }

      return {
        ...prev,
        images: [...prev.images, newImage],
      };
    });

    setHasChanges(true);
  }, []);

  /** Delete an image (optimistic update) */
  const deleteImage = useCallback((url: string) => {
    const normalizedUrl = normalizeImageUrl(url);

    setState((prev) => {
      // Mark as deleting
      const updatedImages = prev.images.map((img) =>
        img.normalizedUrl === normalizedUrl
          ? { ...img, status: 'deleting' as const }
          : img
      );

      // Add to pending deletions
      const newPending = new Set(prev.pendingDeletions);
      newPending.add(normalizedUrl);

      // Add to explicitly deleted
      const newExplicitlyDeleted = new Set(prev.explicitlyDeleted);
      newExplicitlyDeleted.add(normalizedUrl);

      if (isFeatureEnabled('LOG_IMAGE_OPERATIONS')) {
        console.log('[useImageManager] deleteImage: Optimistic delete', { url, normalizedUrl });
      }

      return {
        ...prev,
        images: updatedImages,
        pendingDeletions: newPending,
        explicitlyDeleted: newExplicitlyDeleted,
      };
    });

    setHasChanges(true);
  }, []);

  /** Confirm deletion (after API success) */
  const confirmDeletion = useCallback((url: string) => {
    const normalizedUrl = normalizeImageUrl(url);

    setState((prev) => {
      // Mark as deleted
      const updatedImages = prev.images.map((img) =>
        img.normalizedUrl === normalizedUrl
          ? { ...img, status: 'deleted' as const }
          : img
      );

      // Remove from pending
      const newPending = new Set(prev.pendingDeletions);
      newPending.delete(normalizedUrl);

      if (isFeatureEnabled('LOG_IMAGE_OPERATIONS')) {
        console.log('[useImageManager] confirmDeletion:', { url, normalizedUrl });
      }

      return {
        ...prev,
        images: updatedImages,
        pendingDeletions: newPending,
      };
    });
  }, []);

  /** Rollback deletion (after API failure) */
  const rollbackDeletion = useCallback((url: string) => {
    const normalizedUrl = normalizeImageUrl(url);

    setState((prev) => {
      // Mark as active again
      const updatedImages = prev.images.map((img) =>
        img.normalizedUrl === normalizedUrl && img.status === 'deleting'
          ? { ...img, status: 'active' as const }
          : img
      );

      // Remove from pending
      const newPending = new Set(prev.pendingDeletions);
      newPending.delete(normalizedUrl);

      // Remove from explicitly deleted
      const newExplicitlyDeleted = new Set(prev.explicitlyDeleted);
      newExplicitlyDeleted.delete(normalizedUrl);

      if (isFeatureEnabled('LOG_IMAGE_OPERATIONS')) {
        console.log('[useImageManager] rollbackDeletion:', { url, normalizedUrl });
      }

      return {
        ...prev,
        images: updatedImages,
        pendingDeletions: newPending,
        explicitlyDeleted: newExplicitlyDeleted,
      };
    });
  }, []);

  /** Toggle Masonry visibility */
  const toggleMasonry = useCallback((url: string, showInMasonry: boolean) => {
    const normalizedUrl = normalizeImageUrl(url);

    setState((prev) => ({
      ...prev,
      images: prev.images.map((img) =>
        img.normalizedUrl === normalizedUrl
          ? { ...img, showInMasonry }
          : img
      ),
    }));

    setHasChanges(true);
  }, []);

  /** Set Masonry title */
  const setMasonryTitle = useCallback((url: string, title: string) => {
    const normalizedUrl = normalizeImageUrl(url);

    setState((prev) => ({
      ...prev,
      images: prev.images.map((img) =>
        img.normalizedUrl === normalizedUrl
          ? { ...img, masonryTitle: title || undefined }
          : img
      ),
    }));

    setHasChanges(true);
  }, []);

  /** Sync from Article (for edit mode or refresh) */
  const syncFromArticle = useCallback((article: Article) => {
    const newImages = articleToImageItems(article);

    setState((prev) => {
      // Filter out explicitly deleted images
      const filteredImages = newImages.filter(
        (img) => !prev.explicitlyDeleted.has(img.normalizedUrl)
      );

      // IDEMPOTENCY CHECK: If images haven't changed, don't update state
      // Compare normalized URLs to detect actual changes
      const currentNormalizedUrls = new Set(
        prev.images
          .filter(img => img.status === 'active')
          .map(img => img.normalizedUrl)
      );
      const newNormalizedUrls = new Set(
        filteredImages.map(img => img.normalizedUrl)
      );

      // Check if sets are equal (same images)
      const imagesUnchanged = 
        currentNormalizedUrls.size === newNormalizedUrls.size &&
        [...currentNormalizedUrls].every(url => newNormalizedUrls.has(url));

      // If images are unchanged and already initialized, return prev state (no update)
      if (imagesUnchanged && prev.isInitialized) {
        if (isFeatureEnabled('LOG_IMAGE_OPERATIONS')) {
          console.log('[useImageManager] syncFromArticle: No changes detected, skipping update', {
            articleId: article.id,
            imageCount: filteredImages.length,
          });
        }
        return prev; // No state update = no re-render
      }

      if (isFeatureEnabled('LOG_IMAGE_OPERATIONS')) {
        console.log('[useImageManager] syncFromArticle:', {
          articleId: article.id,
          totalImages: newImages.length,
          afterFiltering: filteredImages.length,
          explicitlyDeleted: Array.from(prev.explicitlyDeleted),
          imagesChanged: !imagesUnchanged,
        });
      }

      return {
        ...prev,
        images: filteredImages,
        isInitialized: true,
      };
    });
  }, []);

  /** Clear all images */
  const clearAll = useCallback(() => {
    setState({
      images: [],
      pendingDeletions: new Set(),
      isInitialized: true,
      explicitlyDeleted: new Set(),
    });
    setHasChanges(false);
  }, []);

  // ============================================================================
  // STATE QUERIES
  // ============================================================================

  /** Check if an image is being deleted */
  const isDeleting = useCallback((url: string): boolean => {
    const normalizedUrl = normalizeImageUrl(url);
    return state.pendingDeletions.has(normalizedUrl);
  }, [state.pendingDeletions]);

  /** Check if an image was explicitly deleted */
  const isExplicitlyDeleted = useCallback((url: string): boolean => {
    const normalizedUrl = normalizeImageUrl(url);
    return state.explicitlyDeleted.has(normalizedUrl);
  }, [state.explicitlyDeleted]);

  // Memoize return object to ensure stability across renders
  // This prevents infinite loops when used in useEffect dependencies
  // Functions are stable (useCallback), derived values update when state changes
  return useMemo(() => ({
    // Derived state (computed via useMemo above)
    existingImages,
    masonryItems,
    uploadedImageUrls,
    allImages,

    // Actions (all stable via useCallback with [] deps)
    addImage,
    deleteImage,
    confirmDeletion,
    rollbackDeletion,
    toggleMasonry,
    setMasonryTitle,
    syncFromArticle,
    clearAll,

    // State queries (stable functions, but return values may change)
    isDeleting,
    isExplicitlyDeleted,
    hasChanges,
    isInitialized: state.isInitialized,
    explicitlyDeletedUrls: state.explicitlyDeleted,
  }), [
    // Dependencies: derived values (update when state.images changes) + stable functions
    existingImages,
    masonryItems,
    uploadedImageUrls,
    allImages,
    // Functions are stable (useCallback), but include for completeness
    addImage,
    deleteImage,
    confirmDeletion,
    rollbackDeletion,
    toggleMasonry,
    setMasonryTitle,
    syncFromArticle,
    clearAll,
    isDeleting,
    isExplicitlyDeleted,
    hasChanges,
    // State values that are exposed directly
    state.isInitialized,
    state.explicitlyDeleted,
  ]);
}

/**
 * Export for testing
 */
export { generateImageId, detectMediaType, articleToImageItems };
