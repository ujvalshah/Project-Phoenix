import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
// useNavigate removed - not currently used in this component
import { X, Globe, Lock, Loader2 } from 'lucide-react';
import { getInitials } from '@/utils/formatters';
import { storageService } from '@/services/storageService';
import { detectProviderFromUrl } from '@/utils/urlUtils';
import { queryClient } from '@/queryClient';
import { GenericLinkPreview } from './embeds/GenericLinkPreview';
import { Collection } from '@/types';
import { useAuth } from '@/hooks/useAuth';
// AI service removed - AI creation system has been fully removed
import { useToast } from '@/hooks/useToast';
import { compressImage, isImageFile, formatFileSize } from '@/utils/imageOptimizer';
import { unfurlUrl } from '@/services/unfurlService';
import type { NuggetMedia, MediaType } from '@/types';
import { formatApiError, getUserFriendlyMessage, logError } from '@/utils/errorHandler';
import { processNuggetUrl, detectUrlChanges, getPrimaryUrl } from '@/utils/processNuggetUrl';
import { useMediaUpload } from '@/hooks/useMediaUpload';
import { SourceSelector } from './shared/SourceSelector';
import { SourceBadge } from './shared/SourceBadge';
import { TagSelector } from './CreateNuggetModal/TagSelector';
import { CollectionSelector } from './CreateNuggetModal/CollectionSelector';
import { TitleInput } from './CreateNuggetModal/TitleInput';
import { ContentEditor } from './CreateNuggetModal/ContentEditor';
import { UrlInput } from './CreateNuggetModal/UrlInput';
import { AttachmentManager, FileAttachment } from './CreateNuggetModal/AttachmentManager';
import { FormFooter } from './CreateNuggetModal/FormFooter';
import { MasonryMediaToggle } from './CreateNuggetModal/MasonryMediaToggle';
import { UnifiedMediaManager, UnifiedMediaItem } from './CreateNuggetModal/UnifiedMediaManager';
import { ExternalLinksSection } from './CreateNuggetModal/ExternalLinksSection';
import { LayoutVisibilitySection } from './CreateNuggetModal/LayoutVisibilitySection';
import { MasonryMediaItem } from '@/utils/masonryMediaHelper';
import { classifyArticleMedia } from '@/utils/mediaClassifier';
import type { Article, ExternalLink, LayoutVisibility } from '@/types';
import { DEFAULT_LAYOUT_VISIBILITY } from '@/types';
import { normalizeArticleInput } from '@/shared/articleNormalization/normalizeArticleInput';
import { normalizeTags } from '@/shared/articleNormalization/normalizeTags';
import { useImageManager } from '@/hooks/useImageManager';
import { isFeatureEnabled } from '@/constants/featureFlags';
import { validateBeforeSave, formatValidationResult } from '@/shared/articleNormalization/preSaveValidation';
import { useTags, useAllCollections, nuggetFormKeys } from '@/hooks/useNuggetFormData';

interface CreateNuggetModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: 'create' | 'edit';
  initialData?: Article;
}

// FileAttachment is now imported from AttachmentManager

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB (before compression)
const MAX_FILE_SIZE_AFTER_COMPRESSION = 500 * 1024; // 500KB (after compression)

/**
 * PHASE 2: TITLE GENERATION POLICY (NON-NEGOTIABLE)
 * 
 * Title field is OPTIONAL.
 * The system must NEVER auto-add or auto-modify the title.
 * Title generation must happen ONLY when the user explicitly clicks a "Generate title" button.
 * 
 * Metadata may SUGGEST a title (stored in suggestedTitle state) but must NEVER mutate title state automatically.
 * 
 * REGRESSION SAFEGUARD: 
 * - isTitleUserEdited flag prevents metadata from overwriting user-edited titles
 * - No useEffect may write to title state
 * - Metadata title is stored in suggestedTitle, never directly in title
 * - Title is only populated when user clicks "Generate title" button
 */

