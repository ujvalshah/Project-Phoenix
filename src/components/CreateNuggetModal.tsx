import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { X, Globe, Lock, Loader2 } from 'lucide-react';
import { getInitials } from '@/utils/formatters';
import { storageService } from '@/services/storageService';
import { detectProviderFromUrl, shouldFetchMetadata } from '@/utils/urlUtils';
import { queryClient } from '@/queryClient';
import { GenericLinkPreview } from './embeds/GenericLinkPreview';
import { Collection } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { aiService } from '@/services/aiService';
import { useToast } from '@/hooks/useToast';
import { compressImage, isImageFile, formatFileSize } from '@/utils/imageOptimizer';
import { unfurlUrl } from '@/services/unfurlService';
import type { NuggetMedia, MediaType } from '@/types';
import { formatApiError, getUserFriendlyMessage, logError } from '@/utils/errorHandler';
import { processNuggetUrl, detectUrlChanges, getPrimaryUrl } from '@/utils/processNuggetUrl';
import { useMediaUpload } from '@/hooks/useMediaUpload';
import { getAllImageUrls } from '@/utils/mediaClassifier';
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
import { collectMasonryMediaItems, MasonryMediaItem } from '@/utils/masonryMediaHelper';
import { classifyArticleMedia } from '@/utils/mediaClassifier';
import type { Article } from '@/types';

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
  const navigate = useNavigate();
  const toast = useToast();
  
  // Ref to track if form has been initialized from initialData (prevents re-initialization)
  const initializedFromDataRef = useRef<string | null>(null);
  
  // Ref to track previous URLs for change detection (CRITICAL for Edit mode)
  const previousUrlsRef = useRef<string[]>([]);

  // Content State
  const [title, setTitle] = useState('');
  const [isTitleUserEdited, setIsTitleUserEdited] = useState(false); // PHASE 6: Safeguard flag
  const [suggestedTitle, setSuggestedTitle] = useState<string | null>(null); // PHASE 3: Metadata suggests but never mutates
  const [content, setContent] = useState('');
  const [urls, setUrls] = useState<string[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [detectedLink, setDetectedLink] = useState<string | null>(null);
  const [linkMetadata, setLinkMetadata] = useState<NuggetMedia | null>(null);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
  const [customDomain, setCustomDomain] = useState<string | null>(null);
  
  // Attachments
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pastedImagesBufferRef = useRef<File[]>([]);
  const pasteBatchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Existing images from article (for edit mode)
  const [existingImages, setExistingImages] = useState<string[]>([]);
  
  // Masonry media items (for toggle controls)
  const [masonryMediaItems, setMasonryMediaItems] = useState<MasonryMediaItem[]>([]);
  
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
  const [categories, setCategories] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  
  // Identity State (Admin Only)
  const [postAs, setPostAs] = useState<'me' | 'alias'>('me');
  const [selectedAlias, setSelectedAlias] = useState('');
  const [customAlias, setCustomAlias] = useState('');
  const [availableAliases, setAvailableAliases] = useState<string[]>([]);
  
  // Admin-only: Custom creation date
  const [customCreatedAt, setCustomCreatedAt] = useState<string>('');
  
  // Data Source State
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [allCollections, setAllCollections] = useState<Collection[]>([]);
  
  // UI State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
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
      loadData();
      document.body.style.overflow = 'hidden';
      
      // Initialize form from initialData when in edit mode (only once per nugget)
      if (mode === 'edit' && initialData && initializedFromDataRef.current !== initialData.id) {
        setTitle(initialData.title || '');
        setIsTitleUserEdited(!!initialData.title); // PHASE 6: Mark as edited if title exists
        setSuggestedTitle(null); // PHASE 3: Clear suggestion in edit mode
        setContent(initialData.content || '');
        setCategories(initialData.categories || []);
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
        
        // Extract URLs from media
        const urlFromMedia = initialData.media?.url || initialData.media?.previewMetadata?.url;
        const initialUrls = urlFromMedia ? [urlFromMedia] : [];
        setUrls(initialUrls);
        previousUrlsRef.current = initialUrls; // Track initial URLs for change detection
        
        if (urlFromMedia) {
          setDetectedLink(urlFromMedia);
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
        
        // CRITICAL FIX: Load existing images from ALL sources (not just images array)
        // Cards use getAllImageUrls() which checks: primaryMedia, supportingMedia, images array, and media field
        // We must do the same in edit mode to show all images that appear in cards
        console.log('[CreateNuggetModal] AUDIT: InitialData received in edit mode:', {
            articleId: initialData.id,
            hasImagesArray: !!(initialData.images && initialData.images.length > 0),
            imagesArray: initialData.images || [],
            hasPrimaryMedia: !!initialData.primaryMedia,
            primaryMedia: initialData.primaryMedia,
            hasSupportingMedia: !!(initialData.supportingMedia && initialData.supportingMedia.length > 0),
            supportingMedia: initialData.supportingMedia || [],
            hasMedia: !!initialData.media,
            media: initialData.media,
            mediaType: initialData.media?.type,
            mediaUrl: initialData.media?.url,
            mediaImageUrl: initialData.media?.previewMetadata?.imageUrl
        });
        
        const allExistingImages = getAllImageUrls(initialData);
        console.log('[CreateNuggetModal] AUDIT: getAllImageUrls result:', {
            imageCount: allExistingImages.length,
            images: allExistingImages,
            fromImagesArray: initialData.images || [],
            fromGetAllImageUrls: allExistingImages
        });
        
        if (allExistingImages.length === 0 && (initialData.images?.length > 0 || initialData.primaryMedia || initialData.supportingMedia?.length > 0)) {
            console.error('[CreateNuggetModal] WARNING: Images exist in article but getAllImageUrls returned empty!', {
                imagesArray: initialData.images,
                primaryMedia: initialData.primaryMedia,
                supportingMedia: initialData.supportingMedia
            });
        }
        
        setExistingImages(allExistingImages);
        
        // Initialize Masonry media items from article
        const mediaItems = collectMasonryMediaItems(initialData);
        
        // TEMPORARY: Log loaded media items to verify masonryTitle was loaded
        console.log('[CreateNuggetModal] Edit mode - Loaded masonry media items:', {
            articleId: initialData.id,
            hasMedia: !!initialData.media,
            mediaMasonryTitle: initialData.media?.masonryTitle,
            mediaShowInMasonry: initialData.media?.showInMasonry,
            mediaItemsCount: mediaItems.length,
            mediaItems: mediaItems.map(item => ({
                id: item.id,
                source: item.source,
                masonryTitle: item.masonryTitle,
                showInMasonry: item.showInMasonry,
            })),
        });
        
        setMasonryMediaItems(mediaItems);
        
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

  const loadData = async () => {
    try {
      const [cats, cols] = await Promise.all([
        storageService.getCategories(),
        storageService.getCollections()
      ]);
      // Filter out any non-string or empty category values
      const validCategories = (cats || []).filter((cat): cat is string => typeof cat === 'string' && cat.trim() !== '');
      setAvailableCategories(validCategories);
      setAllCollections(cols || []);
      setAvailableAliases([]); // Content aliases feature not yet implemented
      setSelectedAlias("Custom...");
    } catch (e) {
      console.error("Failed to load metadata", e);
    }
  };

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
    setCategories([]);
    setVisibility('public');
    setSelectedCollections([]);
    // categoryInput and collectionInput are now managed by components
    setPostAs('me');
    setCustomAlias('');
    setCustomDomain(null);
    setCustomCreatedAt('');
    setError(null);
    setIsAiLoading(false);
    // Reset field-level validation states
    setTagsError(null);
    setContentError(null);
    setTagsTouched(false);
    setContentTouched(false);
    // Reset initialization ref
    initializedFromDataRef.current = null;
    // Reset previous URLs tracking
    previousUrlsRef.current = [];
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
              primaryUrl.includes('twitter.com') || 
              primaryUrl.includes('x.com') ||
              primaryUrl.includes('linkedin.com') ||
              primaryUrl.includes('instagram.com') ||
              primaryUrl.includes('tiktok.com') ||
              primaryUrl.includes('facebook.com') ||
              primaryUrl.includes('threads.net') ||
              primaryUrl.includes('reddit.com')
            );
            
            // Do NOT store suggestedTitle for YouTube/social networks
            if (isYouTubeOrSocial) {
              console.log('[CreateNuggetModal] YouTube/social network detected - skipping title suggestion');
              setSuggestedTitle(null);
            } else if (metadata.previewMetadata?.title) {
              const metaTitle = metadata.previewMetadata.title.trim();
              // Skip if title is just a domain or URL pattern
              const isBadTitle = metaTitle.match(/^(https?:\/\/|www\.|Content from|content from)/i) ||
                                metaTitle.match(/^[a-z0-9-]+\.[a-z]{2,}$/i) || // Just domain
                                metaTitle.length < 3; // Too short
              if (!isBadTitle) {
                console.log('[CreateNuggetModal] Metadata title found, storing as suggestion:', metaTitle);
                setSuggestedTitle(metaTitle);
                // CRITICAL: DO NOT call setTitle() here - title must remain empty until user clicks button
              } else {
                console.log('[CreateNuggetModal] Metadata title rejected as bad title:', metaTitle);
                setSuggestedTitle(null);
              }
            } else {
              console.log('[CreateNuggetModal] No metadata title found');
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
    
    console.log('[CreateNuggetModal] Adding URL:', trimmed);
    
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
          console.log(`[CreateNuggetModal] Added ${uniqueUrls.length} unique URL(s) (${parsedUrls.length - uniqueUrls.length} duplicates skipped)`);
        } else {
          toast.warning('All URLs are already added');
          console.log('[CreateNuggetModal] All URLs were duplicates, none added');
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
          console.log('[CreateNuggetModal] URL added successfully:', finalUrl);
        } else {
          toast.warning('This URL is already added');
          console.log('[CreateNuggetModal] Duplicate URL detected, not added:', finalUrl);
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

    console.log('[CreateNuggetModal] Delete image initiated:', {
      imageUrl,
      nuggetId: initialData.id,
      currentImagesCount: existingImages.length
    });

    // Confirm deletion
    if (!window.confirm('Are you sure you want to delete this image?')) {
      console.log('[CreateNuggetModal] Delete cancelled by user');
      return;
    }

    // Optimistic UI update - remove from state immediately
    const previousImages = [...existingImages];
    const normalizedImageUrl = imageUrl.toLowerCase().trim();
    const optimisticImages = existingImages.filter(img => {
      try {
        const normalized = img.toLowerCase().trim();
        return normalized !== normalizedImageUrl;
      } catch {
        return img !== imageUrl;
      }
    });
    
    setExistingImages(optimisticImages);
    console.log('[CreateNuggetModal] Optimistic update: Removed image from state');

    try {
      console.log('[CreateNuggetModal] Calling DELETE endpoint:', `/api/articles/${initialData.id}/images`);

      // Use apiClient instead of direct fetch to ensure proper proxy routing
      // This avoids CORS issues by using Vite's /api proxy to localhost:5000
      // Note: DELETE with body requires using request() directly since delete() doesn't support body
      const { apiClient } = await import('@/services/apiClient');
      const result = await (apiClient as any).request<{ success: boolean; message: string; images: string[] }>(
        `/articles/${initialData.id}/images`,
        {
          method: 'DELETE',
          body: JSON.stringify({ imageUrl }),
          headers: {
            'Content-Type': 'application/json',
          },
          cancelKey: `delete-image-${initialData.id}`,
        }
      );
      
      console.log('[CreateNuggetModal] Image deleted successfully. Server response:', {
        success: result.success,
        remainingImages: result.images?.length || 0,
        images: result.images
      });
      
      // CRITICAL: Refresh article data to get updated state with all image sources
      // The backend returns updated images array, but we need to recompute from all sources
      // (primaryMedia, supportingMedia, images, media field) to match card behavior
      // The query invalidation below will trigger a refetch, but we update optimistically here
      try {
        // Use queryClient to get fresh data
        const queryData = queryClient.getQueryData<Article>(['article', initialData.id]);
        if (queryData) {
          // Recompute all images using getAllImageUrls (same as cards use)
          const allImages = getAllImageUrls(queryData);
          console.log('[CreateNuggetModal] Recomputing images from cached article:', {
            fromGetAllImageUrls: allImages,
            fromImagesArray: queryData.images || []
          });
          // Note: This is optimistic - the invalidation below will fetch fresh data
          setExistingImages(allImages);
        } else {
          // Fallback to server response if cache miss
          setExistingImages(result.images || []);
        }
      } catch (refreshError) {
        console.warn('[CreateNuggetModal] Failed to recompute images, using server response:', refreshError);
        // Fallback to server response
        setExistingImages(result.images || []);
      }
      
      // Also remove from URLs if it's there (normalized comparison)
      setUrls(urls.filter(u => {
        try {
          const normalized = u.toLowerCase().trim();
          return normalized !== normalizedImageUrl;
        } catch {
          return u !== imageUrl; // Fallback to exact match
        }
      }));
      
      toast.success('Image deleted successfully');
      
      // CRITICAL: Refetch the article to get updated state with all image sources
      // This ensures we see the updated images after deletion from all locations
      // (primaryMedia, supportingMedia, images array, media field)
      try {
        const refreshedArticle = await storageService.getArticleById(initialData.id);
        
        if (refreshedArticle) {
          // Recompute all images using getAllImageUrls (same as cards use)
          const allImages = getAllImageUrls(refreshedArticle);
          console.log('[CreateNuggetModal] Refreshed images after deletion:', {
            fromGetAllImageUrls: allImages,
            imageCount: allImages.length,
            fromImagesArray: refreshedArticle.images || []
          });
          setExistingImages(allImages);
          
          // Update query cache with refreshed article
          queryClient.setQueryData(['article', initialData.id], refreshedArticle);
        }
      } catch (refreshError) {
        console.warn('[CreateNuggetModal] Failed to refresh article after deletion:', refreshError);
        // Fallback: use optimistic update which was already applied
      }
      
      // Invalidate query cache to refresh the article in other components
      await queryClient.invalidateQueries({ queryKey: ['article', initialData.id] });
      await queryClient.invalidateQueries({ queryKey: ['articles'] });
    } catch (error: any) {
      console.error('[CreateNuggetModal] Failed to delete image:', error);
      
      // Rollback optimistic update on error
      setExistingImages(previousImages);
      console.log('[CreateNuggetModal] Rolled back optimistic update due to error');
      
      // Detect CORS errors and provide actionable error message
      let errorMessage = error.message || 'Failed to delete image. Please try again.';
      
      // Check for CORS-related errors
      if (error.message?.includes('CORS') || 
          error.message?.includes('Access-Control') ||
          error.message?.includes('preflight') ||
          error.name === 'TypeError' && error.message?.includes('Failed to fetch')) {
        errorMessage = 'Network error: Unable to connect to server. Please check your connection and try again.';
        console.error('[CreateNuggetModal] CORS or network error detected:', {
          error: error.message,
          name: error.name,
          stack: error.stack
        });
      }
      
      toast.error(errorMessage);
    }
  };

  // addCategory and toggleCollection are now handled by TagSelector and CollectionSelector components

  // Field-level validation functions
  const validateTags = (): string | null => {
    if (categories.length === 0) {
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

  // Validate tags when categories change (if touched)
  useEffect(() => {
    if (tagsTouched) {
      const error = validateTags();
      setTagsError(error);
    }
  }, [categories, tagsTouched]);

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
                      const sizeReduction = ((file.size - processedFile.size) / file.size * 100).toFixed(0);
                      console.log(`Compressed ${file.name}: ${formatFileSize(file.size)} → ${formatFileSize(processedFile.size)} (${sizeReduction}% reduction)`);
                      
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
                      console.log('[CreateNuggetModal] Uploading image to Cloudinary:', file.name, `(${(file.size / 1024).toFixed(2)}KB)`);
                      const uploadResult = await mediaUpload.upload(file); // Use original file for upload
                      if (uploadResult) {
                          // Update attachment with mediaId and secureUrl
                          attachment.mediaId = uploadResult.mediaId;
                          attachment.secureUrl = uploadResult.secureUrl;
                          attachment.isUploading = false;
                          console.log('[CreateNuggetModal] Image uploaded successfully:', {
                              mediaId: uploadResult.mediaId,
                              publicId: uploadResult.publicId,
                              secureUrl: uploadResult.secureUrl
                          });
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
    setMasonryMediaItems(prev => 
      prev.map(item => 
        item.id === itemId ? { ...item, showInMasonry } : item
      )
    );
  };

  // Handle Masonry tile title change
  const handleMasonryTitleChange = (itemId: string, title: string) => {
    setMasonryMediaItems(prev => 
      prev.map(item => 
        item.id === itemId ? { ...item, masonryTitle: title || undefined } : item
      )
    );
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
  useEffect(() => {
    // Only populate in Create mode (Edit mode uses collectMasonryMediaItems from initialData)
    if (mode !== 'create') return;

    const items: MasonryMediaItem[] = [];
    
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
    
    // 1. Primary media (SELECTED by default in Create mode, but NOT locked)
    // CREATE MODE DEFAULT BEHAVIOR:
    // - Primary media defaults to showInMasonry: true (selected by default)
    // - Primary media is NOT locked (isLocked: false) - user can unselect it
    // - If user unselects primary media, nugget won't appear in Masonry (no fallback)
    // - Supporting media remain opt-in (default to false)
    if (primaryUrl) {
      items.push({
        id: 'primary',
        type: (primaryUrlType || 'image') as MediaType,
        url: primaryUrl,
        thumbnail: primaryUrl,
        source: 'primary',
        showInMasonry: true, // Selected by default in Create mode
        isLocked: false, // NOT locked - user can unselect if they don't want nugget in Masonry
        masonryTitle: '', // Default empty, user can set
      });
    }
    
    // 2. Additional image URLs (supporting media)
    imageUrls.forEach((url, index) => {
      // Skip if this is the primary media
      if (url === primaryUrl) return;
      
      items.push({
        id: `url-image-${index}`,
        type: 'image',
        url: url,
        thumbnail: url,
        source: 'supporting',
        showInMasonry: false, // Default to false, user can opt-in
        isLocked: false,
        masonryTitle: '', // Default empty
      });
    });
    
    // 3. Additional non-image URLs (supporting media)
    nonImageUrls.forEach((url, index) => {
      // Skip if this is the primary media
      if (url === primaryUrl) return;
      
      const urlType = detectProviderFromUrl(url);
      items.push({
        id: `url-${urlType}-${index}`,
        type: urlType as MediaType,
        url: url,
        thumbnail: undefined,
        source: 'supporting',
        showInMasonry: false, // Default to false, user can opt-in
        isLocked: false,
        masonryTitle: '', // Default empty
      });
    });
    
    // 4. Image attachments (supporting media)
    imageAttachments.forEach((att, index) => {
      // Skip if this is the primary media
      if (att.secureUrl === primaryUrl) return;
      
      items.push({
        id: `attachment-image-${index}`,
        type: 'image',
        url: att.secureUrl || att.previewUrl,
        thumbnail: att.secureUrl || att.previewUrl,
        source: 'supporting',
        showInMasonry: false, // Default to false, user can opt-in
        isLocked: false,
        masonryTitle: '', // Default empty
      });
    });
    
    setMasonryMediaItems(items);
  }, [mode, urls, attachments]);

  // --- AI HANDLER ---
  const handleAISummarize = async () => {
    if (!content || content.length < 10) {
        toast.error("Please enter some text to summarize first.");
        return;
    }
    
    setIsAiLoading(true);
    try {
        const summary = await aiService.summarizeText(content);
        
        // Safety check if summarization failed silently or returned empty
        if (!summary.title && !summary.excerpt) {
            throw new Error("Empty summary received");
        }

        // Update content with structured format (Title + Summary)
        const formattedContent = `**${summary.title}**\n\n${summary.excerpt}`;
        setContent(formattedContent);
        if (!contentTouched) setContentTouched(true);
        // Clear content error immediately when AI adds content
        if (contentError) {
            const error = validateContent();
            setContentError(error);
        }
        
        // Add unique categories safely
        const returnedTags = Array.isArray(summary.tags) ? summary.tags : [];
        // Filter to only include valid string tags
        const validTags = returnedTags.filter((tag): tag is string => typeof tag === 'string' && tag.trim() !== '');
        const newCats = validTags.filter(tag => !categories.includes(tag));
        
        if (newCats.length > 0) {
            setCategories(prev => [...prev, ...newCats]);
            if (!tagsTouched) setTagsTouched(true);
            // Clear tags error immediately when AI adds tags
            if (tagsError) {
                const error = validateTags();
                setTagsError(error);
            }
            // Optimistically add to available if missing
            newCats.forEach(cat => {
                if (!availableCategories.includes(cat)) {
                    setAvailableCategories(prev => [...prev, cat].filter((c): c is string => typeof c === 'string' && c.trim() !== '').sort());
                }
            });
        }
        
        toast.success("Nugget summarized by AI ?");
    } catch (e) {
        console.error(e);
        toast.error("Failed to generate summary. Try again.");
    } finally {
        setIsAiLoading(false);
    }
  };

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
        const readTime = Math.max(1, Math.ceil(wordCount / 200));

        // Handle edit mode - only update editable fields
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
            
            // Prepare update payload with only editable fields
            // FIX: Include readTime in update payload to ensure it updates when content changes.
            // This matches create-mode behavior where readTime is calculated and included.
            // The readTime calculation uses the same formula (200 words per minute) as create mode.
            const updatePayload: Partial<Article> = {
                title: finalTitle,
                content: content.trim() || '',
                categories,
                visibility,
                readTime, // Recalculated readTime based on updated content (matches create-mode behavior)
            };
            
            // Admin-only: Custom creation date
            if (isAdmin && customCreatedAt) {
                (updatePayload as any).customCreatedAt = new Date(customCreatedAt).toISOString();
            }
            
            // Update excerpt if content changed
            const excerptText = content.trim() || finalTitle || '';
            updatePayload.excerpt = excerptText.length > 150 ? excerptText.substring(0, 150) + '...' : excerptText;
            
            // Handle URLs/media updates using shared utility
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
            
            // Use shared getPrimaryUrl function (SINGLE SOURCE OF TRUTH)
            const primaryUrl = getPrimaryUrl(urls) || detectedLink;
            
            // CRITICAL: Always update media if URLs exist or were changed
            // This ensures media appears after adding URL via Edit
            if (primaryUrl) {
                if (finalMetadata) {
                    // Use fetched metadata
                    updatePayload.media = {
                        ...finalMetadata,
                        previewMetadata: finalMetadata.previewMetadata ? {
                            ...finalMetadata.previewMetadata,
                            url: finalMetadata.previewMetadata.url || primaryUrl || '',
                            siteName: customDomain || finalMetadata.previewMetadata.siteName,
                        } : {
                            url: primaryUrl || '',
                            title: finalTitle,
                            siteName: customDomain || undefined,
                        }
                    };
                } else {
                    // Create minimal media object if metadata not available
                    // This ensures media field is set even if fetch failed
                    updatePayload.media = {
                        type: detectProviderFromUrl(primaryUrl),
                        url: primaryUrl,
                        previewMetadata: {
                            url: primaryUrl,
                            title: finalTitle,
                            siteName: customDomain || undefined,
                        }
                    };
                }
            } else if (urls.length === 0) {
                // URLs were removed, clear media
                updatePayload.media = null;
            }
            // If primaryUrl is null but urls exist (all images), don't update media
            
            // Collect mediaIds and secureUrls from successfully uploaded images in edit mode
            const mediaIds: string[] = [];
            const uploadedImageUrls: string[] = [];
            for (const att of attachments) {
                if (att.type === 'image' && att.mediaId) {
                    mediaIds.push(att.mediaId);
                    // Also collect Cloudinary URLs for display
                    if (att.secureUrl) {
                        uploadedImageUrls.push(att.secureUrl);
                    }
                }
            }
            
            // Include existing mediaIds from initialData
            const existingMediaIds = initialData.mediaIds || [];
            const allMediaIds = [...existingMediaIds, ...mediaIds];
            
            if (allMediaIds.length > 0) {
                updatePayload.mediaIds = allMediaIds;
            }
            
            // CRITICAL: Add Cloudinary URLs to images array for display
            // Combine: existing images (from state, already filtered) + URL input images + uploaded Cloudinary images
            // FIX: Deduplicate to prevent multiple entries of the same image
            console.log('[CreateNuggetModal] Edit mode - Combining images:', {
                existingImages: existingImages.length,
                imageUrls: imageUrls.length,
                uploadedImageUrls: uploadedImageUrls.length
            });
            
            const allImagesRaw = [...existingImages, ...imageUrls, ...uploadedImageUrls];
            
            // Deduplicate by URL (case-insensitive, normalized)
            const imageMap = new Map<string, string>();
            let duplicatesRemoved = 0;
            for (const img of allImagesRaw) {
                if (img && typeof img === 'string' && img.trim()) {
                    const normalized = img.toLowerCase().trim();
                    if (!imageMap.has(normalized)) {
                        imageMap.set(normalized, img); // Keep original casing
                    } else {
                        duplicatesRemoved++;
                        console.log(`[CreateNuggetModal] Edit mode - Duplicate image removed: ${img}`);
                    }
                }
            }
            const allImages = Array.from(imageMap.values());
            
            if (duplicatesRemoved > 0) {
                console.log(`[CreateNuggetModal] Edit mode - Removed ${duplicatesRemoved} duplicate image(s)`);
            }
            
            if (allImages.length > 0) {
                updatePayload.images = allImages;
            }
            
            // Apply showInMasonry flags and masonryTitle from masonryMediaItems state
            // CRITICAL: Backend only stores media in the 'media' field, not primaryMedia/supportingMedia
            // We need to map masonryTitle to the actual 'media' field that gets persisted
            if (masonryMediaItems.length > 0) {
                // CRITICAL FIX: Update the 'media' field with masonryTitle
                // The backend Article model only has 'media' field, not primaryMedia/supportingMedia
                // masonryTitle must be stored in article.media.masonryTitle
                const primaryItem = masonryMediaItems.find(item => item.source === 'primary');
                const legacyMediaItem = masonryMediaItems.find(item => item.source === 'legacy-media');
                
                // Determine which media item should have masonryTitle
                // Priority: legacy-media > primary (if legacy-media exists, it's the actual stored media)
                const mediaItemWithTitle = legacyMediaItem || primaryItem;
                
                if (mediaItemWithTitle && initialData.media) {
                    // Update the media field with masonryTitle and showInMasonry
                    updatePayload.media = {
                        ...initialData.media,
                        showInMasonry: mediaItemWithTitle.showInMasonry,
                        masonryTitle: mediaItemWithTitle.masonryTitle || undefined, // Persist masonry tile title
                    };
                } else if (mediaItemWithTitle && !updatePayload.media && primaryItem) {
                    // If media doesn't exist yet but we have primary media, create it
                    // This handles edge cases where primaryMedia exists but media field doesn't
                    const classified = classifyArticleMedia(initialData);
                    if (classified.primaryMedia) {
                        updatePayload.media = {
                            type: classified.primaryMedia.type,
                            url: classified.primaryMedia.url,
                            thumbnail_url: classified.primaryMedia.thumbnail,
                            aspect_ratio: classified.primaryMedia.aspect_ratio,
                            previewMetadata: classified.primaryMedia.previewMetadata,
                            showInMasonry: primaryItem.showInMasonry,
                            masonryTitle: primaryItem.masonryTitle || undefined,
                        };
                    }
                }
                
                // Also update primaryMedia/supportingMedia for frontend consistency
                // (These are computed fields, but we preserve them for UI state)
                if (initialData.primaryMedia) {
                    if (primaryItem) {
                        updatePayload.primaryMedia = {
                            ...initialData.primaryMedia,
                            showInMasonry: primaryItem.showInMasonry,
                            masonryTitle: primaryItem.masonryTitle || undefined,
                        };
                    }
                }
                
                if (initialData.supportingMedia && initialData.supportingMedia.length > 0) {
                    updatePayload.supportingMedia = initialData.supportingMedia.map((media, index) => {
                        const item = masonryMediaItems.find(item => item.id === `supporting-${index}`);
                        if (item) {
                            return {
                                ...media,
                                showInMasonry: item.showInMasonry,
                                masonryTitle: item.masonryTitle || undefined,
                            };
                        }
                        return media;
                    });
                }
            }
            
            // TEMPORARY: Log payload before sending to trace masonryTitle flow
            console.log('[CreateNuggetModal] Edit mode - Update payload media:', {
                hasMedia: !!updatePayload.media,
                mediaMasonryTitle: updatePayload.media?.masonryTitle,
                mediaShowInMasonry: updatePayload.media?.showInMasonry,
                masonryItemsCount: masonryMediaItems.length,
                masonryItems: masonryMediaItems.map(item => ({
                    id: item.id,
                    source: item.source,
                    masonryTitle: item.masonryTitle,
                    showInMasonry: item.showInMasonry,
                })),
            });
            
            // Call update
            const updatedArticle = await storageService.updateArticle(initialData.id, updatePayload);
            
            // TEMPORARY: Log response to verify masonryTitle was saved
            console.log('[CreateNuggetModal] Edit mode - Updated article media:', {
                hasMedia: !!updatedArticle?.media,
                mediaMasonryTitle: updatedArticle?.media?.masonryTitle,
                mediaShowInMasonry: updatedArticle?.media?.showInMasonry,
            });
            
            if (!updatedArticle) {
                throw new Error('Failed to update nugget');
            }
            
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
                    console.error('[CreateNuggetModal] REGRESSION: Media object exists but missing URL field');
                }
                if (!updatedArticle.media.previewMetadata) {
                    console.error('[CreateNuggetModal] REGRESSION: Media object exists but missing previewMetadata');
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

        // Separate image URLs from regular URLs
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

        // Note: Image URLs are handled separately via media field
        // They are not added to mediaIds array

        const finalAliasName = selectedAlias === 'Custom...' ? customAlias : selectedAlias;

        // Use shared getPrimaryUrl function (SINGLE SOURCE OF TRUTH)
        const primaryUrl = getPrimaryUrl(urls) || detectedLink;
        
        // Generate excerpt from content if available, otherwise use title or empty
        const excerptText = content.trim() || finalTitle || '';
        const excerpt = excerptText.length > 150 ? excerptText.substring(0, 150) + '...' : excerptText;
        
        /**
         * PHASE 4: Tag Data Contract
         * 
         * Tags are stored in the 'categories' state variable in the frontend.
         * When submitting to the backend, we must send them as 'tags' (string[]).
         * 
         * Contract:
         * - Frontend state: categories (string[])
         * - Backend field: tags (string[])
         * - Minimum requirement: >= 1 non-empty string
         * - Validation: Frontend validates before submit, backend validates on receive
         * 
         * This normalization ensures:
         * 1. Only valid string tags are sent (filters out null/undefined/empty)
         * 2. Tags match categories (single source of truth)
         * 3. Backend receives the expected format
         */
        const validTags = categories.filter((tag): tag is string => 
            typeof tag === 'string' && tag.trim().length > 0
        );
        
        // PHASE 5: Regression safeguard - defensive assertion
        // This should never trigger if validation works correctly, but prevents silent failures
        if (validTags.length === 0) {
            setTagsError("Please add at least one tag. Tags enable smarter news discovery.");
            setIsSubmitting(false);
            return;
        }
        
        // Combine image URLs: from URL input + uploaded Cloudinary images
        // FIX: Deduplicate to prevent multiple entries of the same image
        console.log('[CreateNuggetModal] Create mode - Combining images:', {
            imageUrls: imageUrls.length,
            uploadedImageUrls: uploadedImageUrls.length
        });
        
        const allImageUrlsRaw = [...imageUrls, ...uploadedImageUrls];
        
        // Deduplicate by URL (case-insensitive, normalized)
        const imageMap = new Map<string, string>();
        let duplicatesRemoved = 0;
        for (const img of allImageUrlsRaw) {
            if (img && typeof img === 'string' && img.trim()) {
                const normalized = img.toLowerCase().trim();
                if (!imageMap.has(normalized)) {
                    imageMap.set(normalized, img); // Keep original casing
                } else {
                    duplicatesRemoved++;
                    console.log(`[CreateNuggetModal] Create mode - Duplicate image removed: ${img}`);
                }
            }
        }
        const allImageUrls = Array.from(imageMap.values());
        
        if (duplicatesRemoved > 0) {
            console.log(`[CreateNuggetModal] Create mode - Removed ${duplicatesRemoved} duplicate image(s)`);
        }
        
        const newArticle = await storageService.createArticle({
            title: finalTitle,
            content: content.trim() || '', // Send empty string if no content (allowed when URLs/images exist)
            excerpt: excerpt,
            author: { id: currentUserId, name: authorName },
            displayAuthor: (postAs === 'alias' && finalAliasName.trim()) ? { name: finalAliasName.trim() } : undefined,
            categories,
            tags: validTags, // FIX: Use categories (tags) instead of empty array 
            readTime,
            mediaIds: mediaIds.length > 0 ? mediaIds : undefined, // CRITICAL: Send mediaIds instead of Base64 images
            images: allImageUrls.length > 0 ? allImageUrls : undefined, // CRITICAL: Cloudinary URLs for display
            documents: uploadedDocs,
            visibility,
            // Admin-only: Custom creation date
            ...(isAdmin && customCreatedAt ? { customCreatedAt: new Date(customCreatedAt).toISOString() } : {}),
            // Store multiple URLs in a custom field if supported, or use first URL for media
            // For now, using first URL for media compatibility
            // Also create media object for text nuggets if customDomain is set (for source badge display)
            // CRITICAL: Apply masonry fields from masonryMediaItems state
            media: (() => {
                // Find primary media item from masonryMediaItems
                const primaryItem = masonryMediaItems.find(item => item.source === 'primary');
                
                const baseMedia = linkMetadata ? {
                    ...linkMetadata,
                    previewMetadata: linkMetadata.previewMetadata ? {
                        ...linkMetadata.previewMetadata,
                        url: linkMetadata.previewMetadata.url || primaryUrl || '',
                        siteName: customDomain || linkMetadata.previewMetadata.siteName,
                    } : {
                        url: primaryUrl || '',
                        title: finalTitle,
                        siteName: customDomain || undefined,
                    }
                } : (primaryUrl ? {
                    type: detectProviderFromUrl(primaryUrl),
                    url: primaryUrl,
                    previewMetadata: {
                        url: primaryUrl,
                        title: finalTitle,
                        siteName: customDomain || undefined,
                    }
                } : (customDomain ? {
                    // For text nuggets with custom domain, create minimal media object for source badge
                    type: 'link' as const,
                    url: `https://${customDomain}`,
                    previewMetadata: {
                        url: `https://${customDomain}`,
                        title: finalTitle,
                        siteName: customDomain,
                    }
                } : null));
                
                // Apply masonry fields if primary media item exists
                // CREATE MODE: Primary media defaults to showInMasonry: true (selected by default)
                // Use value from masonryMediaItems state (user may have unselected it)
                if (baseMedia && primaryItem) {
                    return {
                        ...baseMedia,
                        // Use value from masonryMediaItems state (defaults to true in Create mode, but user can unselect)
                        showInMasonry: primaryItem.showInMasonry !== undefined ? primaryItem.showInMasonry : true,
                        masonryTitle: primaryItem.masonryTitle || undefined,
                    };
                }
                
                return baseMedia;
            })(),
            source_type: (primaryUrl || imageUrls.length > 0) ? 'link' : 'text',
            // Store additional URLs in content or a notes field if needed
            // For now, we'll append URLs to content if they're not already there
            // This is a temporary solution until we add a proper urls field to Article type
        });

        const allCols = await storageService.getCollections();
        for (const colName of selectedCollections) {
            let targetCol = allCols.find(c => c.name === colName);
            if (!targetCol) {
                targetCol = await storageService.createCollection(colName, '', currentUserId, visibility);
            }
            await storageService.addArticleToCollection(targetCol.id, newArticle.id, currentUserId);
        }

        await queryClient.invalidateQueries({ queryKey: ['articles'] });
        
        // REGRESSION SAFEGUARD: Assert that if URL exists, media must be present
        if (primaryUrl && newArticle.media === null) {
            const errorMsg = `[CreateNuggetModal] REGRESSION: URL exists but media is null after create. URL: ${primaryUrl}, ArticleId: ${newArticle.id}`;
            console.error(errorMsg);
            if (process.env.NODE_ENV === 'development') {
                console.error('This indicates a bug in URL + media processing. Media should always be set when a URL is present.');
            }
        }
        
        handleClose();
    } catch (e: any) {
        console.error("Failed to create nugget", e);
        
        // Use unified error handling
        logError('CreateNuggetModal', e, { title, attachmentsCount: attachments.length, urlsCount: urls.length, categoriesCount: categories.length });
        
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={handleClose} />
      
      <div 
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="relative w-full h-full sm:h-auto sm:max-h-[85vh] sm:max-w-2xl bg-white dark:bg-slate-900 sm:rounded-2xl shadow-2xl flex flex-col animate-in zoom-in-95 fade-in duration-200 border border-slate-200 dark:border-slate-800 overflow-hidden"
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
                        selected={categories}
                        availableCategories={availableCategories}
                        onSelectedChange={setCategories}
                        onAvailableCategoriesChange={setAvailableCategories}
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
                        onAvailableCollectionsChange={setAllCollections}
                        currentUserId={currentUserId}
                        comboboxRef={collectionsComboboxRef}
                        listboxRef={collectionsListboxRef}
                    />
                </div>

                {/* Title Field */}
                <div className="space-y-2">
                    <TitleInput
                        value={title}
                        onChange={(value) => {
                            setTitle(value);
                            setIsTitleUserEdited(true); // PHASE 6: Mark as user-edited
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
                    isAiLoading={isAiLoading}
                    onAiSummarize={handleAISummarize}
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

                {/* CRITICAL FIX: Existing images must render independently of URLs input */}
                {/* Show existing images from article (edit mode only) - OUTSIDE of URL conditional */}
                {/* This ensures images are visible even when no URLs are in the input field */}
                {(() => {
                    const shouldRender = mode === 'edit' && existingImages.length > 0;
                    console.log('[CreateNuggetModal] AUDIT: Rendering check for existing images:', {
                        mode: mode,
                        existingImagesCount: existingImages.length,
                        existingImages: existingImages,
                        shouldRender: shouldRender,
                        isEditMode: mode === 'edit',
                        hasImages: existingImages.length > 0
                    });
                    
                    if (!shouldRender) {
                        if (mode === 'edit' && existingImages.length === 0) {
                            console.warn('[CreateNuggetModal] WARNING: Edit mode but no existing images found. Check getAllImageUrls() result.');
                        }
                        return null;
                    }
                    
                    return (
                    <div className="space-y-2 mb-4">
                        <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            Existing Images ({existingImages.length})
                        </div>
                        <div className={`grid gap-2 ${existingImages.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                            {existingImages.map((imageUrl, idx) => {
                                const detectedType = detectProviderFromUrl(imageUrl);
                                const isCloudinaryUrl = imageUrl.includes('cloudinary.com') || imageUrl.includes('res.cloudinary.com');
                                console.log(`[CreateNuggetModal] Rendering existing image ${idx}:`, {
                                    url: imageUrl,
                                    type: detectedType,
                                    isCloudinary: isCloudinaryUrl,
                                    mode: mode
                                });
                                return (
                                    <div key={`existing-${idx}`} className="relative group rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 shadow-sm">
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                e.preventDefault();
                                                console.log(`[CreateNuggetModal] Delete button clicked for image ${idx}:`, imageUrl);
                                                deleteImage(imageUrl);
                                            }} 
                                            className="absolute top-2 right-2 bg-red-600 text-white p-1.5 rounded-full opacity-90 hover:opacity-100 transition-opacity z-10 hover:bg-red-700 shadow-lg"
                                            title="Delete image"
                                            aria-label="Delete image"
                                        >
                                            <X size={14} />
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
                    );
                })()}

                {/* Masonry Media Toggle (Create and Edit Mode) */}
                {/* 
                  ROOT CAUSE FIX: Previously only shown in Edit mode due to mode === 'edit' condition.
                  Now shown in both modes when media items exist. In Create mode, masonryMediaItems
                  is populated from attachments and URLs via useEffect hook.
                */}
                {masonryMediaItems.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <MasonryMediaToggle
                      items={masonryMediaItems}
                      onToggle={handleMasonryMediaToggle}
                      onTitleChange={handleMasonryTitleChange}
                    />
                  </div>
                )}

                {/* Link Preview */}
                {(urls.length > 0 || detectedLink) && (() => {
                    // Separate image URLs from regular URLs for display
                    const imageUrls = urls.filter(url => detectProviderFromUrl(url) === 'image');
                    const linkUrls = urls.filter(url => detectProviderFromUrl(url) !== 'image');
                    const primaryLinkUrl = linkUrls.length > 0 ? linkUrls[0] : detectedLink;
                    const hasMultipleImages = imageUrls.length > 1;
                    const hasMultipleLinks = linkUrls.length > 1;
                    
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
                                            
                                            const fallbackMetadata = { 
                                                url: primaryLinkUrl || '', 
                                                title: primaryLinkUrl || '' 
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
            onBulkCreate={() => { handleClose(); navigate('/bulk-create'); }}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            canSubmit={
                // PHASE 5: Regression safeguard - disable submit if tags are empty
                categories.length > 0 && 
                !!(content.trim() || title.trim() || urls.length > 0 || attachments.length > 0)
            }
        />

      </div>
    </div>,
    document.body
  );
};


