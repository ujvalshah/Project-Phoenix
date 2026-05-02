import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  startTransition,
  Suspense,
  lazy,
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useCallback,
} from 'react';
// useNavigate removed - not currently used in this component
import { X, Loader2, Zap } from 'lucide-react';
import { getInitials } from '@/utils/formatters';
import { storageService } from '@/services/storageService';
import { detectProviderFromUrl, looksLikeMultipleUrls, splitPastedUrlCandidates } from '@/utils/urlUtils';
import { queryClient } from '@/queryClient';
import { GenericLinkPreview } from './embeds/GenericLinkPreview';
import { Collection } from '@/types';
import { shallowEqualAuth, useAuthSelector } from '@/context/AuthContext';
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
import { DimensionTagPicker } from './CreateNuggetModal/DimensionTagPicker';
import { CollectionSelector } from './CreateNuggetModal/CollectionSelector';
import { UrlInput } from './CreateNuggetModal/UrlInput';
import { AttachmentManager, FileAttachment } from './CreateNuggetModal/AttachmentManager';
import { MasonryMediaToggle } from './CreateNuggetModal/MasonryMediaToggle';
import type { UnifiedMediaItem } from './CreateNuggetModal/UnifiedMediaManager';
import { ExternalLinksSection } from './CreateNuggetModal/ExternalLinksSection';
import { LayoutVisibilitySection } from './CreateNuggetModal/LayoutVisibilitySection';
import { MasonryMediaItem } from '@/utils/masonryMediaHelper';
import { classifyArticleMedia } from '@/utils/mediaClassifier';
import type { Article, ExternalLink, LayoutVisibility } from '@/types';
import { DEFAULT_LAYOUT_VISIBILITY } from '@/types';
import { normalizeArticleInput } from '@/shared/articleNormalization/normalizeArticleInput';
import { buildDuplicatePrefill } from '@/shared/articleNormalization/duplicatePrefill';
import { useImageManager } from '@/hooks/useImageManager';
import { isFeatureEnabled } from '@/constants/featureFlags';
import { validateBeforeSave } from '@/shared/articleNormalization/preSaveValidation';
import { articleKeys, invalidateArticleListCaches, patchArticleAcrossCaches } from '@/services/queryKeys/articleKeys';
import { useAllCollections } from '@/hooks/useNuggetFormData';
import { useDisclaimerConfig } from '@/hooks/useDisclaimerConfig';
import { NuggetContentEditorPanel } from './CreateNuggetModal/NuggetContentEditorPanel';
import type { ContentDraft } from '@/components/modals/shellDraft';
import { articleToContentDraft } from '@/components/modals/shellDraft';

const UnifiedMediaManagerLazy = lazy(() =>
  import('./CreateNuggetModal/UnifiedMediaManager').then((m) => ({ default: m.UnifiedMediaManager })),
);

const unifiedMediaManagerFallback = (
  <div
    className="flex min-h-[140px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-900/40"
    role="status"
    aria-label="Loading media tools"
  >
    <Loader2 className="h-7 w-7 animate-spin text-primary-500" aria-hidden />
  </div>
);

function devLog(...args: unknown[]): void {
  if (import.meta.env.DEV) {
    console.log(...args);
  }
}

/** When Market Pulse is disabled, editor cannot target pulse/both streams (API + UX stay on standard). */
function clampEditorContentStream(
  stream: Article['contentStream'] | undefined,
): 'standard' | 'pulse' | 'both' {
  if (!isFeatureEnabled('MARKET_PULSE')) return 'standard';
  return stream || 'standard';
}

export interface CreateNuggetModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: 'create' | 'edit';
  initialData?: Article;
  prefillData?: Article;
}

export type NuggetComposerContentProps = CreateNuggetModalProps & {
  shellTitle: string;
  onShellTitleChange: (value: string) => void;
  shellVisibility: 'public' | 'private';
  onShellVisibilityChange: (value: 'public' | 'private') => void;
  /** Card excerpt from shell; empty => normalize generates from body/title */
  shellExcerpt: string;
  /**
   * Summary slice for body/tags initial hydration (Phase 3). When omitted, derived from Article props.
   */
  contentDraft?: ContentDraft;
  shellFileInputRef: React.RefObject<HTMLInputElement | null>;
  onFooterMetaChange: (meta: {
    canSubmit: boolean;
    isSubmitting: boolean;
    contentError: string | null;
    titleFieldWarning: string | null;
  }) => void;
  onComposerReady: () => void;
  shellPanelRef: React.RefObject<HTMLDivElement | null>;
};

export type NuggetComposerHandle = {
  submitPublish: () => void;
  submitDraft: () => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  notifyTitleEditedByUser: () => void;
  onShellTitleBlur: () => void;
  onUserChangedVisibility: () => void;
};

// FileAttachment is now imported from AttachmentManager

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB (before compression)
const MAX_FILE_SIZE_AFTER_COMPRESSION = 500 * 1024; // 500KB (after compression)

const MODAL_FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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