export const CreateNuggetModal: React.FC<CreateNuggetModalProps> = ({ isOpen, onClose, mode = 'create', initialData }) => {
  // Auth
  const { currentUser, currentUserId, isAdmin } = useAuth();
  const authorName = currentUser?.name || 'User';
  const toast = useToast();

  // Unified image management hook (Phase 9: Legacy code removed)
  const imageManager = useImageManager(mode, initialData);
  
  // Store syncFromArticle in ref to avoid dependency on imageManager object
  // syncFromArticle is stable (useCallback with []), so ref update is safe
  const syncFromArticleRef = useRef(imageManager.syncFromArticle);
  syncFromArticleRef.current = imageManager.syncFromArticle; // Update ref on every render (function is stable)

  // Ref to track if form has been initialized from initialData (prevents re-initialization)
  const initializedFromDataRef = useRef<string | null>(null);
  
  // Ref to track previous URLs for change detection (CRITICAL for Edit mode)
  const previousUrlsRef = useRef<string[]>([]);

  // Content State
  const [title, setTitle] = useState('');
  const [_isTitleUserEdited, setIsTitleUserEdited] = useState(false); // eslint-disable-line @typescript-eslint/no-unused-vars -- PHASE 6: Safeguard flag for future use
  const [suggestedTitle, setSuggestedTitle] = useState<string | null>(null); // PHASE 3: Metadata suggests but never mutates
  const [content, setContent] = useState('');
  const [urls, setUrls] = useState<string[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [detectedLink, setDetectedLink] = useState<string | null>(null);
  const [linkMetadata, setLinkMetadata] = useState<NuggetMedia | null>(null);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
  const [customDomain, setCustomDomain] = useState<string | null>(null);
  
  // Metadata override flag: tracks when user explicitly edits caption/title in edit mode
  // This allows intentional overrides of YouTube titles and other metadata
  const [allowMetadataOverride, setAllowMetadataOverride] = useState(false);
  
  // Attachments
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pastedImagesBufferRef = useRef<File[]>([]);
  const pasteBatchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Image state managed by useImageManager hook (Phase 9: Legacy code removed)
  const existingImages = imageManager.existingImages;
  const masonryMediaItems = imageManager.masonryItems;
  
  // Media upload hook
  const mediaUpload = useMediaUpload({ purpose: 'nugget' });
  
  // Refs for accessibility and focus management
  const modalRef = useRef<HTMLDivElement>(null);
  const tagsComboboxRef = useRef<HTMLDivElement>(null);
  const tagsListboxRef = useRef<HTMLDivElement>(null);
  const collectionsComboboxRef = useRef<HTMLDivElement>(null);
  const collectionsListboxRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  // Metadata State
  // CATEGORY PHASE-OUT: Removed categories state - using tags only
  const [tags, setTags] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  
  // Identity State (Admin Only)
  const [postAs, setPostAs] = useState<'me' | 'alias'>('me');
  const [selectedAlias, setSelectedAlias] = useState('');
  const [customAlias, setCustomAlias] = useState('');
  const [availableAliases, setAvailableAliases] = useState<string[]>([]);
  
  // Admin-only: Custom creation date
  const [customCreatedAt, setCustomCreatedAt] = useState<string>('');

  // External Links State (NEW - Separated from media URLs)
  const [externalLinks, setExternalLinks] = useState<ExternalLink[]>([]);

  // Display Image Selection State (V2 - Thumbnail selection)
  // Tracks which media item is selected as the card thumbnail
  // null = use first item (default behavior)
  const [displayImageId, setDisplayImageId] = useState<string | null>(null);

  // Layout Visibility State (NEW - Control which layouts display this nugget)
  const [layoutVisibility, setLayoutVisibility] = useState<LayoutVisibility>({
    grid: true,
    masonry: true,
    utility: true,
    feed: true,
  });

  // Explicitly deleted images tracked by useImageManager hook (Phase 9: Legacy code removed)
  const explicitlyDeletedImages = imageManager.explicitlyDeletedUrls;
  
  // Data Source State - Now using React Query for caching and automatic refetch
  // CATEGORY PHASE-OUT: Renamed availableCategories to availableTags
  // Note: queryClient is imported from @/queryClient (singleton instance)

  const {
    data: availableTags = [],
    isLoading: _isLoadingTags, // eslint-disable-line @typescript-eslint/no-unused-vars -- Available for future loading state UI
  } = useTags();

  const {
    data: allCollections = [],
    isLoading: _isLoadingCollections, // eslint-disable-line @typescript-eslint/no-unused-vars -- Available for future loading state UI
  } = useAllCollections();

  /**
   * Callback to optimistically update the tags cache when a new tag is created.
   * This is called by TagSelector after it creates a new tag via storageService.
   * The callback updates the React Query cache immediately for instant UI feedback.
   */
  const handleAvailableTagsChange = React.useCallback((newTags: string[]) => {
    queryClient.setQueryData<string[]>(nuggetFormKeys.tags(), newTags);
  }, []); // queryClient is a module-level singleton, no need in deps

  /**
   * Callback to optimistically update the collections cache when a new collection is created.
   * This is called by CollectionSelector after it creates a new collection via storageService.
   * The callback updates the React Query cache immediately for instant UI feedback.
   */
  const handleAvailableCollectionsChange = React.useCallback((newCollections: Collection[]) => {
    queryClient.setQueryData<Collection[]>(nuggetFormKeys.collections(), newCollections);
  }, []); // queryClient is a module-level singleton, no need in deps
  
  // UI State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [_isLoading, setIsLoading] = useState(false); // eslint-disable-line @typescript-eslint/no-unused-vars
  // AI loading state removed - AI creation system has been fully removed
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; fileName: string } | null>(null);
  
  // Field-level validation states
  const [tagsError, setTagsError] = useState<string | null>(null);
  const [contentError, setContentError] = useState<string | null>(null);
  const [tagsTouched, setTagsTouched] = useState(false);
  const [contentTouched, setContentTouched] = useState(false);

  // Store previous active element for focus restoration
  useEffect(() => {
    if (isOpen) {
      previousActiveElementRef.current = document.activeElement as HTMLElement;
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      // Data loading is now handled by React Query hooks (useTags, useAllCollections)
      // No need to call loadData() - React Query provides caching and automatic refetch
      document.body.style.overflow = 'hidden';
      
      // Initialize form from initialData when in edit mode (only once per nugget)
      if (mode === 'edit' && initialData && initializedFromDataRef.current !== initialData.id) {
        setTitle(initialData.title || '');
        setIsTitleUserEdited(!!initialData.title); // PHASE 6: Mark as edited if title exists
        setSuggestedTitle(null); // PHASE 3: Clear suggestion in edit mode
        setContent(initialData.content || '');
        // CATEGORY PHASE-OUT: Use tags instead of categories
        setTags(initialData.tags || []);
        // Initialize customCreatedAt if article has isCustomCreatedAt flag (admin only)
        if (isAdmin && (initialData as any).isCustomCreatedAt && initialData.publishedAt) {
          // Convert ISO string to datetime-local format (YYYY-MM-DDTHH:mm)
          const date = new Date(initialData.publishedAt);
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          setCustomCreatedAt(`${year}-${month}-${day}T${hours}:${minutes}`);
        }
        setVisibility(initialData.visibility || 'public');
        // Initialize externalLinks and layoutVisibility from initialData
        setExternalLinks(initialData.externalLinks || []);
        setLayoutVisibility(initialData.layoutVisibility || {
          grid: true,
          masonry: true,
          utility: true,
          feed: true,
        });

        // V2: displayImageId will be initialized in a separate effect after masonryMediaItems loads
        // This ensures we use the actual item ID from imageManager (not a mismatched generated one)

        // Extract URLs from media - collect all unique source URLs
        // Priority: previewMetadata.url (original source) > media.url (if different and not Cloudinary)
        const isCloudinaryUrl = (url: string) => url.includes('cloudinary.com') || url.includes('res.cloudinary');
        const contentUrls: string[] = [];

        // 1. Original source URL (from unfurl metadata) - highest priority
        if (initialData.media?.previewMetadata?.url) {
          contentUrls.push(initialData.media.previewMetadata.url);
        }

        // 2. media.url if different from previewMetadata.url and not a Cloudinary URL
        if (initialData.media?.url) {
          const mediaUrl = initialData.media.url;
          const isDifferent = mediaUrl !== initialData.media?.previewMetadata?.url;
          const notCloudinary = !isCloudinaryUrl(mediaUrl);
          const notAlreadyIncluded = !contentUrls.includes(mediaUrl);

          if (isDifferent && notCloudinary && notAlreadyIncluded) {
            contentUrls.push(mediaUrl);
          }
        }

        setUrls(contentUrls);
        previousUrlsRef.current = contentUrls; // Track initial URLs for change detection

        // Set detected link to first content URL for preview
        const primaryUrl = contentUrls.length > 0 ? contentUrls[0] : null;
        if (primaryUrl) {
          setDetectedLink(primaryUrl);
          if (initialData.media) {
            setLinkMetadata(initialData.media);
          }
        } else {
          setDetectedLink(null);
          setLinkMetadata(null);
        }
        
        // Note: We don't pre-fill attachments or collections in edit mode
        // as they require file objects and collection membership is separate
        // MediaIds are preserved from initialData and will be included in update
        
        // Sync imageManager with article data (Phase 9: Legacy code removed)
        imageManager.syncFromArticle(initialData);
        
        initializedFromDataRef.current = initialData.id;
      } else if (mode === 'create') {
        // Reset initialization ref when switching to create mode
        initializedFromDataRef.current = null;
      }
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen, mode, initialData]);

  // Sync imageManager when initialData changes (for edit mode)
  // This ensures the hook stays in sync if the article data is updated externally
  // FIX: Use ref to track last synced article ID to prevent infinite loops
  const lastSyncedArticleIdRef = useRef<string | null>(null);
  
  useEffect(() => {
    if (mode === 'edit' && initialData) {
      const articleId = initialData.id;
      
      // Only sync if:
      // 1. We've already initialized this article (to avoid double initialization)
      // 2. This is a different article than last synced (prevents loops)
      if (initializedFromDataRef.current === articleId && 
          lastSyncedArticleIdRef.current !== articleId) {
        syncFromArticleRef.current(initialData);
        lastSyncedArticleIdRef.current = articleId;
      }
    } else if (mode === 'create') {
      // Reset on create mode
      lastSyncedArticleIdRef.current = null;
    }
  }, [mode, initialData?.id]); // Only depend on stable primitive values, not objects

  // V2: Initialize displayImageId from displayImageIndex once masonryMediaItems is populated
  // This effect runs after imageManager syncs and masonryMediaItems are available
  const displayImageIdInitializedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isFeatureEnabled('NUGGET_EDITOR_V2')) return;
    if (mode !== 'edit' || !initialData) return;
    if (initialData.displayImageIndex === undefined) return;
    if (masonryMediaItems.length === 0) return;

    // Only initialize once per article to avoid overwriting user selections
    if (displayImageIdInitializedRef.current === initialData.id) return;

    // Find the item at the saved displayImageIndex and use its actual ID
    const targetItem = masonryMediaItems[initialData.displayImageIndex];
    if (targetItem) {
      setDisplayImageId(targetItem.id);
      displayImageIdInitializedRef.current = initialData.id;
    }
  }, [mode, initialData, masonryMediaItems]);

  // Focus trap and initial focus when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const modal = modalRef.current;
    if (!modal) return;

    // Focus first focusable element after a short delay to allow DOM to settle
    const timer = setTimeout(() => {
      const firstFocusable = modal.querySelector(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ) as HTMLElement;
      firstFocusable?.focus();
    }, 100);

    // Focus trap handler
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      // Tab handling is managed by SelectableDropdown components

      const focusableElements = modal.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    // Handle Escape key - dropdowns handle their own Escape, this handles modal close
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Check if focus is in a dropdown (listbox)
        const activeElement = document.activeElement;
        const isInDropdown = activeElement?.closest('[role="listbox"]');
        if (!isInDropdown) {
          handleClose();
        }
      }
    };

    modal.addEventListener('keydown', handleTab);
    document.addEventListener('keydown', handleEscape);
    return () => {
      clearTimeout(timer);
      modal.removeEventListener('keydown', handleTab);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  // loadData function removed - now using React Query hooks (useTags, useAllCollections)
  // which provide automatic caching, background refetch, and stale-while-revalidate pattern.
  // This eliminates the need for manual data fetching on every modal open.

  // Initialize aliases (content aliases feature not yet implemented)
  useEffect(() => {
    if (isOpen) {
      setAvailableAliases([]);
      setSelectedAlias("Custom...");
    }
  }, [isOpen]);

  const resetForm = () => {
    setTitle('');
    setIsTitleUserEdited(false);
    setSuggestedTitle(null);
    setContent('');
    setUrls([]);
    setUrlInput('');
    setDetectedLink(null);
    setLinkMetadata(null);
    setAttachments([]);
    setTags([]);
    setVisibility('public');
    setSelectedCollections([]);
    // categoryInput and collectionInput are now managed by components
    setPostAs('me');
    setCustomAlias('');
    setCustomDomain(null);
    setCustomCreatedAt('');
    setError(null);
    setIsLoading(false);
    // Reset field-level validation states
    setTagsError(null);
    setContentError(null);
    setTagsTouched(false);
    setContentTouched(false);
    // Reset initialization ref
    initializedFromDataRef.current = null;
    // Reset previous URLs tracking
    previousUrlsRef.current = [];
    // Reset externalLinks and layoutVisibility
    setExternalLinks([]);
    setLayoutVisibility({
      grid: true,
      masonry: true,
      utility: true,
      feed: true,
    });
  };

  const handleClose = () => {
    resetForm();
    // Restore focus to previous active element
    if (previousActiveElementRef.current) {
      previousActiveElementRef.current.focus();
      previousActiveElementRef.current = null;
    }
    onClose();
  };

  /**
   * UNIFIED URL + METADATA PROCESSING
   * 
   * This effect handles URL changes for BOTH Create and Edit modes.
   * It detects URL changes and triggers metadata fetching using the shared processNuggetUrl utility.
   * 
   * CRITICAL: This ensures parity between Create and Edit workflows.
   */
  useEffect(() => {
    // Detect URL changes (works for both create and edit)
    const urlChanges = detectUrlChanges(previousUrlsRef.current, urls);
    const primaryUrl = getPrimaryUrl(urls);
    
    // Update previous URLs for next comparison
    previousUrlsRef.current = [...urls];
    
    // If primary URL changed or was added, fetch metadata
    if (primaryUrl && (primaryUrl !== detectedLink || urlChanges.primaryUrlChanged)) {
      setDetectedLink(primaryUrl);
      setCustomDomain(null);
      setIsLoadingMetadata(true);
      
      // Use shared processNuggetUrl function (SINGLE SOURCE OF TRUTH)
      processNuggetUrl(primaryUrl, {
        cancelKey: `nugget-url-${primaryUrl}`,
      })
        .then((metadata) => {
          if (metadata) {
            setLinkMetadata(metadata);
            
            // FIX: Completely disable auto-title suggestions for YouTube/social networks
            // User explicitly requested no auto-title functionality for these platforms
            // Check if this is a YouTube or social network URL
            const isYouTubeOrSocial = primaryUrl && (
              primaryUrl.includes('youtube.com') || 
              primaryUrl.includes('youtu.be') ||
              primaryUrl.includes('facebook.com') ||
              primaryUrl.includes('threads.net') ||
              primaryUrl.includes('reddit.com')
            );
            
            // Do NOT store suggestedTitle for YouTube/social networks
            if (isYouTubeOrSocial) {
              setSuggestedTitle(null);
            } else if (metadata.previewMetadata?.title) {
              const metaTitle = metadata.previewMetadata.title.trim();
              // Skip if title is just a domain or URL pattern
              const isBadTitle = metaTitle.match(/^(https?:\/\/|www\.|Content from|content from)/i) ||
                                metaTitle.match(/^[a-z0-9-]+\.[a-z]{2,}$/i) || // Just domain
                                metaTitle.length < 3; // Too short
              if (!isBadTitle) {
                setSuggestedTitle(metaTitle);
                // CRITICAL: DO NOT call setTitle() here - title must remain empty until user clicks button
              } else {
                setSuggestedTitle(null);
              }
            } else {
              setSuggestedTitle(null);
            }
          } else {
            setLinkMetadata(null);
            setSuggestedTitle(null);
          }
        })
        .catch((error) => {
          console.error('[CreateNuggetModal] Failed to fetch link metadata:', error);
          setLinkMetadata(null);
          setSuggestedTitle(null);
        })
        .finally(() => {
          setIsLoadingMetadata(false);
        });
    } else if (!primaryUrl && detectedLink) {
      // No URLs that need metadata, clear link metadata
      setDetectedLink(null);
      setLinkMetadata(null);
      setSuggestedTitle(null);
      setCustomDomain(null);
    } else if (primaryUrl && primaryUrl === detectedLink && !linkMetadata && !isLoadingMetadata) {
      // Edge case: URL exists but metadata wasn't fetched (e.g., during initialization)
      // Re-fetch metadata to ensure we have it
      setIsLoadingMetadata(true);
      processNuggetUrl(primaryUrl, {
        cancelKey: `nugget-url-${primaryUrl}`,
      })
        .then((metadata) => {
          if (metadata) {
            setLinkMetadata(metadata);
          }
        })
        .catch((error) => {
          console.error('[CreateNuggetModal] Failed to re-fetch metadata:', error);
        })
        .finally(() => {
          setIsLoadingMetadata(false);
        });
    }
  }, [urls, detectedLink, linkMetadata, isLoadingMetadata]);

  // Parse multiple URLs from text (separated by newlines, spaces, commas, etc.)
  const parseMultipleUrls = (text: string): string[] => {
    // Split by common delimiters: newlines, spaces, commas, tabs
    const separators = /\s+|,|\n|\r\n|\r|\t/;
    const parts = text.split(separators);
    
    const validUrls: string[] = [];
    const errors: string[] = [];
    
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      
      // Try to validate as URL
      try {
        // Add protocol if missing
        let urlToValidate = trimmed;
        if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
          urlToValidate = `https://${trimmed}`;
        }
        
        new URL(urlToValidate);
        const finalUrl = trimmed.startsWith('http://') || trimmed.startsWith('https://') 
          ? trimmed 
          : urlToValidate;
        
        // Add if not already in list
        if (!urls.includes(finalUrl) && !validUrls.includes(finalUrl)) {
          validUrls.push(finalUrl);
        }
      } catch {
        // Invalid URL, skip it
        errors.push(trimmed);
      }
    }
    
    if (errors.length > 0 && validUrls.length === 0) {
      setError(`Could not parse any valid URLs from: ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '...' : ''}`);
    } else if (errors.length > 0 && validUrls.length > 0) {
      // Show warning if some URLs were invalid but some were valid
      toast.warning(`Added ${validUrls.length} URL(s). ${errors.length} invalid URL(s) skipped.`);
    }
    
    return validUrls;
  };

  const addUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    
    // Check if input contains multiple URLs (has newlines or multiple URLs)
    const hasMultipleUrls = trimmed.includes('\n') || 
                           trimmed.includes('\r') || 
                           trimmed.split(/\s+|,/).filter(p => p.trim().length > 0).length > 1;
    
    if (hasMultipleUrls) {
      // Parse multiple URLs
      const parsedUrls = parseMultipleUrls(trimmed);
      if (parsedUrls.length > 0) {
        // CRITICAL FIX: Deduplicate URLs before adding (normalized comparison)
        const normalizedUrls = urls.map(u => {
          try {
            let normalized = u.toLowerCase().trim();
            if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
              normalized = `https://${normalized}`;
            }
            return normalized;
          } catch {
            return u.toLowerCase().trim();
          }
        });
        
        const uniqueUrls = parsedUrls.filter(url => {
          try {
            let normalized = url.toLowerCase().trim();
            if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
              normalized = `https://${normalized}`;
            }
            return !normalizedUrls.includes(normalized);
          } catch {
            return !urls.includes(url); // Fallback to exact match
          }
        });
        
        if (uniqueUrls.length > 0) {
          setUrls([...urls, ...uniqueUrls]);
          setUrlInput('');
          if (!contentTouched) setContentTouched(true);
          // Clear content error immediately when URL is added
          if (contentError) {
            const error = validateContent();
            setContentError(error);
          }
          if (uniqueUrls.length > 1) {
            toast.success(`Added ${uniqueUrls.length} URLs`);
          } else if (uniqueUrls.length < parsedUrls.length) {
            toast.warning(`Added ${uniqueUrls.length} URL(s). ${parsedUrls.length - uniqueUrls.length} duplicate(s) skipped.`);
          }
        } else {
          toast.warning('All URLs are already added');
        }
      }
    } else {
      // Single URL - CRITICAL FIX: Prevent duplicates
      try {
        // Add protocol if missing
        let urlToValidate = trimmed;
        if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
          urlToValidate = `https://${trimmed}`;
        }
        
        new URL(urlToValidate);
        const finalUrl = trimmed.startsWith('http://') || trimmed.startsWith('https://') 
          ? trimmed 
          : urlToValidate;
        
        // Check for duplicates (case-insensitive URL comparison)
        // Also check against existing images in edit mode
        const normalizedUrls = urls.map(u => {
          try {
            let normalized = u.toLowerCase().trim();
            if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
              normalized = `https://${normalized}`;
            }
            return normalized;
          } catch {
            return u.toLowerCase().trim();
          }
        });
        
        // In edit mode, also check against existing images
        const normalizedExistingImages = mode === 'edit' && initialData
          ? (initialData.images || []).map((img: string) => {
              try {
                let normalized = img.toLowerCase().trim();
                if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
                  normalized = `https://${normalized}`;
                }
                return normalized;
              } catch {
                return img.toLowerCase().trim();
              }
            })
          : [];
        
        const normalizedFinalUrl = (() => {
          let normalized = finalUrl.toLowerCase().trim();
          if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
            normalized = `https://${normalized}`;
          }
          return normalized;
        })();
        
        const isDuplicate = normalizedUrls.includes(normalizedFinalUrl) || 
                           normalizedExistingImages.includes(normalizedFinalUrl);
        
        if (!isDuplicate) {
          setUrls([...urls, finalUrl]);
          setUrlInput('');
          if (!contentTouched) setContentTouched(true);
          // Clear content error immediately when URL is added
          if (contentError) {
            const error = validateContent();
            setContentError(error);
          }
        } else {
          toast.warning('This URL is already added');
        }
      } catch {
        setError('Please enter a valid URL');
      }
    }
  };

  const handleUrlPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData('text');
    
    // Check if pasted text looks like multiple URLs
    const hasMultipleUrls = pastedText.includes('\n') || 
                           pastedText.includes('\r') || 
                           pastedText.split(/\s+|,/).filter(p => p.trim().length > 0 && (p.includes('.') || p.startsWith('http'))).length > 1;
    
    if (hasMultipleUrls) {
      e.preventDefault();
      const parsedUrls = parseMultipleUrls(pastedText);
      if (parsedUrls.length > 0) {
        // CRITICAL FIX: Deduplicate URLs before adding
        const normalizedUrls = urls.map(u => u.toLowerCase().trim());
        const uniqueUrls = parsedUrls.filter(url => {
          try {
            // Normalize URL for comparison
            let urlToCheck = url.trim();
            if (!urlToCheck.startsWith('http://') && !urlToCheck.startsWith('https://')) {
              urlToCheck = `https://${urlToCheck}`;
            }
            const normalized = urlToCheck.toLowerCase().trim();
            return !normalizedUrls.includes(normalized);
          } catch {
            return true; // Invalid URL, let addUrl handle it
          }
        });
        
        if (uniqueUrls.length > 0) {
          setUrls([...urls, ...uniqueUrls]);
          setUrlInput('');
          if (!contentTouched) setContentTouched(true);
          if (uniqueUrls.length < parsedUrls.length) {
            toast.warning(`Added ${uniqueUrls.length} URL(s). ${parsedUrls.length - uniqueUrls.length} duplicate(s) skipped.`);
          } else {
            toast.success(`Added ${uniqueUrls.length} URLs`);
          }
        } else {
          toast.warning('All URLs are already added');
        }
      }
    }
    // If not multiple URLs, allow default paste behavior
  };

  const removeUrl = (urlToRemove: string) => {
    setUrls(urls.filter(u => u !== urlToRemove));
    if (!contentTouched) setContentTouched(true);
    // Validate content when URL is removed
    if (contentTouched) {
      const error = validateContent();
      setContentError(error);
    }
  };

  // Delete an existing image from the article (edit mode only)
  const deleteImage = async (imageUrl: string) => {
    if (mode !== 'edit' || !initialData) {
      console.warn('[CreateNuggetModal] deleteImage called but not in edit mode or missing initialData');
      return;
    }

    // Confirm deletion
    if (!window.confirm('Are you sure you want to delete this image?')) {
      return;
    }

    // Delete image via imageManager (Phase 9: Legacy code removed)
    imageManager.deleteImage(imageUrl);

    try {
      const { apiClient } = await import('@/services/apiClient');
      await (apiClient as unknown as { request: (url: string, options: Record<string, unknown>) => Promise<{ success: boolean; message: string; images: string[] }> }).request(
        `/articles/${initialData.id}/images`,
        {
          method: 'DELETE',
          body: JSON.stringify({ imageUrl }),
          headers: { 'Content-Type': 'application/json' },
          cancelKey: `delete-image-${initialData.id}`,
        }
      );

      // Confirm deletion via imageManager
      imageManager.confirmDeletion(imageUrl);
      toast.success('Image deleted successfully');

      // Invalidate query cache
      queryClient.invalidateQueries({ queryKey: ['article', initialData.id] });
      queryClient.invalidateQueries({ queryKey: ['articles'] });
    } catch (error: any) {
      console.error('[CreateNuggetModal] Failed to delete image:', error);
      // Rollback via imageManager
      imageManager.rollbackDeletion(imageUrl);
      toast.error(error.message || 'Failed to delete image. Please try again.');
    }
  };

  // addCategory and toggleCollection are now handled by TagSelector and CollectionSelector components

  // Field-level validation functions
  // Use shared normalization to ensure consistency
  const validateTags = (): string | null => {
    // Use shared normalizeTags utility for consistency
    const normalizedTags = normalizeTags(tags);
    if (normalizedTags.length === 0) {
      return "Please add at least one tag. Tags enable smarter news discovery.";
    }
    return null;
  };

  const validateContent = (): string | null => {
    const hasContent = content.trim() || title.trim();
    const hasUrl = urls.length > 0;
    const hasAttachment = attachments.length > 0;
    
    if (!hasContent && !hasUrl && !hasAttachment) {
      return "Please add some content, a URL, or an attachment to create a nugget.";
    }
    return null;
  };

  // Validate tags when tags change (if touched)
  useEffect(() => {
    if (tagsTouched) {
      const error = validateTags();
      setTagsError(error);
    }
  }, [tags, tagsTouched]);

  // Validate content when relevant fields change (if touched)
  useEffect(() => {
    if (contentTouched) {
      const error = validateContent();
      setContentError(error);
    }
  }, [content, title, urls, attachments, contentTouched]);

  // Cleanup paste batch timeout on unmount
  useEffect(() => {
    return () => {
      if (pasteBatchTimeoutRef.current) {
        clearTimeout(pasteBatchTimeoutRef.current);
      }
    };
  }, []);

  // Keyboard navigation handlers are now in SelectableDropdown component

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;

      const totalFiles = files.length;
      const newAttachments: FileAttachment[] = [];
      
      try {
          for (let i = 0; i < files.length; i++) {
              const file = files[i];
              
              // Update progress indicator
              setUploadProgress({ current: i + 1, total: totalFiles, fileName: file.name });
              
              if (file.type.match(/(application\/x-msdownload|application\/x-sh|text\/javascript)/)) {
                  setError("Script/Executable files are not allowed.");
                  continue;
              }
              if (file.size > MAX_FILE_SIZE) {
                  setError(`File "${file.name}" exceeds ${formatFileSize(MAX_FILE_SIZE)} limit.`);
                  continue;
              }
              
              const isImage = isImageFile(file);
              let processedFile = file;
              
              // Compress images before upload (for preview only, actual upload uses original)
              if (isImage) {
                  try {
                      processedFile = await compressImage(file);
                      
                      // Double-check size after compression
                      if (processedFile.size > MAX_FILE_SIZE_AFTER_COMPRESSION) {
                          setError(`Image "${file.name}" is still too large after compression. Please use a smaller image.`);
                          continue;
                      }
                  } catch (compressionError) {
                      console.error('Image compression failed:', compressionError);
                      setError(`Failed to compress "${file.name}". Using original file.`);
                      // Fall back to original file if compression fails
                  }
              }
              
              // Create temporary preview attachment
              const attachment: FileAttachment = {
                  file: processedFile,
                  previewUrl: URL.createObjectURL(processedFile), // Temporary preview only
                  type: isImage ? 'image' : 'document',
                  isUploading: isImage, // Only upload images to Cloudinary
              };
              
              newAttachments.push(attachment);
              
              // Upload image to Cloudinary immediately
              if (isImage) {
                  try {
                      const uploadResult = await mediaUpload.upload(file); // Use original file for upload
                      if (uploadResult) {
                          // Update attachment with mediaId and secureUrl
                          attachment.mediaId = uploadResult.mediaId;
                          attachment.secureUrl = uploadResult.secureUrl;
                          attachment.isUploading = false;
                      } else {
                          attachment.uploadError = mediaUpload.error || 'Upload failed';
                          attachment.isUploading = false;
                          console.error('[CreateNuggetModal] Image upload failed:', mediaUpload.error);
                      }
                  } catch (uploadError: any) {
                      console.error('[CreateNuggetModal] Image upload error:', uploadError);
                      attachment.uploadError = uploadError.message || 'Upload failed';
                      attachment.isUploading = false;
                  }
              }
          }
          
          setAttachments(prev => [...prev, ...newAttachments]);
          setError(null);
          if (!contentTouched) setContentTouched(true);
          // Clear content error immediately when attachment is added
          if (contentError) {
            const error = validateContent();
            setContentError(error);
          }
      } catch (error) {
          console.error('File upload error:', error);
          setError('Failed to process files. Please try again.');
      } finally {
          setUploadProgress(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
      }
  };

  // removeAttachment is now handled by AttachmentManager component
  // CRITICAL: convertFileToBase64 removed - Base64 storage is FORBIDDEN

  // Handle Masonry media toggle
  const handleMasonryMediaToggle = (itemId: string, showInMasonry: boolean) => {
    // Delegate to imageManager (Phase 9: Legacy code removed)
    // Try to find by ID first
    let item = masonryMediaItems.find(m => m.id === itemId);

    // If not found, try to find by URL (fallback for edge cases)
    if (!item) {
      // itemId might be a URL in some cases
      item = masonryMediaItems.find(m => m.url === itemId || m.id === itemId);
    }

    if (item?.url) {
      imageManager.toggleMasonry(item.url, showInMasonry);
    } else {
      console.warn('[MasonryToggle] Could not find item to toggle:', itemId, {
        availableItems: masonryMediaItems.map(m => ({ id: m.id, url: m.url })),
      });
    }
  };

  // Handle Grid media toggle (NEW)
  const handleGridMediaToggle = (itemId: string, showInGrid: boolean) => {
    let item = masonryMediaItems.find(m => m.id === itemId);
    if (!item) {
      item = masonryMediaItems.find(m => m.url === itemId || m.id === itemId);
    }
    if (item?.url) {
      // TODO: Implement imageManager.toggleGrid() when backend support is ready
      console.log('[GridToggle] Grid visibility:', itemId, showInGrid);
    }
  };

  // Handle Utility media toggle (NEW)
  const handleUtilityMediaToggle = (itemId: string, showInUtility: boolean) => {
    let item = masonryMediaItems.find(m => m.id === itemId);
    if (!item) {
      item = masonryMediaItems.find(m => m.url === itemId || m.id === itemId);
    }
    if (item?.url) {
      // TODO: Implement imageManager.toggleUtility() when backend support is ready
      console.log('[UtilityToggle] Utility visibility:', itemId, showInUtility);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // EXTERNAL LINKS HANDLERS (NEW)
  // ═══════════════════════════════════════════════════════════════════════════

  const handleAddExternalLink = (url: string) => {
    const newLink: ExternalLink = {
      id: `link-${Date.now()}`,
      url,
      isPrimary: externalLinks.length === 0, // First link is primary
      domain: (() => {
        try {
          return new URL(url).hostname.replace('www.', '');
        } catch {
          return url;
        }
      })(),
      addedAt: new Date().toISOString(),
    };
    setExternalLinks(prev => [...prev, newLink]);
  };

  const handleRemoveExternalLink = (linkId: string) => {
    setExternalLinks(prev => {
      const remaining = prev.filter(l => l.id !== linkId);
      // If we removed the primary, make the first remaining link primary
      if (remaining.length > 0 && !remaining.some(l => l.isPrimary)) {
        remaining[0] = { ...remaining[0], isPrimary: true };
      }
      return remaining;
    });
  };

  const handleSetPrimaryLink = (linkId: string) => {
    setExternalLinks(prev => prev.map(l => ({
      ...l,
      isPrimary: l.id === linkId,
    })));
  };

  const handleUpdateLinkLabel = (linkId: string, label: string) => {
    setExternalLinks(prev => prev.map(l =>
      l.id === linkId ? { ...l, label } : l
    ));
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // MEDIA SECTION HANDLERS (NEW - Unified media management)
  // ═══════════════════════════════════════════════════════════════════════════

  // Convert masonryMediaItems to UnifiedMediaItem format
  // V2: Uses displayImageId state for thumbnail selection
  // V1: Falls back to first item (index === 0)
  const unifiedMediaItems: UnifiedMediaItem[] = masonryMediaItems.map((item, index) => ({
    id: item.id,
    url: item.url,
    type: item.type,
    thumbnail: item.thumbnail,
    // V2: Use displayImageId state if set, otherwise default to first item
    isDisplayImage: isFeatureEnabled('NUGGET_EDITOR_V2')
      ? (displayImageId ? item.id === displayImageId : index === 0)
      : index === 0,
    showInMasonry: item.showInMasonry,
    showInGrid: true, // Default to true (show in grid by default)
    showInUtility: true, // Default to true (show in utility by default)
    masonryTitle: item.masonryTitle,
    previewMetadata: item.previewMetadata,
  }));

  /**
   * Handle display image (thumbnail) selection
   * V2: Updates displayImageId state to track user selection
   * V1: Only logs (no-op)
   */
  const handleSetDisplayImage = (itemId: string | null) => {
    if (isFeatureEnabled('NUGGET_EDITOR_V2')) {
      setDisplayImageId(itemId);
      console.log('[MediaSection] Display image changed:', itemId || '(reset to default)');
    } else {
      // V1: Just log, no action
      console.log('[MediaSection] Set display image:', itemId);
    }
  };

  const handleDeleteMedia = (itemId: string) => {
    const item = masonryMediaItems.find(m => m.id === itemId);
    if (item?.url) {
      imageManager.deleteImage(item.url);
    }
  };

  /**
   * V2: Handle media reordering (drag-and-drop or arrow buttons)
   */
  const handleReorderMedia = (sourceIndex: number, destinationIndex: number) => {
    if (isFeatureEnabled('NUGGET_EDITOR_V2')) {
      imageManager.reorderImages(sourceIndex, destinationIndex);
    }
  };

  /**
   * Enrich media item with previewMetadata if missing
   * Reuses the same enrichment pipeline (unfurlUrl) used when media is initially added
   * Only enriches when previewMetadata is missing to preserve existing data
   * 
   * 🔧 ROOT CAUSE FIX: For image URLs, always create minimal previewMetadata even if unfurl fails
   * This ensures items marked for Masonry always have previewMetadata (required for rendering)
   */
  const enrichMediaItemIfNeeded = async (mediaItem: any): Promise<any> => {
    // If previewMetadata already exists, return unchanged
    if (mediaItem.previewMetadata) {
      return mediaItem;
    }
    
    // Only enrich if URL exists
    if (!mediaItem.url) {
      return mediaItem;
    }
    
    // Try to enrich via unfurl API
    try {
      const enrichedMetadata = await unfurlUrl(mediaItem.url);
      if (enrichedMetadata && enrichedMetadata.previewMetadata) {
        return {
          ...mediaItem,
          previewMetadata: enrichedMetadata.previewMetadata,
          // Preserve type if already set, otherwise use enriched type
          type: mediaItem.type || enrichedMetadata.type,
          // Preserve thumbnail if already set (handle both thumbnail and thumbnail_url), otherwise use enriched thumbnail
          thumbnail: mediaItem.thumbnail || enrichedMetadata.thumbnail_url,
          thumbnail_url: mediaItem.thumbnail_url || enrichedMetadata.thumbnail_url,
          aspect_ratio: mediaItem.aspect_ratio || enrichedMetadata.aspect_ratio,
        };
      }
    } catch (error) {
      console.warn(`[CreateNuggetModal] Failed to enrich media item ${mediaItem.url}:`, error);
    }
    
    // 🔧 ROOT CAUSE FIX: If enrichment failed but this is an image URL, create minimal previewMetadata
    // This ensures items marked for Masonry always have previewMetadata (required for rendering)
    // CRITICAL: Only create minimal metadata for image types to avoid polluting non-image URLs
    const isImageType = mediaItem.type === 'image' || 
                        (mediaItem.url && (mediaItem.url.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i) || 
                                          mediaItem.url.includes('cloudinary.com') ||
                                          mediaItem.url.includes('images.ctfassets.net')));
    
    if (isImageType) {
      const minimalMetadata = {
        url: mediaItem.url,
        imageUrl: mediaItem.url, // For images, imageUrl is the same as url
        mediaType: 'image',
      };
      
      return {
        ...mediaItem,
        previewMetadata: minimalMetadata,
        // Ensure type is set
        type: mediaItem.type || 'image',
      };
    }
    
    // For non-image URLs where enrichment failed, return unchanged
    // (They might not need previewMetadata if not marked for Masonry)
    return mediaItem;
  };

  // Handle Masonry tile title change
  // When user edits masonryTitle (caption), set allowMetadataOverride flag
  // This allows intentional overrides of YouTube titles and other metadata
  const handleMasonryTitleChange = (itemId: string, title: string) => {
    // Delegate to imageManager (Phase 9: Legacy code removed)
    const item = masonryMediaItems.find(m => m.id === itemId);
    if (item?.url) {
      imageManager.setMasonryTitle(item.url, title);
    }
    // User explicitly edited caption → allow metadata override
    if (mode === 'edit') {
      setAllowMetadataOverride(true);
    }
  };

  /**
   * ============================================================================
   * ROOT CAUSE ANALYSIS: Masonry Options Missing in Create Mode
   * ============================================================================
   * 
   * PROBLEM:
   * - MasonryMediaToggle was conditionally rendered only when mode === 'edit'
   * - masonryMediaItems was only populated in Edit mode from initialData
   * - In Create mode, masonryMediaItems remained empty, so options never appeared
   * 
   * SOLUTION:
   * - Populate masonryMediaItems in Create mode from attachments and URLs
   * - Remove mode === 'edit' condition to show options in both modes
   * 
   * CREATE MODE DEFAULT BEHAVIOR:
   * - Primary media: showInMasonry: true (selected by default), isLocked: false (can be unselected)
   * - Supporting media: showInMasonry: false (opt-in)
   * - If user unselects primary media, nugget won't appear in Masonry (no fallback)
   * 
   * EDIT MODE BEHAVIOR:
   * - Respects whatever values are stored in the DB
   * - Does not override existing showInMasonry values
   * 
   * BACKWARD COMPATIBILITY:
   * - Existing nuggets with showInMasonry: true continue to display normally
   * - Edit mode preserves existing DB values
   * ============================================================================
   */

  // Populate masonryMediaItems in Create mode from attachments and URLs
  // FIX: Sync images to imageManager so toggles work and persist
  useEffect(() => {
    // Only populate in Create mode (Edit mode uses collectMasonryMediaItems from initialData)
    if (mode !== 'create') return;

    // Clear existing images first (reset when attachments/URLs change)
    imageManager.clearAll();
    
    // Determine primary media using same logic as submission (getPrimaryUrl)
    // Priority: first non-image URL that should fetch metadata > first URL > first image attachment
    const imageUrls: string[] = [];
    const nonImageUrls: string[] = [];
    
    // Separate image URLs from non-image URLs
    for (const url of urls) {
      const urlType = detectProviderFromUrl(url);
      if (urlType === 'image') {
        imageUrls.push(url);
      } else {
        nonImageUrls.push(url);
      }
    }
    
    // Collect image attachments (uploaded files)
    const imageAttachments = attachments.filter(att => att.type === 'image' && att.secureUrl);
    
    // Determine primary media: use getPrimaryUrl for URLs, then fall back to first attachment
    const primaryUrlFromUrls = getPrimaryUrl(urls);
    const primaryUrl = primaryUrlFromUrls || imageAttachments[0]?.secureUrl || null;
    const primaryUrlType = primaryUrl ? detectProviderFromUrl(primaryUrl) : null;
    
    // CREATE MODE DEFAULT BEHAVIOR:
    // - Primary media defaults to showInMasonry: true (selected by default)
    // - Primary media is NOT locked - user can unselect it
    // - If user unselects primary media, nugget won't appear in Masonry (no fallback)
    // - Supporting media remain opt-in (default to false)
    
    // 1. Add primary media
    if (primaryUrl) {
      imageManager.addImage(primaryUrl, 'primary', {
        showInMasonry: true, // Selected by default in Create mode
        type: (primaryUrlType || 'image') as MediaType,
        thumbnail: primaryUrl,
      });
    }
    
    // 2. Add supporting image URLs
    imageUrls.forEach((url) => {
      // Skip if this is the primary media
      if (url === primaryUrl) return;
      
      imageManager.addImage(url, 'url-input', {
        showInMasonry: false, // Default to false, user can opt-in
        type: 'image',
        thumbnail: url,
      });
    });
    
    // 3. Add supporting non-image URLs
    nonImageUrls.forEach((url) => {
      // Skip if this is the primary media
      if (url === primaryUrl) return;
      
      const urlType = detectProviderFromUrl(url);
      imageManager.addImage(url, 'url-input', {
        showInMasonry: false, // Default to false, user can opt-in
        type: urlType as MediaType,
      });
    });
    
    // 4. Add image attachments (supporting media)
    imageAttachments.forEach((att) => {
      const url = att.secureUrl || att.previewUrl;
      // Skip if this is the primary media or if URL is not available
      if (!url || url === primaryUrl) return;
      
      imageManager.addImage(url, 'upload', {
        showInMasonry: false, // Default to false, user can opt-in
        type: 'image',
        mediaId: att.mediaId,
        thumbnail: url,
      });
    });
    
    // Masonry items are now managed by imageManager
    // The imageManager automatically derives masonryItems from state.images
    
    // Debug logging (temporary - remove after validation)
    if (process.env.NODE_ENV === 'development') {
      console.log('[CreateNuggetModal] Images synced to imageManager:', {
        totalImages: imageManager.allImages.length,
        masonryItems: imageManager.masonryItems.length,
        masonryItemIds: imageManager.masonryItems.map(m => ({ 
          id: m.id, 
          url: m.url, 
          showInMasonry: m.showInMasonry 
        })),
      });
    }
  }, [mode, urls, attachments]); // Removed imageManager from dependencies - methods are stable via useCallback

  // AI summarize handler removed - AI creation system has been fully removed


  const handleSubmit = async () => {
    // Mark all fields as touched to show validation errors
    setTagsTouched(true);
    setContentTouched(true);
    
    // Validate field-level errors first
    const tagsErr = validateTags();
    const contentErr = validateContent();
    
    setTagsError(tagsErr);
    setContentError(contentErr);
    
    // If field errors exist, stop submission
    if (tagsErr || contentErr) {
      // Scroll to first error if needed
      if (tagsErr) {
        tagsComboboxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else if (contentErr) {
        document.getElementById('title-input')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      return;
    }
    
    // Validate user is authenticated (server-side check, use global error)
    if (!currentUserId) {
        setError("You must be logged in to create a nugget.");
        return;
    }
    
    // Validate edit mode has initialData
    if (mode === 'edit' && !initialData) {
        setError("Cannot edit: nugget data is missing.");
        return;
    }
    
    setIsSubmitting(true);
    setError(null);
    try {
        // CRITICAL: Do NOT derive titles from content for text-only nuggets
        // Auto-title generation is STRICTLY LIMITED to Social/Video content types
        // Titles are optional - allow empty/null titles
        const finalTitle = title.trim() || '';
        const wordCount = content.trim().split(/\s+/).length;
        const _readTime = Math.max(1, Math.ceil(wordCount / 200)); // eslint-disable-line @typescript-eslint/no-unused-vars -- calculated for reference, actual readTime comes from normalizeArticleInput

        // TEMPORARY DEBUG: Stage 1 - Before submit (form state)
        const primaryUrl = urls.length > 0 ? urls[0] : detectedLink || null;
        const hasMedia = !!linkMetadata || !!primaryUrl;
        console.log('[CONTENT_TRACE] Stage 1 - Before submit (form state)', {
            mode: 'create',
            hasMedia,
            source_type: primaryUrl ? 'link' : 'text',
            primaryUrl,
            contentLength: content.length,
            contentPreview: content.substring(0, 120),
            hasLinkMetadata: !!linkMetadata,
            linkMetadataType: linkMetadata?.type,
        });

        // EDIT MODE — normalized pipeline (Phase-2 complete, legacy removed)
        if (mode === 'edit' && initialData) {
            // CRITICAL: Wait for metadata fetch if in progress
            // This ensures media is included when URL is added during edit
            let finalMetadata = linkMetadata;
            if (isLoadingMetadata && detectedLink) {
                // Metadata fetch is in progress, wait for it to complete
                try {
                    const metadata = await processNuggetUrl(detectedLink, {
                        cancelKey: `nugget-url-${detectedLink}`,
                    });
                    if (metadata) {
                        finalMetadata = metadata;
                        setLinkMetadata(metadata); // Update state for UI
                    }
                } catch (error) {
                    console.error('[CreateNuggetModal] Failed to fetch metadata during save:', error);
                    // Continue with existing metadata or create minimal media
                }
            }
            
            // Collect mediaIds and uploadedImageUrls for normalizeArticleInput
            const mediaIds: string[] = [];
            const uploadedImageUrls: string[] = [];
            for (const att of attachments) {
                if (att.type === 'image' && att.mediaId) {
                    mediaIds.push(att.mediaId);
                    if (att.secureUrl) {
                        uploadedImageUrls.push(att.secureUrl);
                    }
                }
            }
            
            // Build payload using shared normalizeArticleInput
            // FIX: Read masonryMediaItems fresh from imageManager to ensure current toggle state
            const currentMasonryItems = imageManager.masonryItems;
            
            // Debug logging to verify masonry state
            if (process.env.NODE_ENV === 'development') {
              console.log('[CreateNuggetModal] Edit submit - masonry state:', {
                masonryItemsCount: currentMasonryItems.length,
                selectedItems: currentMasonryItems.filter(m => m.showInMasonry).map(m => ({
                  id: m.id,
                  url: m.url,
                  showInMasonry: m.showInMasonry,
                  masonryTitle: m.masonryTitle,
                })),
              });
            }
            
            const normalizedInput = await normalizeArticleInput(
                {
                    title: finalTitle,
                    content,
                    tags,
                    visibility,
                    urls,
                    detectedLink: detectedLink || null,
                    linkMetadata: finalMetadata,
                    imageUrls: [], // Will be separated from urls by normalizeArticleInput
                    uploadedImageUrls,
                    mediaIds,
                    uploadedDocs: attachments.filter(att => att.type === 'document').map(att => ({
                        url: att.secureUrl || att.previewUrl,
                        name: att.file.name,
                        type: att.type,
                    })),
                    customDomain,
                    masonryMediaItems: currentMasonryItems, // Use fresh data from imageManager
                    customCreatedAt: customCreatedAt || null,
                    isAdmin,
                    // Edit mode specific
                    existingImages,
                    existingMediaIds: initialData.mediaIds || [],
                    initialData,
                    existingMedia: initialData.media || null,
                    existingSupportingMedia: initialData.supportingMedia || [],
                    // IMAGE PRESERVATION INVARIANT: Pass explicitly deleted images
                    // This prevents restoration of images that were explicitly deleted
                    explicitlyDeletedImages,
                    // Metadata override flag: true when user explicitly edits caption/title
                    allowMetadataOverride,
                },
                {
                    mode: 'edit',
                    enrichMediaItemIfNeeded,
                    classifyArticleMedia,
                }
            );
            
            // PHASE 1: Validate tags are not empty (same rule as CREATE mode)
            // If tags become empty after normalization, prevent submission
            if (normalizedInput.hasEmptyTagsError) {
                setTagsError("Please add at least one tag. Tags enable smarter news discovery.");
                setIsSubmitting(false);
                // Scroll to tags field
                tagsComboboxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                return;
            }

            // PHASE 4: Pre-save validation with warnings and error blocking
            if (isFeatureEnabled('NUGGET_EDITOR_V2')) {
              const validationResult = validateBeforeSave(
                initialData,
                {
                  title: normalizedInput.title,
                  content: normalizedInput.content,
                  tags: normalizedInput.tags,
                  media: normalizedInput.media,
                  primaryMedia: null, // Edit mode doesn't use primaryMedia directly
                  supportingMedia: normalizedInput.supportingMedia,
                  images: normalizedInput.images,
                  externalLinks,
                  displayImageIndex: displayImageId
                    ? currentMasonryItems.findIndex(m => m.id === displayImageId)
                    : undefined,
                },
                'edit'
              );

              // Block save if validation errors exist
              if (!validationResult.isValid) {
                validationResult.errors.forEach(err => toast.error(err.message));
                setIsSubmitting(false);
                return;
              }

              // Show warnings but allow save with confirmation
              if (validationResult.warnings.length > 0) {
                const warningMessages = validationResult.warnings.map(w => `• ${w.message}`).join('\n');
                const proceed = window.confirm(
                  `Warning:\n${warningMessages}\n\nDo you want to proceed anyway?`
                );
                if (!proceed) {
                  setIsSubmitting(false);
                  return;
                }
              }

              // Log integrity checks in development
              if (process.env.NODE_ENV === 'development') {
                console.log('[CreateNuggetModal] Pre-save validation result:', {
                  isValid: validationResult.isValid,
                  errors: validationResult.errors,
                  warnings: validationResult.warnings,
                  integrityChecks: validationResult.integrityChecks,
                });
              }
            }
            
            // Convert normalized output to partial update payload
            // CRITICAL: Only include fields that have changed (EDIT mode semantics)
            const updatePayload: Partial<Article> = {
                title: normalizedInput.title,
                content: normalizedInput.content,
                // CATEGORY PHASE-OUT: Removed categories field - tags are now the only classification field
                visibility: normalizedInput.visibility,
                readTime: normalizedInput.readTime,
                excerpt: normalizedInput.excerpt,
                tags: normalizedInput.tags, // Include normalized tags
            };
            
            // Add optional fields only if they exist (preserve EDIT mode partial update semantics)
            if (normalizedInput.images !== undefined) {
                updatePayload.images = normalizedInput.images;
            }
            if (normalizedInput.mediaIds !== undefined) {
                updatePayload.mediaIds = normalizedInput.mediaIds;
            }
            if (normalizedInput.documents !== undefined) {
                updatePayload.documents = normalizedInput.documents;
            }
            
            // Handle media field (null vs undefined semantics)
            // EDIT mode: undefined = don't update, null = clear field
            if (normalizedInput.media !== undefined) {
                // Add allowMetadataOverride flag to media object for backend processing
                // This flag indicates user explicitly edited caption/title and allows intentional overrides
                if (normalizedInput.media === null) {
                    updatePayload.media = null;
                } else {
                    updatePayload.media = {
                        ...normalizedInput.media,
                        allowMetadataOverride: allowMetadataOverride,
                    } as NuggetMedia;
                }
            }
            
            if (normalizedInput.supportingMedia !== undefined) {
                updatePayload.supportingMedia = normalizedInput.supportingMedia;
            }
            
            if (normalizedInput.customCreatedAt !== undefined) {
                updatePayload.customCreatedAt = normalizedInput.customCreatedAt;
            }
            
            // Add externalLinks and layoutVisibility to updatePayload
            // PHASE 0 FIX: Conditional inclusion to restore partial update semantics
            // Only send externalLinks if field existed OR user added links (prevents empty array overwrite)
            if (initialData?.externalLinks !== undefined || externalLinks.length > 0) {
              updatePayload.externalLinks = externalLinks;
            }
            updatePayload.layoutVisibility = layoutVisibility;

            // V2: Add displayImageIndex if user selected a specific thumbnail
            if (isFeatureEnabled('NUGGET_EDITOR_V2') && displayImageId) {
              const displayIndex = currentMasonryItems.findIndex(m => m.id === displayImageId);
              if (displayIndex >= 0) {
                updatePayload.displayImageIndex = displayIndex;
              }
            }
            
            // Final debug log before submit
            const includedFields = Object.keys(updatePayload);
            console.log('[EDIT FINALIZED] Edit payload built from normalizeArticleInput', {
                includedFields,
                hasMedia: updatePayload.media !== undefined,
                hasSupportingMedia: updatePayload.supportingMedia !== undefined,
                imagesCount: updatePayload.images?.length || 0,
                // DEBUG: Show actual supportingMedia order
                supportingMediaOrder: updatePayload.supportingMedia?.map((m: any) => m.url?.slice(-30)),
            });
            
            // Preserve primaryUrl for regression safeguard check
            const primaryUrl = normalizedInput.primaryUrl ?? null;
            
            // Call update
            const updatedArticle = await storageService.updateArticle(initialData.id, updatePayload);

            if (!updatedArticle) {
                throw new Error('Failed to update nugget');
            }

            // DEBUG: Log what the backend returned
            console.log('[EDIT RESULT] Backend returned article:', {
                hasSupportingMedia: !!updatedArticle.supportingMedia,
                supportingMediaCount: updatedArticle.supportingMedia?.length || 0,
                supportingMediaOrder: updatedArticle.supportingMedia?.map((m: any) => m.url?.slice(-30)),
            });
            
            // CRITICAL: Invalidate and refresh all query caches
            // This ensures feed, drawer, and inline views show updated media
            await queryClient.invalidateQueries({ queryKey: ['articles'] });
            
            // Also update specific article cache if it exists
            queryClient.setQueryData(['article', initialData.id], updatedArticle);
            
            // Optimistically update query cache for immediate UI update
            queryClient.setQueryData(['articles'], (oldData: any) => {
                if (!oldData) return oldData;
                // Handle paginated response
                if (oldData.data && Array.isArray(oldData.data)) {
                    return {
                        ...oldData,
                        data: oldData.data.map((a: Article) => 
                            a.id === updatedArticle.id ? updatedArticle : a
                        )
                    };
                }
                // Handle array response
                if (Array.isArray(oldData)) {
                    return oldData.map((a: Article) => 
                        a.id === updatedArticle.id ? updatedArticle : a
                    );
                }
                return oldData;
            });
            
            // REGRESSION SAFEGUARD: Assert that if URL exists, media must be present
            // This prevents silent failures where URL is added but media doesn't appear
            if (primaryUrl && !updatedArticle.media) {
                const errorMsg = `[CreateNuggetModal] REGRESSION: URL exists but media is missing after update. URL: ${primaryUrl}, ArticleId: ${updatedArticle.id}`;
                console.error(errorMsg);
                // In development, throw to catch this early
                if (process.env.NODE_ENV === 'development') {
                    console.error('This indicates a bug in URL + media processing. Media should always be set when a URL is present.');
                }
            }
            
            // REGRESSION SAFEGUARD: Assert that media has required fields if it exists
            if (updatedArticle.media) {
                if (!updatedArticle.media.url) {
                    console.error('[CreateNuggetModal] REGRESSION: Media object exists but missing URL field', {
                        articleId: updatedArticle.id,
                        media: updatedArticle.media,
                    });
                }
                if (!updatedArticle.media.previewMetadata) {
                    console.error('[CreateNuggetModal] REGRESSION: Media object exists but missing previewMetadata', {
                        articleId: updatedArticle.id,
                        mediaType: updatedArticle.media.type,
                        mediaUrl: updatedArticle.media.url,
                        mediaKeys: Object.keys(updatedArticle.media),
                    });
                }
            }
            
            toast.success('Nugget updated successfully');
            handleClose();
            return;
        }
        
        // CREATE MODE - Use mediaIds instead of Base64
        const mediaIds: string[] = [];
        const uploadedImageUrls: string[] = []; // Cloudinary URLs for display
        const uploadedDocs: any[] = [];

        // Collect mediaIds and secureUrls from successfully uploaded images
        for (const att of attachments) {
            if (att.type === 'image') {
                if (att.mediaId) {
                    mediaIds.push(att.mediaId);
                    // Also collect Cloudinary URLs for display in cards
                    if (att.secureUrl) {
                        uploadedImageUrls.push(att.secureUrl);
                    }
                } else if (att.uploadError) {
                    // Skip failed uploads, but warn user
                    toast.warning(`Image "${att.file.name}" failed to upload and was skipped.`);
                } else if (att.isUploading) {
                    // Wait for upload to complete
                    toast.warning(`Image "${att.file.name}" is still uploading. Please wait.`);
                    setIsSubmitting(false);
                    return;
                }
            } else {
                // Documents: Upload to Cloudinary as well (not just images)
                try {
                    const uploadResult = await mediaUpload.upload(att.file);
                    if (uploadResult && uploadResult.secureUrl) {
                        uploadedDocs.push({
                            title: att.file.name,
                            url: uploadResult.secureUrl, // Use Cloudinary URL instead of Base64
                            type: att.file.name.split('.').pop() || 'file',
                            size: (att.file.size / 1024).toFixed(0) + 'KB'
                        });
                        // Also add to mediaIds if it's an image-like document
                        if (uploadResult.mediaId) {
                            mediaIds.push(uploadResult.mediaId);
                        }
                    } else {
                        toast.warning(`Document "${att.file.name}" failed to upload and was skipped.`);
                    }
                } catch (uploadError: any) {
                    console.error('Document upload error:', uploadError);
                    toast.warning(`Document "${att.file.name}" failed to upload: ${uploadError.message || 'Unknown error'}`);
                }
            }
        }

        const finalAliasName = selectedAlias === 'Custom...' ? customAlias : selectedAlias;

        // PHASE 1: Extract normalization logic to shared module
        // Use normalizeArticleInput to handle ALL normalization logic
        // Separate image URLs from regular URLs (done internally by normalization, but we need it for source_type calculation)
        const imageUrls: string[] = [];
        const linkUrls: string[] = [];
        for (const url of urls) {
            const urlType = detectProviderFromUrl(url);
            if (urlType === 'image') {
                imageUrls.push(url);
            } else {
                linkUrls.push(url);
            }
        }

        // FIX: Read masonryMediaItems fresh from imageManager to ensure current toggle state
        const currentMasonryItems = imageManager.masonryItems;
        
        // Debug logging to verify masonry state
        if (process.env.NODE_ENV === 'development') {
          console.log('[CreateNuggetModal] Create submit - masonry state:', {
            masonryItemsCount: currentMasonryItems.length,
            selectedItems: currentMasonryItems.filter(m => m.showInMasonry).map(m => ({
              id: m.id,
              url: m.url,
              showInMasonry: m.showInMasonry,
              masonryTitle: m.masonryTitle,
            })),
          });
        }
        
        const normalized = await normalizeArticleInput(
            {
                title: finalTitle,
                content,
                tags,
                visibility,
                urls,
                detectedLink,
                linkMetadata,
                imageUrls, // Pass separated imageUrls (normalization function will handle deduplication)
                uploadedImageUrls,
                mediaIds,
                uploadedDocs,
                customDomain,
                masonryMediaItems: currentMasonryItems, // Use fresh data from imageManager
                customCreatedAt,
                isAdmin,
            },
            {
                mode: 'create',
                enrichMediaItemIfNeeded,
                classifyArticleMedia,
            }
        );

        // TEMPORARY DEBUG: Stage 2 - After normalizeArticleInput() output
        console.log('[CONTENT_TRACE] Stage 2 - After normalizeArticleInput() output', {
            mode: 'create',
            hasMedia: !!normalized.media,
            source_type: normalized.source_type,
            primaryUrl: normalized.primaryUrl,
            contentLength: normalized.content.length,
            contentPreview: normalized.content.substring(0, 120),
            mediaType: normalized.media?.type,
            mediaUrl: normalized.media?.url,
        });

        // PHASE 5: Regression safeguard - defensive assertion
        // This should never trigger if validation works correctly, but prevents silent failures
        if (normalized.hasEmptyTagsError) {
            setTagsError("Please add at least one tag. Tags enable smarter news discovery.");
            setIsSubmitting(false);
            return;
        }

        // PHASE 4: Pre-save validation with warnings and error blocking (Create mode)
        if (isFeatureEnabled('NUGGET_EDITOR_V2')) {
          const validationResult = validateBeforeSave(
            null, // No original article in create mode
            {
              title: normalized.title,
              content: normalized.content,
              tags: normalized.tags,
              media: normalized.media,
              primaryMedia: null,
              supportingMedia: normalized.supportingMedia,
              images: normalized.images,
              externalLinks,
              displayImageIndex: displayImageId
                ? currentMasonryItems.findIndex(m => m.id === displayImageId)
                : undefined,
            },
            'create'
          );

          // Block save if validation errors exist
          if (!validationResult.isValid) {
            validationResult.errors.forEach(err => toast.error(err.message));
            setIsSubmitting(false);
            return;
          }

          // Show warnings but allow save with confirmation
          if (validationResult.warnings.length > 0) {
            const warningMessages = validationResult.warnings.map(w => `• ${w.message}`).join('\n');
            const proceed = window.confirm(
              `Warning:\n${warningMessages}\n\nDo you want to proceed anyway?`
            );
            if (!proceed) {
              setIsSubmitting(false);
              return;
            }
          }

          // Log integrity checks in development
          if (process.env.NODE_ENV === 'development') {
            console.log('[CreateNuggetModal] Pre-save validation result (create):', {
              isValid: validationResult.isValid,
              errors: validationResult.errors,
              warnings: validationResult.warnings,
              integrityChecks: validationResult.integrityChecks,
            });
          }
        }

        // TEMPORARY DEBUG: Stage 3 - Payload sent to API (before storageService.createArticle)
        const createPayload = {
            title: normalized.title,
            content: normalized.content,
            excerpt: normalized.excerpt,
            author: { id: currentUserId, name: authorName },
            displayAuthor: (postAs === 'alias' && finalAliasName.trim()) ? { name: finalAliasName.trim() } : undefined,
            tags: normalized.tags,
            readTime: normalized.readTime,
            mediaIds: normalized.mediaIds,
            images: normalized.images,
            documents: normalized.documents,
            visibility: normalized.visibility,
            ...(normalized.customCreatedAt ? { customCreatedAt: normalized.customCreatedAt } : {}),
            media: normalized.media,
            supportingMedia: normalized.supportingMedia,
            source_type: normalized.source_type,
            externalLinks,
            layoutVisibility: layoutVisibility,
            // V2: Add displayImageIndex if user selected a specific thumbnail
            ...(isFeatureEnabled('NUGGET_EDITOR_V2') && displayImageId ? {
              displayImageIndex: currentMasonryItems.findIndex(m => m.id === displayImageId),
            } : {}),
        };
        console.log('[CONTENT_TRACE] Stage 3 - Payload sent to API (final request body)', {
            mode: 'create',
            hasMedia: !!createPayload.media,
            source_type: createPayload.source_type,
            primaryUrl: normalized.primaryUrl,
            contentLength: createPayload.content.length,
            contentPreview: createPayload.content.substring(0, 120),
            mediaType: createPayload.media?.type,
            mediaUrl: createPayload.media?.url,
        });
        
        const newArticle = await storageService.createArticle(createPayload);

        const allColsResult = await storageService.getCollections();
        // Handle union type: Collection[] | { data: Collection[], count: number }
        const allCols: Collection[] = Array.isArray(allColsResult) ? allColsResult : (allColsResult?.data ?? []);
        for (const colName of selectedCollections) {
            let targetCol = allCols.find((c: Collection) => c.name === colName);
            if (!targetCol) {
                targetCol = await storageService.createCollection(colName, '', currentUserId, visibility);
            }
            await storageService.addArticleToCollection(targetCol.id, newArticle.id, currentUserId);
        }

        await queryClient.invalidateQueries({ queryKey: ['articles'] });

        // REGRESSION SAFEGUARD: Assert that if URL exists, media must be present
        const regressionCheckPrimaryUrl = normalized.primaryUrl ?? null;
        if (regressionCheckPrimaryUrl && newArticle.media === null) {
            const errorMsg = `[CreateNuggetModal] REGRESSION: URL exists but media is null after create. URL: ${regressionCheckPrimaryUrl}, ArticleId: ${newArticle.id}`;
            console.error(errorMsg);
            if (process.env.NODE_ENV === 'development') {
                console.error('This indicates a bug in URL + media processing. Media should always be set when a URL is present.');
            }
        }
        
        handleClose();
    } catch (e: any) {
        console.error("Failed to create nugget", e);
        
        // Use unified error handling
        logError('CreateNuggetModal', e, { title, attachmentsCount: attachments.length, urlsCount: urls.length, tagsCount: tags.length });
        
        const apiError = formatApiError(e);
        const baseErrorMessage = getUserFriendlyMessage(apiError);
        
        // PHASE 5: Handle tag-specific validation errors from backend
        // If backend returns a tag validation error, set it on the tags field
        if (e?.errors && Array.isArray(e.errors)) {
            const tagError = e.errors.find((err: any) => err.path === 'tags' || err.path?.includes('tags'));
            if (tagError) {
                setTagsError("Tags required to post the nugget");
                setTagsTouched(true);
                tagsComboboxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
        
        // Handle multiple validation errors
        let finalErrorMessage = baseErrorMessage;
        let toastMessage = baseErrorMessage;
        
        if (e?.errors && Array.isArray(e.errors) && e.errors.length > 1) {
            const formattedErrors = e.errors.map((err: any) => getUserFriendlyMessage(formatApiError(err)));
            finalErrorMessage = `Please fix the following issues:\n${formattedErrors.map((msg: string, idx: number) => `${idx + 1}. ${msg}`).join('\n')}`;
            toastMessage = `Multiple validation errors. ${formattedErrors.length} issue(s) need to be fixed.`;
        } else if (e?.message) {
            // Handle specific error types
            const message = e.message;
            if (message.includes('network') || message.includes('fetch')) {
                finalErrorMessage = "Unable to connect to the server. Please check your internet connection and try again.";
                toastMessage = "Connection error. Please try again.";
            } else if (message.includes('unauthorized') || message.includes('401')) {
                finalErrorMessage = "Your session has expired. Please refresh the page and sign in again.";
                toastMessage = "Session expired. Please sign in again.";
            } else if (message.includes('forbidden') || message.includes('403')) {
                finalErrorMessage = "You don't have permission to perform this action.";
                toastMessage = "Permission denied.";
            } else if (message.includes('timeout')) {
                finalErrorMessage = "The request took too long. Please try again.";
                toastMessage = "Request timeout. Please try again.";
            }
        }
        
        // Set error state for inline display
        setError(finalErrorMessage);
        
        // Show toast notification
        toast.error(toastMessage);
    } finally {
        setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={handleClose} />
      
      <div 
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="relative w-full h-screen max-h-screen sm:h-auto sm:max-h-[90vh] sm:max-w-4xl bg-white dark:bg-slate-900 sm:rounded-2xl shadow-2xl flex flex-col animate-in zoom-in-95 fade-in duration-200 border border-slate-200 dark:border-slate-800 overflow-hidden"
      >
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 z-20 shrink-0">
            <h2 id="modal-title" className="text-sm font-bold text-slate-900 dark:text-white">
              {mode === 'edit' ? 'Edit Nugget' : 'Create Nugget'}
            </h2>
            <button 
              onClick={handleClose} 
              aria-label="Close modal"
              className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            >
                <X size={18} />
            </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-900">
            <div className="p-4 space-y-4"> 
                {/* Identity & Visibility */}
                <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                    
                    {/* Identity Selector (Admin Only) */}
                    {isAdmin ? (
                        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                            <button 
                                onClick={() => setPostAs('me')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${postAs === 'me' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Me
                            </button>
                            <button 
                                onClick={() => setPostAs('alias')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${postAs === 'alias' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Alias
                            </button>
                            
                            {postAs === 'alias' && (
                                <div className="flex items-center gap-2">
                                    <select 
                                        value={selectedAlias} 
                                        onChange={(e) => setSelectedAlias(e.target.value)} 
                                        className="bg-transparent border-b border-slate-300 dark:border-slate-600 px-2 py-0.5 text-xs font-medium focus:outline-none focus:border-primary-500 dark:text-white cursor-pointer"
                                    >
                                        {availableAliases.map(a => <option key={a} value={a}>{a}</option>)}
                                        <option value="Custom...">Custom...</option>
                                    </select>
                                    
                                    {selectedAlias === 'Custom...' && (
                                        <input 
                                            autoFocus
                                            className="w-24 bg-transparent border-b border-slate-300 dark:border-slate-600 px-2 py-0.5 text-xs font-medium focus:outline-none focus:border-primary-500 dark:text-white"
                                            placeholder="Name"
                                            value={customAlias}
                                            onChange={(e) => setCustomAlias(e.target.value)}
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 mt-1">
                            <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 text-[10px] border border-slate-200 dark:border-slate-700">
                                {getInitials(authorName)}
                            </div>
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{authorName}</span>
                        </div>
                    )}

                    <div className="flex flex-col items-end gap-1">
                        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
                             <button 
                                onClick={() => { setVisibility('public'); setSelectedCollections([]); }}
                                className={`px-3 py-1.5 text-[10px] font-bold rounded-md flex items-center gap-1.5 transition-all ${visibility === 'public' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500'}`}
                             >
                                <Globe size={12} /> Public
                             </button>
                             <button 
                                onClick={() => { setVisibility('private'); setSelectedCollections([]); }}
                                className={`px-3 py-1.5 text-[10px] font-bold rounded-md flex items-center gap-1.5 transition-all ${visibility === 'private' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500'}`}
                             >
                                <Lock size={12} /> Private
                             </button>
                        </div>
                    </div>
                </div>

                {/* Organization Rows - Tags and Collections/Bookmarks */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                    <TagSelector
                        selected={tags}
                        availableCategories={availableTags}
                        onSelectedChange={setTags}
                        onAvailableCategoriesChange={handleAvailableTagsChange}
                        error={tagsError}
                        touched={tagsTouched}
                        onTouchedChange={setTagsTouched}
                        onErrorChange={setTagsError}
                        comboboxRef={tagsComboboxRef}
                        listboxRef={tagsListboxRef}
                    />
                    <CollectionSelector
                        selected={selectedCollections}
                        availableCollections={allCollections}
                        visibility={visibility}
                        onSelectedChange={setSelectedCollections}
                        onAvailableCollectionsChange={handleAvailableCollectionsChange}
                        currentUserId={currentUserId}
                        comboboxRef={collectionsComboboxRef}
                        listboxRef={collectionsListboxRef}
                    />
                </div>

                {/* V2: Layout Visibility moved up - Controls which layouts display this nugget */}
                {isFeatureEnabled('NUGGET_EDITOR_V2') && (
                  <div className="space-y-2" data-testid="layout-visibility-section-v2">
                    <LayoutVisibilitySection
                      visibility={layoutVisibility}
                      onChange={setLayoutVisibility}
                      hasMedia={unifiedMediaItems.length > 0}
                      hasMasonrySelectedMedia={unifiedMediaItems.some(m => m.showInMasonry)}
                      disabled={isSubmitting}
                    />
                  </div>
                )}

                {/* Title Field */}
                <div className="space-y-2">
                    <TitleInput
                        value={title}
                        onChange={(value) => {
                            setTitle(value);
                            setIsTitleUserEdited(true); // PHASE 6: Mark as user-edited
                            // User explicitly edited title → allow metadata override (edit mode only)
                            if (mode === 'edit') {
                                setAllowMetadataOverride(true);
                            }
                            if (!contentTouched) setContentTouched(true);
                            if (contentError) {
                                const error = validateContent();
                                setContentError(error);
                            }
                        }}
                        onBlur={() => {
                            if (!contentTouched) setContentTouched(true);
                            const error = validateContent();
                            setContentError(error);
                        }}
                        linkMetadataTitle={suggestedTitle || undefined}
                        error={contentError}
                        warning={contentTouched && !contentError && !content.trim() && !title.trim() && urls.length === 0 && attachments.length === 0 ? "Add some content, a URL, or an attachment before submitting." : undefined}
                        onTouchedChange={setContentTouched}
                        onErrorChange={setContentError}
                    />
                    {/* FIX: Removed "Generate title from source" button - auto-title disabled for YouTube/social networks */}
                    {/* Title suggestions are completely disabled per user request */}
                </div>

                {/* URLs Field */}
                <UrlInput
                    urlInput={urlInput}
                    urls={urls}
                    onUrlInputChange={(value) => {
                        setUrlInput(value);
                        if (!contentTouched) setContentTouched(true);
                    }}
                    onAddUrl={addUrl}
                    onRemoveUrl={(url) => {
                        removeUrl(url);
                        if (!contentTouched) setContentTouched(true);
                        if (contentTouched) {
                            const error = validateContent();
                            setContentError(error);
                        }
                    }}
                    onUrlPaste={handleUrlPaste}
                    onTouchedChange={(touched) => {
                        if (touched) setContentTouched(true);
                    }}
                    onErrorChange={(error) => {
                        if (error !== null) {
                            const validationError = validateContent();
                            setContentError(validationError);
                        }
                    }}
                />

                {/* ═══════════════════════════════════════════════════════════════════ */}
                {/* EXTERNAL LINKS SECTION - For card "Link" button */}
                {/* Positioned above content editor for quick access */}
                {/* ═══════════════════════════════════════════════════════════════════ */}
                <div className="space-y-2" data-testid="external-links-section">
                  <ExternalLinksSection
                    links={externalLinks}
                    onAddLink={handleAddExternalLink}
                    onRemoveLink={handleRemoveExternalLink}
                    onSetPrimary={handleSetPrimaryLink}
                    onUpdateLabel={handleUpdateLinkLabel}
                    disabled={isSubmitting}
                  />
                </div>

                {/* ═══════════════════════════════════════════════════════════════════ */}
                {/* LAYOUT VISIBILITY SECTION (V1: Original position) */}
                {/* V2: This section is moved up after Tags */}
                {/* ═══════════════════════════════════════════════════════════════════ */}
                {!isFeatureEnabled('NUGGET_EDITOR_V2') && (
                  <div className="space-y-2" data-testid="layout-visibility-section">
                    <LayoutVisibilitySection
                      visibility={layoutVisibility}
                      onChange={setLayoutVisibility}
                      hasMedia={unifiedMediaItems.length > 0}
                      hasMasonrySelectedMedia={unifiedMediaItems.some(m => m.showInMasonry)}
                      disabled={isSubmitting}
                    />
                  </div>
                )}

                {/* Editor Area with AI Trigger */}
                <ContentEditor
                    value={content}
                    onChange={(newContent) => {
                        setContent(newContent);
                        if (!contentTouched) setContentTouched(true);
                        if (contentError) {
                            const error = validateContent();
                            setContentError(error);
                        }
                    }}
                    isAiLoading={false}
                    onAiSummarize={() => {
                      toast.error("AI summarization has been removed. Please create articles manually.");
                    }}
                    onImagePaste={async (file) => {
                        if (isImageFile(file)) {
                            // Batch multiple pasted images by collecting them and processing together
                            // Add to buffer
                            pastedImagesBufferRef.current.push(file);
                            
                            // Clear any existing timeout
                            if (pasteBatchTimeoutRef.current) {
                                clearTimeout(pasteBatchTimeoutRef.current);
                            }
                            
                            // Process after a short delay to allow all images from the same paste event to be collected
                            pasteBatchTimeoutRef.current = setTimeout(async () => {
                                const images = [...pastedImagesBufferRef.current];
                                pastedImagesBufferRef.current = [];
                                
                                if (images.length > 0) {
                                    // Upload each pasted image immediately to Cloudinary
                                    for (const imageFile of images) {
                                        try {
                                            const uploadResult = await mediaUpload.upload(imageFile);
                                            if (uploadResult) {
                                                // Create attachment with mediaId
                                                const attachment: FileAttachment = {
                                                    file: imageFile,
                                                    previewUrl: URL.createObjectURL(imageFile), // Temporary preview
                                                    type: 'image',
                                                    mediaId: uploadResult.mediaId,
                                                    secureUrl: uploadResult.secureUrl,
                                                    isUploading: false,
                                                };
                                                setAttachments(prev => [...prev, attachment]);
                                                if (!contentTouched) setContentTouched(true);
                                            } else {
                                                toast.error(`Failed to upload pasted image: ${mediaUpload.error || 'Unknown error'}`);
                                            }
                                        } catch (error: any) {
                                            console.error('Paste upload error:', error);
                                            toast.error(`Failed to upload pasted image: ${error.message || 'Unknown error'}`);
                                        }
                                    }
                                }
                                
                                pasteBatchTimeoutRef.current = null;
                            }, 50); // Small delay to batch multiple images from the same paste operation
                        }
                    }}
                    error={contentError}
                    warning={contentTouched && !contentError && !content.trim() && !title.trim() && urls.length === 0 && attachments.length === 0 ? "Add some content, a URL, or an attachment before submitting." : undefined}
                    onTouchedChange={setContentTouched}
                    onErrorChange={setContentError}
                />

                {/* Source Selector - Always visible for manual favicon/domain entry */}
                {/* TEMPORARILY DISABLED: Hide favicon selector */}
                {false && (
                    <SourceSelector
                        currentUrl={urls.find(url => detectProviderFromUrl(url) !== 'image') || detectedLink || null}
                        onDomainChange={setCustomDomain}
                        initialDomain={customDomain}
                    />
                )}

                {/* Attachments Preview */}
                {/* Upload Progress Indicator */}
                {uploadProgress && (
                    <div className="px-5 py-3 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg mb-4">
                        <div className="flex items-center gap-3">
                            <Loader2 size={16} className="animate-spin text-primary-600 dark:text-primary-400" />
                            <div className="flex-1">
                                <div className="text-xs font-medium text-primary-900 dark:text-primary-100">
                                    Processing {uploadProgress.fileName}...
                                </div>
                                <div className="text-[10px] text-primary-700 dark:text-primary-300 mt-0.5">
                                    {uploadProgress.current} of {uploadProgress.total} files
                                </div>
                            </div>
                            <div className="text-xs font-bold text-primary-600 dark:text-primary-400">
                                {Math.round((uploadProgress.current / uploadProgress.total) * 100)}%
                            </div>
                        </div>
                    </div>
                )}
                
                <AttachmentManager
                    attachments={attachments}
                    onAttachmentsChange={(newAttachments) => {
                        setAttachments(newAttachments);
                        if (!contentTouched) setContentTouched(true);
                        if (contentError) {
                            const error = validateContent();
                            setContentError(error);
                        }
                    }}
                    onFileSelect={handleFileUpload}
                    onError={setError}
                />

                {/* ═══════════════════════════════════════════════════════════════════ */}
                {/* UNIFIED MEDIA MANAGER - All media management in one component */}
                {/* Combines: Layout visibility, thumbnail selection, reordering */}
                {/* ═══════════════════════════════════════════════════════════════════ */}
                <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-4" data-testid="media-section">
                  <UnifiedMediaManager
                    items={unifiedMediaItems}
                    onReorder={handleReorderMedia}
                    onDelete={handleDeleteMedia}
                    onSetDisplayImage={handleSetDisplayImage}
                    onToggleMasonry={handleMasonryMediaToggle}
                    onToggleGrid={handleGridMediaToggle}
                    onToggleUtility={handleUtilityMediaToggle}
                    onMasonryTitleChange={handleMasonryTitleChange}
                    onAddMedia={() => fileInputRef.current?.click()}
                    disabled={isSubmitting}
                    showClearThumbnail={isFeatureEnabled('NUGGET_EDITOR_V2')}
                  />
                </div>

                {/* Link Preview */}
                {(urls.length > 0 || detectedLink) && (() => {
                    // Get URLs already managed by UnifiedMediaManager to avoid duplicates
                    const managedUrls = new Set(unifiedMediaItems.map(item => item.url.toLowerCase()));

                    // Filter out URLs already in UnifiedMediaManager
                    const unmanagedUrls = urls.filter(url => !managedUrls.has(url.toLowerCase()));

                    // Separate image URLs from regular URLs for display
                    const imageUrls = unmanagedUrls.filter(url => detectProviderFromUrl(url) === 'image');
                    const linkUrls = unmanagedUrls.filter(url => detectProviderFromUrl(url) !== 'image');

                    // Don't show detectedLink if it's already managed or is an image URL
                    const isDetectedLinkManaged = detectedLink && managedUrls.has(detectedLink.toLowerCase());
                    const isDetectedLinkImage = detectedLink && detectProviderFromUrl(detectedLink) === 'image';
                    const effectiveDetectedLink = (isDetectedLinkManaged || isDetectedLinkImage) ? null : detectedLink;

                    const primaryLinkUrl = linkUrls.length > 0 ? linkUrls[0] : effectiveDetectedLink;
                    const hasMultipleImages = imageUrls.length > 1;
                    const hasMultipleLinks = linkUrls.length > 1;

                    // Don't render anything if all URLs are already managed
                    if (imageUrls.length === 0 && !primaryLinkUrl) {
                        return null;
                    }

                    return (
                        <div className="space-y-3">
                            {/* Show all image URLs (newly added) */}
                            {imageUrls.length > 0 && (
                                <div className="space-y-2">
                                    {hasMultipleImages && (
                                        <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                            {imageUrls.length} New Image{imageUrls.length > 1 ? 's' : ''} Added
                                        </div>
                                    )}
                                    <div className={`grid gap-2 ${hasMultipleImages ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                        {imageUrls.map((imageUrl, idx) => {
                                            const detectedType = detectProviderFromUrl(imageUrl);
                                            return (
                                                <div key={`new-${idx}`} className="relative group rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 shadow-sm">
                                                    <button 
                                                        onClick={() => removeUrl(imageUrl)} 
                                                        className="absolute top-2 right-2 bg-slate-900/80 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-slate-900"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                    <div className="max-h-[160px] overflow-hidden">
                                                        <GenericLinkPreview 
                                                            url={imageUrl} 
                                                            metadata={{ url: imageUrl }} 
                                                            type={detectedType} 
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            
                            {/* Show link preview (non-image URLs) */}
                            {primaryLinkUrl && (
                                <div className="relative group rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 shadow-sm">
                                    {hasMultipleLinks && (
                                        <div className="absolute top-2 left-2 z-10 px-2 py-1 bg-slate-900/80 text-white text-[10px] font-bold rounded">
                                            {linkUrls.length} Link{linkUrls.length > 1 ? 's' : ''}
                                        </div>
                                    )}
                                    <button 
                                        onClick={() => { 
                                            if (linkUrls.length > 0 && primaryLinkUrl) {
                                                removeUrl(primaryLinkUrl);
                                            } else {
                                                setDetectedLink(null);
                                                setLinkMetadata(null);
                                                setCustomDomain(null);
                                            }
                                        }} 
                                        className="absolute top-2 right-2 bg-slate-900/80 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-slate-900"
                                    >
                                        <X size={12} />
                                    </button>
                                    {/* Source Badge Preview - Shows in real-time */}
                                    {/* TEMPORARILY DISABLED: Hide favicon preview */}
                                    {false && !hasMultipleLinks && (
                                        <div className="absolute top-2 left-2 z-10">
                                            <SourceBadge
                                                url={primaryLinkUrl || ''}
                                                customDomain={customDomain || undefined}
                                                size="sm"
                                            />
                                        </div>
                                    )}
                                    <div className="max-h-[160px] overflow-hidden">
                                        {isLoadingMetadata ? (
                                            <div className="p-4 flex items-center justify-center">
                                                <Loader2 size={16} className="animate-spin text-slate-400" />
                                                <span className="ml-2 text-xs text-slate-500">Loading preview...</span>
                                            </div>
                                        ) : (() => {
                                            // Determine content type for proper preview handling
                                            const detectedType = primaryLinkUrl ? detectProviderFromUrl(primaryLinkUrl) : 'link';
                                            
                                            // URLs must not be used as titles. If no title exists, leave empty.
                                            const fallbackMetadata = { 
                                                url: primaryLinkUrl || '', 
                                                title: '' // Never use URL as title
                                            };
                                            
                                            return (
                                                <GenericLinkPreview 
                                                    url={primaryLinkUrl || ''} 
                                                    metadata={linkMetadata?.previewMetadata || fallbackMetadata} 
                                                    type={linkMetadata?.type || detectedType} 
                                                />
                                            );
                                        })()}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })()}

                {error && (
                    <div 
                        role="alert" 
                        aria-live="assertive" 
                        aria-atomic="true"
                        className="text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30 p-3 rounded-lg font-medium border border-red-300 dark:border-red-700 whitespace-pre-line"
                    >
                        <div className="flex items-start gap-2">
                            <span className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" aria-hidden="true">⚠</span>
                            <div className="flex-1">
                                <div className="font-bold mb-1 text-red-800 dark:text-red-300">Unable to create nugget</div>
                                <div className="text-[11px] opacity-90">{error}</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Admin-only: Custom Posting Date - Moved to bottom of form */}
                {isAdmin && (
                    <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                            Date
                        </label>
                        <input
                            type="datetime-local"
                            value={customCreatedAt}
                            onChange={(e) => setCustomCreatedAt(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            placeholder="Leave empty to use current automatic timestamp"
                        />
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                            Leave empty to use current automatic timestamp.
                        </p>
                    </div>
                )}
            </div>
        </div>

        {/* Footer Toolbar */}
        <FormFooter
            fileInputRef={fileInputRef}
            onFileSelect={handleFileUpload}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            canSubmit={
                // PHASE 5: Regression safeguard - disable submit if tags are empty
                tags.length > 0 && 
                !!(content.trim() || title.trim() || urls.length > 0 || attachments.length > 0)
            }
        />

      </div>
    </div>,
    document.body
  );
};