export const NuggetComposerContent = forwardRef<NuggetComposerHandle, NuggetComposerContentProps>(
  function NuggetComposerContent(props, ref) {
    const {
      isOpen,
      onClose,
      mode = 'create',
      initialData,
      prefillData,
      shellTitle,
      onShellTitleChange,
      shellVisibility,
      onShellVisibilityChange,
      shellExcerpt,
      contentDraft: contentDraftProp,
      shellFileInputRef,
      onFooterMetaChange,
      onComposerReady,
      shellPanelRef,
    } = props;
  const title = shellTitle;
  const visibility = shellVisibility;
  // Auth
  const { currentUser, currentUserId, isAdmin } = useAuthSelector(
    (a) => ({
      currentUser: a.user,
      currentUserId: a.user?.id || '',
      isAdmin: a.user?.role === 'admin',
    }),
    shallowEqualAuth,
  );
  const authorName = currentUser?.name || 'User';
  const currentLifecycleStatus: 'draft' | 'published' =
    initialData?.status === 'draft' ? 'draft' : 'published';
  const toast = useToast();

  const duplicatePrefillPayload = useMemo(
    () => (mode === 'create' && prefillData ? buildDuplicatePrefill(prefillData) : null),
    [mode, prefillData]
  );
  const duplicatePrefillArticle = duplicatePrefillPayload?.article;
  const duplicatePrefillUrls = duplicatePrefillPayload?.sourceUrls || [];

  const resolvedContentDraft = useMemo<ContentDraft>(
    () =>
      contentDraftProp ??
      articleToContentDraft(
        mode === 'edit' ? initialData : duplicatePrefillArticle ?? prefillData,
      ),
    [contentDraftProp, mode, initialData, duplicatePrefillArticle, prefillData],
  );

  // Unified image management hook (Phase 9: Legacy code removed)
  const imageManager = useImageManager(mode, initialData, duplicatePrefillArticle);
  
  // Store syncFromArticle in ref to avoid dependency on imageManager object
  // syncFromArticle is stable (useCallback with []), so ref update is safe
  const syncFromArticleRef = useRef(imageManager.syncFromArticle);
  syncFromArticleRef.current = imageManager.syncFromArticle; // Update ref on every render (function is stable)

  // Ref to track if form has been initialized from initialData (prevents re-initialization)
  const initializedFromDataRef = useRef<string | null>(null);
  /** Baseline editorial collection ids (current visibility) for edit save diff */
  const editInitialCollectionIdsRef = useRef<string[]>([]);
  
  // Ref to track previous URLs for change detection (CRITICAL for Edit mode)
  const previousUrlsRef = useRef<string[]>([]);

  // Content State
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
  const fileInputRef = shellFileInputRef;
  const pastedImagesBufferRef = useRef<File[]>([]);
  const pasteBatchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Image state managed by useImageManager hook (Phase 9: Legacy code removed)
  const existingImages = imageManager.existingImages;
  const masonryMediaItems = imageManager.masonryItems;
  
  // Media upload hook
  const mediaUpload = useMediaUpload({ purpose: 'nugget' });
  
  // Refs for accessibility and focus management (panel lives in NuggetModalShell)
  const modalRef = shellPanelRef;
  const modalTabFocusableListRef = useRef<HTMLElement[]>([]);
  const collectionsComboboxRef = useRef<HTMLDivElement>(null);
  const collectionsListboxRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  /** Latest handleClose for Escape-to-close (focus effect is declared before handleClose). */
  const handleCloseRef = useRef<() => void>(() => {});
  // Keep toast reference stable for async effects.
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const sameCollectionIds = (a: Collection[], b: Collection[]): boolean => {
    if (a.length !== b.length) return false;
    const ids = new Set(a.map((c) => c.id));
    if (ids.size !== b.length) return false;
    return b.every((c) => ids.has(c.id));
  };

  // Metadata State
  const [dimensionTagIds, setDimensionTagIds] = useState<string[]>([]);
  const [contentStream, setContentStream] = useState<'standard' | 'pulse' | 'both'>('standard');
  /** Selected editorial collection document ids (public or private), never display names */
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>([]);
  /** Server: all editorial collections that include this article (edit mode) */
  const [editArticleCollections, setEditArticleCollections] = useState<Collection[]>([]);
  
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
    feed: true,
  });

  // Disclaimer State — default reads from site-wide config via hook
  const { data: disclaimerConfigData } = useDisclaimerConfig();
  const [showDisclaimer, setShowDisclaimer] = useState<boolean>(true);
  const [disclaimerText, setDisclaimerText] = useState<string>('');
  // Sync default from config on first load (create mode only)
  const disclaimerDefaultApplied = React.useRef(false);
  React.useEffect(() => {
    if (disclaimerConfigData && !disclaimerDefaultApplied.current && mode !== 'edit') {
      setShowDisclaimer(disclaimerConfigData.enableByDefault);
      disclaimerDefaultApplied.current = true;
    }
  }, [disclaimerConfigData, mode]);

  // Explicitly deleted images tracked by useImageManager hook (Phase 9: Legacy code removed)
  const explicitlyDeletedImages = imageManager.explicitlyDeletedUrls;

  // Defer paged public+private collection fetches to the next frame so open click can paint first.
  const [collectionsQueryReady, setCollectionsQueryReady] = useState(false);
  useEffect(() => {
    if (!isOpen) {
      setCollectionsQueryReady(false);
      return;
    }
    const id = requestAnimationFrame(() => {
      setCollectionsQueryReady(true);
    });
    return () => {
      cancelAnimationFrame(id);
    };
  }, [isOpen]);
  
  // Data Source State - Now using React Query for caching and automatic refetch
  // Note: queryClient is imported from @/queryClient (singleton instance)

  const {
    data: allCollections = [],
    isLoading: _isLoadingCollections, // eslint-disable-line @typescript-eslint/no-unused-vars -- Available for future loading state UI
  } = useAllCollections({ enabled: isOpen && collectionsQueryReady });

  // UI State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [_isLoading, setIsLoading] = useState(false); // eslint-disable-line @typescript-eslint/no-unused-vars
  // AI loading state removed - AI creation system has been fully removed
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; fileName: string } | null>(null);
  
  // Field-level validation states
  const [contentError, setContentError] = useState<string | null>(null);
  const [contentTouched, setContentTouched] = useState(false);

  // Store previous active element for focus restoration
  useEffect(() => {
    if (isOpen) {
      previousActiveElementRef.current = document.activeElement as HTMLElement;
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    startTransition(() => {
      // Data loading is now handled by React Query hooks (useAllCollections)
      // No need to call loadData() - React Query provides caching and automatic refetch
      
      // Initialize form from article data (edit or duplicate prefill) only once per source.
      const articleToInitialize = mode === 'edit' ? initialData : duplicatePrefillArticle;
      const initializationKey = articleToInitialize?.id || null;

      if (articleToInitialize && initializationKey && initializedFromDataRef.current !== initializationKey) {
        setIsTitleUserEdited(!!articleToInitialize.title); // PHASE 6: Mark as edited if title exists
        setSuggestedTitle(null); // PHASE 3: Clear suggestion in edit mode
        /** Phase 3: ContentDraft-first; Article fallback only if draft body empty (transitional). */
        setContent(
          resolvedContentDraft.content !== ''
            ? resolvedContentDraft.content
            : (articleToInitialize.content || ''),
        );
        setDimensionTagIds(
          resolvedContentDraft.tagIds.length > 0
            ? [...resolvedContentDraft.tagIds]
            : [...(articleToInitialize.tagIds ?? [])],
        );
        // Initialize customCreatedAt if article has isCustomCreatedAt flag (admin only)
        if (mode === 'edit' && isAdmin && (articleToInitialize as any).isCustomCreatedAt && articleToInitialize.publishedAt) {
          // Convert ISO string to datetime-local format (YYYY-MM-DDTHH:mm)
          const date = new Date(articleToInitialize.publishedAt);
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          setCustomCreatedAt(`${year}-${month}-${day}T${hours}:${minutes}`);
        }
        setContentStream(clampEditorContentStream(articleToInitialize.contentStream));
        // Initialize externalLinks and layoutVisibility from initialData
        setExternalLinks(articleToInitialize.externalLinks || []);
        setLayoutVisibility(articleToInitialize.layoutVisibility || {
          grid: true,
          masonry: true,
          feed: true,
        });
        // Initialize disclaimer from initialData
        if (articleToInitialize.showDisclaimer !== undefined) {
          setShowDisclaimer(articleToInitialize.showDisclaimer);
        }
        setDisclaimerText(articleToInitialize.disclaimerText || '');

        // V2: displayImageId will be initialized in a separate effect after masonryMediaItems loads
        // This ensures we use the actual item ID from imageManager (not a mismatched generated one)

        // Extract URLs from media - collect all unique source URLs
        // Priority: previewMetadata.url (original source) > media.url (if different and not Cloudinary)
        const isCloudinaryUrl = (url: string) => url.includes('cloudinary.com') || url.includes('res.cloudinary');
        const contentUrls: string[] = [];

        // 1. Original source URL (from unfurl metadata) - highest priority
        if (mode === 'create' && duplicatePrefillUrls.length > 0) {
          contentUrls.push(...duplicatePrefillUrls);
        } else if (articleToInitialize.media?.previewMetadata?.url) {
          contentUrls.push(articleToInitialize.media.previewMetadata.url);
        }

        // 2. media.url if different from previewMetadata.url and not a Cloudinary URL
        if (articleToInitialize.media?.url) {
          const mediaUrl = articleToInitialize.media.url;
          const isDifferent = mediaUrl !== articleToInitialize.media?.previewMetadata?.url;
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
          if (articleToInitialize.media) {
            setLinkMetadata(articleToInitialize.media);
          }
        } else {
          setDetectedLink(null);
          setLinkMetadata(null);
        }
        
        // Note: We don't pre-fill attachments in edit mode (file objects).
        // Editorial collections load via getCollectionsContainingArticle + editArticleCollections.
        // MediaIds are preserved from initialData and will be included in update
        
        // Phase 3: defer heavy image graph hydration so shell + ContentDraft fields can commit first.
        startTransition(() => {
          imageManager.syncFromArticle(articleToInitialize);
        });
        
        initializedFromDataRef.current = initializationKey;
      } else if (mode === 'create') {
        // Reset initialization ref when switching to create mode
        initializedFromDataRef.current = null;
      }
    });
  }, [isOpen, mode, initialData, duplicatePrefillArticle, duplicatePrefillUrls, isAdmin, resolvedContentDraft]);

  // Load editorial collection membership when editing (runs after init effect sets visibility)
  useEffect(() => {
    if (!isOpen || mode !== 'edit' || !initialData?.id || !currentUserId) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const cols = await storageService.getCollectionsContainingArticle(initialData.id);
        if (cancelled) return;
        setEditArticleCollections((prev) => (sameCollectionIds(prev, cols) ? prev : cols));
      } catch {
        if (!cancelled) {
          toastRef.current.error('Could not load collections for this nugget');
          setEditArticleCollections((prev) => (prev.length === 0 ? prev : []));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, mode, initialData?.id, currentUserId]);

  // Map membership to the picker for the active article visibility (public vs private)
  useEffect(() => {
    if (!isOpen || mode !== 'edit') return;
    const ids = editArticleCollections.filter((c) => c.type === visibility).map((c) => c.id);
    setSelectedCollectionIds((prev) => {
      if (
        prev.length === ids.length &&
        prev.every((value, index) => value === ids[index])
      ) {
        return prev;
      }
      return ids;
    });
    editInitialCollectionIdsRef.current = [...ids];
  }, [isOpen, mode, visibility, editArticleCollections]);

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
    if (!isOpen) {
      modalTabFocusableListRef.current = [];
      return;
    }

    const modal = modalRef.current;
    if (!modal) return;

    const collectFocusable = () => {
      modalTabFocusableListRef.current = Array.from(
        modal.querySelectorAll(MODAL_FOCUSABLE_SELECTOR),
      ) as HTMLElement[];
    };

    collectFocusable();
    const onFocusInCapture = () => {
      requestAnimationFrame(() => {
        collectFocusable();
      });
    };
    modal.addEventListener('focusin', onFocusInCapture, true);

    // Focus first focusable element after a short delay to allow DOM to settle
    const timer = setTimeout(() => {
      collectFocusable();
      const firstFocusable =
        modalTabFocusableListRef.current[0] ??
        (modal.querySelector(MODAL_FOCUSABLE_SELECTOR) as HTMLElement);
      firstFocusable?.focus();
    }, 100);

    // Focus trap handler (uses cached list; on-demand one collect if list empty)
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      let focusableElements = modalTabFocusableListRef.current;
      if (focusableElements.length === 0) {
        collectFocusable();
        focusableElements = modalTabFocusableListRef.current;
      }
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (!firstElement) return;

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
          handleCloseRef.current();
        }
      }
    };

    modal.addEventListener('keydown', handleTab);
    document.addEventListener('keydown', handleEscape);
    return () => {
      clearTimeout(timer);
      modal.removeEventListener('focusin', onFocusInCapture, true);
      modal.removeEventListener('keydown', handleTab);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  // loadData function removed - now using React Query hooks (useAllCollections)
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
    onShellTitleChange('');
    setIsTitleUserEdited(false);
    setSuggestedTitle(null);
    setContent('');
    setUrls([]);
    setUrlInput('');
    setDetectedLink(null);
    setLinkMetadata(null);
    setAttachments([]);
    setDimensionTagIds([]);
    onShellVisibilityChange('public');
    setSelectedCollectionIds([]);
    setEditArticleCollections([]);
    editInitialCollectionIdsRef.current = [];
    // categoryInput and collectionInput are now managed by components
    setPostAs('me');
    setCustomAlias('');
    setCustomDomain(null);
    setCustomCreatedAt('');
    setError(null);
    setIsLoading(false);
    // Reset field-level validation states
    setContentError(null);
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
      feed: true,
    });
    // Reset disclaimer
    setShowDisclaimer(true);
    setDisclaimerText('');
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

  handleCloseRef.current = handleClose;

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
    const parts = splitPastedUrlCandidates(text);

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
    
    // Multiple URLs: newlines or 2+ http(s) schemes — do NOT use bare commas (Substack CDN paths contain commas)
    const hasMultipleUrls = looksLikeMultipleUrls(trimmed);
    
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
    
    const hasMultipleUrls = looksLikeMultipleUrls(pastedText);
    
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
      queryClient.invalidateQueries({ queryKey: articleKeys.detail(initialData.id), exact: true });
      queryClient.invalidateQueries({ queryKey: articleKeys.legacyDetail(initialData.id), exact: true });
      await invalidateArticleListCaches(queryClient);
    } catch (error: any) {
      console.error('[CreateNuggetModal] Failed to delete image:', error);
      // Rollback via imageManager
      imageManager.rollbackDeletion(imageUrl);
      toast.error(error.message || 'Failed to delete image. Please try again.');
    }
  };

  // addCategory and toggleCollection are now handled by TagSelector and CollectionSelector components

  // Field-level validation functions
  const validateContent = (): string | null => {
    const hasContent = content.trim() || title.trim();
    const hasUrl = urls.length > 0;
    const hasAttachment = attachments.length > 0;
    
    if (!hasContent && !hasUrl && !hasAttachment) {
      return "Please add some content, a URL, or an attachment to create a nugget.";
    }
    return null;
  };

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
      imageManager.toggleGrid(item.url, showInGrid);
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

  // Convert masonryMediaItems to UnifiedMediaItem format (thumbnail: displayImageId or first item)
  const unifiedMediaItems: UnifiedMediaItem[] = masonryMediaItems.map((item, index) => ({
    id: item.id,
    url: item.url,
    type: item.type,
    thumbnail: item.thumbnail,
    isDisplayImage: displayImageId ? item.id === displayImageId : index === 0,
    showInMasonry: item.showInMasonry,
    showInGrid: item.showInGrid,
    masonryTitle: item.masonryTitle,
    previewMetadata: item.previewMetadata,
  }));

  const handleSetDisplayImage = (itemId: string | null) => {
    setDisplayImageId(itemId);
    devLog('[MediaSection] Display image changed:', itemId || '(reset to default)');
  };

  const handleDeleteMedia = (itemId: string) => {
    const item = masonryMediaItems.find(m => m.id === itemId);
    if (!item?.url) return;
    // In edit mode, use full delete flow (API + cache invalidation) so the image is removed on the server
    // and the nugget card / reopened modal reflect the change. Otherwise we only remove from local state.
    if (mode === 'edit' && initialData) {
      deleteImage(item.url);
    } else {
      imageManager.deleteImage(item.url);
      imageManager.confirmDeletion(item.url);
    }
  };

  const handleReorderMedia = (sourceIndex: number, destinationIndex: number) => {
    imageManager.reorderImages(sourceIndex, destinationIndex);
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
   * - Supporting images (URL or upload): showInMasonry: true (all images in masonry by default; user can unselect)
   * - Supporting non-image URLs (video, etc.): showInMasonry: false (opt-in)
   * - If user unselects all masonry-selected media, nugget won't appear in Masonry (no fallback)
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
    // - All supporting media (images AND non-images) default to showInMasonry: true
    // - User can opt-out by unselecting any media item
    
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
        showInMasonry: true,
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
        showInMasonry: true, // Default to true in Create mode; user can opt-out
        type: urlType as MediaType,
      });
    });
    
    // 4. Add image attachments (supporting media)
    imageAttachments.forEach((att) => {
      const url = att.secureUrl || att.previewUrl;
      // Skip if this is the primary media or if URL is not available
      if (!url || url === primaryUrl) return;
      
      imageManager.addImage(url, 'upload', {
        showInMasonry: true,
        type: 'image',
        mediaId: att.mediaId,
        thumbnail: url,
      });
    });
    
    // Masonry items are now managed by imageManager
    // The imageManager automatically derives masonryItems from state.images
    
    // Debug logging (temporary - remove after validation)
    if (process.env.NODE_ENV === 'development') {
      devLog('[CreateNuggetModal] Images synced to imageManager:', {
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

  /**
   * Build submit-safe masonry items from the latest form state.
   *
   * Why this exists:
   * Pasted screenshots are uploaded async and can land in `attachments` a tick before
   * `imageManager.masonryItems` finishes syncing via effect. If user submits in that
   * window, those images are saved only in `images[]` (without masonry flags), so they
   * reopen as unselected in Edit mode.
   *
   * Fix:
   * Reconcile missing URLs from current `urls` + uploaded `attachments` at submit time.
   * Any missing media is injected as masonry-selected by default.
   */
  const getMasonryItemsForSubmit = (): MasonryMediaItem[] => {
    const currentItems = imageManager.masonryItems;
    const byUrl = new Map(
      currentItems
        .filter(item => typeof item.url === 'string' && item.url.trim().length > 0)
        .map(item => [item.url.toLowerCase().trim(), item])
    );

    const attachmentUrls = attachments
      .filter(att => att.type === 'image' && !!att.secureUrl)
      .map(att => att.secureUrl as string);

    const primaryUrlFromUrls = getPrimaryUrl(urls);
    const fallbackPrimaryUrl = primaryUrlFromUrls || attachmentUrls[0] || null;

    const nextItems: MasonryMediaItem[] = [...currentItems];

    const addIfMissing = (
      url: string,
      source: MasonryMediaItem['source'],
      forceImageType = false
    ) => {
      const key = url.toLowerCase().trim();
      if (!key || byUrl.has(key)) return;

      const detectedType = forceImageType
        ? 'image'
        : (detectProviderFromUrl(url) as MediaType);

      nextItems.push({
        id: `submit-${Date.now()}-${nextItems.length}`,
        type: detectedType,
        url,
        thumbnail: url,
        source,
        showInMasonry: true,
        showInGrid: true,
        isLocked: false,
      });
      byUrl.set(key, nextItems[nextItems.length - 1]);
    };

    // Ensure primary exists when we can infer one from current form state.
    if (fallbackPrimaryUrl) {
      const primaryKey = fallbackPrimaryUrl.toLowerCase().trim();
      const hasPrimaryItem = nextItems.some(item => item.source === 'primary');
      if (!hasPrimaryItem && !byUrl.has(primaryKey)) {
        const isAttachmentPrimary = attachmentUrls.some(
          u => u.toLowerCase().trim() === primaryKey
        );
        addIfMissing(fallbackPrimaryUrl, 'primary', isAttachmentPrimary);
      }
    }

    // Reconcile URL media that may not have synced yet.
    for (const url of urls) {
      if (!url) continue;
      const isPrimary = fallbackPrimaryUrl && url.toLowerCase().trim() === fallbackPrimaryUrl.toLowerCase().trim();
      addIfMissing(url, isPrimary ? 'primary' : 'supporting');
    }

    // Reconcile uploaded screenshot/image attachments that may still be missing.
    for (const url of attachmentUrls) {
      if (!url) continue;
      const isPrimary = fallbackPrimaryUrl && url.toLowerCase().trim() === fallbackPrimaryUrl.toLowerCase().trim();
      addIfMissing(url, isPrimary ? 'primary' : 'supporting', true);
    }

    return nextItems;
  };

  // AI summarize handler removed - AI creation system has been fully removed


  const handleSubmit = async (intent: 'draft' | 'publish') => {
    // Mark all fields as touched to show validation errors
    setContentTouched(true);

    // Validate field-level errors first
    const tagsErr = dimensionTagIds.length === 0
      ? "Please select at least one classification tag."
      : null;
    const contentErr = validateContent();

    setContentError(contentErr);

    // If field errors exist, stop submission
    if (tagsErr || contentErr) {
      if (tagsErr) {
        setError(tagsErr);
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
        devLog('[CONTENT_TRACE] Stage 1 - Before submit (form state)', {
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
            const currentMasonryItems = getMasonryItemsForSubmit();
            
            // Debug logging to verify masonry state
            if (process.env.NODE_ENV === 'development') {
              devLog('[CreateNuggetModal] Edit submit - masonry state:', {
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
                    tags: [], // Tags resolved from dimensionTagIds on backend
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
                    excerptOverride: shellExcerpt.trim() !== '' ? shellExcerpt : undefined,
                },
                {
                    mode: 'edit',
                    enrichMediaItemIfNeeded,
                    classifyArticleMedia,
                }
            );

            const validationResultEdit = validateBeforeSave(
              initialData,
              {
                title: normalizedInput.title,
                content: normalizedInput.content,
                tagIds: dimensionTagIds,
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

            if (!validationResultEdit.isValid) {
              validationResultEdit.errors.forEach(err => toast.error(err.message));
              setIsSubmitting(false);
              return;
            }

            if (validationResultEdit.warnings.length > 0) {
              const warningMessages = validationResultEdit.warnings.map(w => `• ${w.message}`).join('\n');
              const proceed = window.confirm(
                `Warning:\n${warningMessages}\n\nDo you want to proceed anyway?`
              );
              if (!proceed) {
                setIsSubmitting(false);
                return;
              }
            }

            if (process.env.NODE_ENV === 'development') {
              devLog('[CreateNuggetModal] Pre-save validation result:', {
                isValid: validationResultEdit.isValid,
                errors: validationResultEdit.errors,
                warnings: validationResultEdit.warnings,
                integrityChecks: validationResultEdit.integrityChecks,
              });
            }
            
            // Convert normalized output to partial update payload
            // CRITICAL: Only include fields that have changed (EDIT mode semantics)
            const updatePayload: Partial<Article> = {
                title: normalizedInput.title,
                content: normalizedInput.content,
                visibility: normalizedInput.visibility,
                readTime: normalizedInput.readTime,
                excerpt: normalizedInput.excerpt,
                tagIds: dimensionTagIds, // Classification tags (sole source of truth)
            };
            if (currentLifecycleStatus === 'draft') {
              updatePayload.status = intent === 'publish' ? 'published' : 'draft';
            } else {
              updatePayload.status = 'published';
            }
            
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
            updatePayload.showDisclaimer = showDisclaimer;
            updatePayload.disclaimerText = disclaimerText.trim() || null;
            updatePayload.contentStream = clampEditorContentStream(contentStream);

            if (displayImageId) {
              const displayIndex = currentMasonryItems.findIndex(m => m.id === displayImageId);
              if (displayIndex >= 0) {
                updatePayload.displayImageIndex = displayIndex;
              }
            }
            
            // Final debug log before submit
            const includedFields = Object.keys(updatePayload);
            devLog('[EDIT FINALIZED] Edit payload built from normalizeArticleInput', {
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

            const prevCol = editInitialCollectionIdsRef.current;
            const nextCol = selectedCollectionIds;
            const prevSet = new Set(prevCol);
            const nextSet = new Set(nextCol);
            const toAddCol = nextCol.filter((id) => !prevSet.has(id));
            const toRemoveCol = prevCol.filter((id) => !nextSet.has(id));
            for (const id of toAddCol) {
              await storageService.addArticleToCollection(id, initialData.id, currentUserId);
            }
            for (const id of toRemoveCol) {
              await storageService.removeArticleFromCollection(id, initialData.id, currentUserId);
            }
            editInitialCollectionIdsRef.current = [...nextCol];
            try {
              const refreshedCols = await storageService.getCollectionsContainingArticle(initialData.id);
              setEditArticleCollections((prev) =>
                sameCollectionIds(prev, refreshedCols) ? prev : refreshedCols
              );
            } catch {
              /* non-fatal */
            }

            // DEBUG: Log what the backend returned
            devLog('[EDIT RESULT] Backend returned article:', {
                hasSupportingMedia: !!updatedArticle.supportingMedia,
                supportingMediaCount: updatedArticle.supportingMedia?.length || 0,
                supportingMediaOrder: updatedArticle.supportingMedia?.map((m: any) => m.url?.slice(-30)),
            });
            
            // CRITICAL: Invalidate and refresh all query caches
            // This ensures feed, drawer, and inline views show updated media
            await invalidateArticleListCaches(queryClient);
            
            // Also update specific article cache if it exists
            queryClient.setQueryData(articleKeys.detail(initialData.id), updatedArticle);
            queryClient.setQueryData(articleKeys.legacyDetail(initialData.id), updatedArticle);
            
            // Optimistically update query cache for immediate UI update
            patchArticleAcrossCaches(queryClient, updatedArticle.id, () => updatedArticle);
            
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
        const currentMasonryItems = getMasonryItemsForSubmit();
        
        // Debug logging to verify masonry state
        if (process.env.NODE_ENV === 'development') {
          devLog('[CreateNuggetModal] Create submit - masonry state:', {
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
                tags: [], // Tags resolved from dimensionTagIds on backend
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
                excerptOverride: shellExcerpt.trim() !== '' ? shellExcerpt : undefined,
            },
            {
                mode: 'create',
                enrichMediaItemIfNeeded,
                classifyArticleMedia,
            }
        );

        // TEMPORARY DEBUG: Stage 2 - After normalizeArticleInput() output
        devLog('[CONTENT_TRACE] Stage 2 - After normalizeArticleInput() output', {
            mode: 'create',
            hasMedia: !!normalized.media,
            source_type: normalized.source_type,
            primaryUrl: normalized.primaryUrl,
            contentLength: normalized.content.length,
            contentPreview: normalized.content.substring(0, 120),
            mediaType: normalized.media?.type,
            mediaUrl: normalized.media?.url,
        });

        const validationResultCreate = validateBeforeSave(
          null, // No original article in create mode
          {
            title: normalized.title,
            content: normalized.content,
            tagIds: dimensionTagIds,
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

        if (!validationResultCreate.isValid) {
          validationResultCreate.errors.forEach(err => toast.error(err.message));
          setIsSubmitting(false);
          return;
        }

        if (validationResultCreate.warnings.length > 0) {
          const warningMessages = validationResultCreate.warnings.map(w => `• ${w.message}`).join('\n');
          const proceed = window.confirm(
            `Warning:\n${warningMessages}\n\nDo you want to proceed anyway?`
          );
          if (!proceed) {
            setIsSubmitting(false);
            return;
          }
        }

        if (process.env.NODE_ENV === 'development') {
          devLog('[CreateNuggetModal] Pre-save validation result (create):', {
            isValid: validationResultCreate.isValid,
            errors: validationResultCreate.errors,
            warnings: validationResultCreate.warnings,
            integrityChecks: validationResultCreate.integrityChecks,
          });
        }

        // TEMPORARY DEBUG: Stage 3 - Payload sent to API (before storageService.createArticle)
        const createPayload = {
            title: normalized.title,
            content: normalized.content,
            excerpt: normalized.excerpt,
            author: { id: currentUserId, name: authorName },
            displayAuthor: (postAs === 'alias' && finalAliasName.trim()) ? { name: finalAliasName.trim() } : undefined,
            tags: [] as string[], // Resolved from tagIds by backend at response time
            tagIds: dimensionTagIds,
            readTime: normalized.readTime,
            mediaIds: normalized.mediaIds,
            images: normalized.images,
            documents: normalized.documents,
            visibility: normalized.visibility,
            status: (intent === 'publish' ? 'published' : 'draft') as 'draft' | 'published',
            ...(normalized.customCreatedAt ? { customCreatedAt: normalized.customCreatedAt } : {}),
            media: normalized.media,
            supportingMedia: normalized.supportingMedia,
            source_type: normalized.source_type,
            externalLinks,
            layoutVisibility: layoutVisibility,
            showDisclaimer,
            disclaimerText: disclaimerText.trim() || null,
            contentStream: clampEditorContentStream(contentStream),
            ...(displayImageId
              ? {
                  displayImageIndex: currentMasonryItems.findIndex(m => m.id === displayImageId),
                }
              : {}),
        };
        devLog('[CONTENT_TRACE] Stage 3 - Payload sent to API (final request body)', {
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

        for (const collectionId of selectedCollectionIds) {
            await storageService.addArticleToCollection(collectionId, newArticle.id, currentUserId);
        }

        await invalidateArticleListCaches(queryClient);

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
        logError('CreateNuggetModal', e, { title, attachmentsCount: attachments.length, urlsCount: urls.length, tagIdsCount: dimensionTagIds.length });

        const apiError = formatApiError(e);
        const baseErrorMessage = getUserFriendlyMessage(apiError);
        
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

  const canSubmitComputed =
    dimensionTagIds.length > 0 &&
    !!(content.trim() || title.trim() || urls.length > 0 || attachments.length > 0);

  const titleFieldWarning =
    contentTouched && !contentError && !content.trim() && !title.trim() && urls.length === 0 && attachments.length === 0
      ? 'Add some content, a URL, or an attachment before submitting.'
      : null;

  useEffect(() => {
    onFooterMetaChange({
      canSubmit: canSubmitComputed,
      isSubmitting,
      contentError,
      titleFieldWarning,
    });
  }, [canSubmitComputed, isSubmitting, contentError, titleFieldWarning, onFooterMetaChange]);

  useLayoutEffect(() => {
    onComposerReady();
  }, [onComposerReady]);

  useImperativeHandle(
    ref,
    () => ({
      submitPublish: () => {
        void handleSubmit('publish');
      },
      submitDraft: () => {
        void handleSubmit('draft');
      },
      onFileSelect: handleFileUpload,
      notifyTitleEditedByUser: () => {
        if (mode === 'edit') setAllowMetadataOverride(true);
        if (!contentTouched) setContentTouched(true);
        if (contentError) setContentError(validateContent());
      },
      onShellTitleBlur: () => {
        if (!contentTouched) setContentTouched(true);
        setContentError(validateContent());
      },
      onUserChangedVisibility: () => setSelectedCollectionIds([]),
    }),
    [handleSubmit, handleFileUpload, mode, contentTouched, contentError],
  );

  return (
    <>
      <div className="p-4 space-y-4 border-t border-slate-100 dark:border-slate-800">
                {/* Identity & stream toolbar (public/private in shell) */}
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

                    <div className="flex items-center gap-3 flex-wrap justify-end sm:justify-start w-full sm:w-auto">
                        {/* Content stream selector — gated by feature flag (public/private live in modal shell) */}
                        {isFeatureEnabled('MARKET_PULSE') && (
                          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
                            <button
                              onClick={() => setContentStream('standard')}
                              className={`px-2.5 py-1.5 text-[10px] font-bold rounded-md transition-all ${contentStream === 'standard' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500'}`}
                            >
                              Standard
                            </button>
                            <button
                              onClick={() => setContentStream('pulse')}
                              className={`px-2.5 py-1.5 text-[10px] font-bold rounded-md flex items-center gap-1 transition-all ${contentStream === 'pulse' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500'}`}
                            >
                              <Zap size={10} /> Pulse
                            </button>
                            <button
                              onClick={() => setContentStream('both')}
                              className={`px-2.5 py-1.5 text-[10px] font-bold rounded-md transition-all ${contentStream === 'both' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500'}`}
                            >
                              Both
                            </button>
                          </div>
                        )}
                    </div>
                </div>

                {/* Organization Rows - Collections and Classification Tags */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                    <CollectionSelector
                        selected={selectedCollectionIds}
                        availableCollections={allCollections}
                        visibility={visibility}
                        onSelectedChange={setSelectedCollectionIds}
                        showTechnicalIds={false}
                        comboboxRef={collectionsComboboxRef}
                        listboxRef={collectionsListboxRef}
                    />
                    <DimensionTagPicker
                        selectedTagIds={dimensionTagIds}
                        onSelectedChange={setDimensionTagIds}
                        disabled={isSubmitting}
                    />
                </div>

                <div className="space-y-2" data-testid="layout-visibility-section-v2">
                  <LayoutVisibilitySection
                    visibility={layoutVisibility}
                    onChange={setLayoutVisibility}
                    hasMedia={unifiedMediaItems.length > 0}
                    hasMasonrySelectedMedia={unifiedMediaItems.some(m => m.showInMasonry)}
                    disabled={isSubmitting}
                  />
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
                {/* DISCLAIMER SECTION */}
                {/* ═══════════════════════════════════════════════════════════════════ */}
                <div className="space-y-3" data-testid="disclaimer-section">
                  <div className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                    <span>Disclaimer</span>
                  </div>
                  <label className={`
                    flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all
                    ${showDisclaimer
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                    }
                    ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary-400'}
                  `}>
                    <input
                      type="checkbox"
                      checked={showDisclaimer}
                      onChange={() => setShowDisclaimer(!showDisclaimer)}
                      disabled={isSubmitting}
                      className="w-4 h-4 text-primary-500 border-slate-300 rounded focus:ring-primary-500"
                    />
                    <span className={`text-sm ${showDisclaimer ? 'text-slate-700 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400'}`}>
                      Show disclaimer on this nugget
                    </span>
                  </label>
                  {showDisclaimer && (
                    <div className="space-y-1">
                      <textarea
                        value={disclaimerText}
                        onChange={(e) => setDisclaimerText(e.target.value)}
                        disabled={isSubmitting}
                        placeholder="Leave blank to use site-wide default disclaimer..."
                        maxLength={500}
                        rows={2}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 placeholder-slate-400 resize-none"
                      />
                      <p className="text-[10px] text-slate-400">
                        {disclaimerText.length > 0
                          ? `Custom disclaimer (${disclaimerText.length}/500). This overrides the site-wide default for this nugget only.`
                          : 'Uses the site-wide default disclaimer. Enter text here to override for this nugget only.'
                        }
                      </p>
                    </div>
                  )}
                </div>

                {/* Editor area — async or inlined ContentEditor (see NuggetContentEditorPanel) */}
                <NuggetContentEditorPanel
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
                  <Suspense fallback={unifiedMediaManagerFallback}>
                    <UnifiedMediaManagerLazy
                      items={unifiedMediaItems}
                      onReorder={handleReorderMedia}
                      onDelete={handleDeleteMedia}
                      onSetDisplayImage={handleSetDisplayImage}
                      onToggleMasonry={handleMasonryMediaToggle}
                      onToggleGrid={handleGridMediaToggle}
                      onMasonryTitleChange={handleMasonryTitleChange}
                      onAddMedia={() => fileInputRef.current?.click()}
                      disabled={isSubmitting}
                      showClearThumbnail
                    />
                  </Suspense>
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
    </>
  );
  },
);

export default NuggetComposerContent;
