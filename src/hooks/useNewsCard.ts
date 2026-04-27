import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Article } from '@/types';
import { useToast } from './useToast';
import { useRequireAuth } from './useRequireAuth';
import { storageService } from '@/services/storageService';
import { queryClient } from '@/queryClient';
import { hasValidAuthor, logError, prepareArticleForNewsCard } from '@/utils/errorHandler';
import { getAllImageUrls, getPersistedImageUrls, classifyArticleMedia } from '@/utils/mediaClassifier';
import { extractYouTubeVideoId } from '@/utils/youtubeUtils';
import { useVideoPlayerActions } from '@/context/VideoPlayerContext';
import { useAuthSelector } from '@/context/AuthContext';
import { articleKeys, invalidateArticleListCaches, patchArticleAcrossCaches } from '@/services/queryKeys/articleKeys';
// formatDate removed - using relative time formatting in CardMeta instead

// ────────────────────────────────────────
// STRICT TYPE CONTRACT (MANDATORY)
// ────────────────────────────────────────

export interface NewsCardData {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  formattedDate: string;
  authorName: string;
  authorId: string;
  authorAvatarUrl?: string; // Phase 3: Avatar support
  tags: string[];
  hasMedia: boolean;
  isLink: boolean;
  isNoteOrIdea: boolean;
  isTextNugget: boolean;
  sourceType: string | undefined;
  visibility: 'public' | 'private' | undefined;
  showContributor: boolean;
  contributorName?: string;
  shouldShowTitle: boolean;
  media: Article['media'];
  images: string[] | undefined;
  video: string | undefined;
  cardType: 'hybrid' | 'media-only'; // Two-card architecture: Hybrid (default) or Media-Only
  externalLinks?: Article['externalLinks']; // External links for link button
  showDisclaimer?: boolean; // Whether to show disclaimer
  disclaimerText?: string | null; // Per-nugget disclaimer override (null = use default)
}

export interface NewsCardFlags {
  isRead: boolean;
}

export interface NewsCardHandlers {
  onShare: (() => void) | undefined;
  onClick: (() => void) | undefined;
  onMediaClick: (e: React.MouseEvent, imageIndex?: number) => void;
  onCategoryClick: (category: string) => void;
  onTagClick?: (tag: string) => void;
  onDelete?: () => void;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onReport?: () => void;
  onAddToCollection?: (e: React.MouseEvent) => void;
  onToggleVisibility?: () => void;
  onAuthorClick: ((authorId: string) => void) | undefined;
  onToggleMenu: (e: React.MouseEvent) => void;
  onToggleTagPopover: (e: React.MouseEvent) => void;
  onCloseTagPopover: () => void;
  onReadMore: () => void;
}

export interface NewsCardLogic {
  data: NewsCardData;
  flags: NewsCardFlags;
  handlers: NewsCardHandlers;
  cardElementId?: string; // For scrollToCard from mini player
}

interface UseNewsCardProps {
  article: Article;
  /** When true, `article` must already be from {@link prepareArticleForNewsCard} (e.g. ArticleGrid list). */
  skipArticlePrepare?: boolean;
  currentUserId?: string;
  onCategoryClick?: (category: string) => void;
  onTagClick?: (tag: string) => void;
  onClick?: (article: Article) => void;
  isPreview?: boolean;
}

export const useNewsCard = ({
  article: articleInput,
  skipArticlePrepare = false,
  currentUserId,
  onCategoryClick,
  onTagClick,
  onClick,
  isPreview = false,
}: UseNewsCardProps) => {
  const navigate = useNavigate();
  const toast = useToast();
  const isAdmin = useAuthSelector((a) => a.user?.role === 'admin');
  const { withAuth } = useRequireAuth();

  // ────────────────────────────────────────
  // STATE
  // ────────────────────────────────────────
  const [showCollection, setShowCollection] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showTagPopover, setShowTagPopover] = useState(false);
  const [showFullModal, setShowFullModal] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const [lightboxInitialIndex, setLightboxInitialIndex] = useState(0);
  const [collectionMode, setCollectionMode] = useState<'public' | 'private'>('public');
  const [showLinkPreview, setShowLinkPreview] = useState(false);
  const [linkPreviewUrl, setLinkPreviewUrl] = useState<string | null>(null);
  
  const { playVideo } = useVideoPlayerActions();
  const cardElementIdRef = useRef<string>(`video-card-${articleInput.id}`);
  const [collectionAnchor, setCollectionAnchor] = useState<DOMRect | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);

  // ────────────────────────────────────────
  // CLICK OUTSIDE HANDLER
  // ────────────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const clickedMenuPanel = !!target?.closest('[data-card-actions-menu="true"]');
      if (menuRef.current && !menuRef.current.contains(event.target as Node) && !clickedMenuPanel) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  // ────────────────────────────────────────
  // COMPUTED VALUES / DERIVED DATA
  // ────────────────────────────────────────
  const article = useMemo((): Article => {
    if (
      skipArticlePrepare &&
      articleInput &&
      typeof articleInput.id === 'string' &&
      hasValidAuthor(articleInput)
    ) {
      return articleInput;
    }
    const p = prepareArticleForNewsCard(articleInput);
    if (!p) {
      logError('useNewsCard', new Error('Invalid article data'), { article: articleInput });
      throw new Error('Invalid article: article is null or undefined');
    }
    return p as Article;
  }, [articleInput, skipArticlePrepare]);

  const isOwner = currentUserId === article.author.id;

  const mediaClassification = useMemo(() => classifyArticleMedia(article), [article]);
  const primaryMedia = mediaClassification.primaryMedia;
  
  // ═══════════════════════════════════════════════════════════════════════
  // MEDIA DETECTION: Comprehensive check for all media types
  // ═══════════════════════════════════════════════════════════════════════
  // Check for media in all possible locations:
  // 1. Primary/supporting media (new format)
  // 2. Legacy media field
  // 3. Legacy images array
  // 4. Legacy video field
  const hasPrimaryMedia = !!article.primaryMedia;
  const hasSupportingMedia = !!(article.supportingMedia && article.supportingMedia.length > 0);
  const hasLegacyMedia = !!article.media;
  const hasLegacyImages = !!(article.images && article.images.length > 0);
  const hasLegacyVideo = !!article.video;
  
  // Media exists if ANY of these conditions are true
  const hasMedia = hasPrimaryMedia || hasSupportingMedia || hasLegacyMedia || hasLegacyImages || hasLegacyVideo;
  
  const isLink = article.source_type === 'link';
  const isNoteOrIdea = article.source_type === 'note' || article.source_type === 'idea';
  const isTextNugget = !hasMedia && !isLink;
  const showContributor = !!(article.addedBy && article.addedBy.userId !== article.author.id); // Phase 3: Ensure boolean type

  // ────────────────────────────────────────
  // TITLE RESOLUTION (Priority: User title > Metadata title > None)
  // ────────────────────────────────────────
  /**
   * Resolves card title using priority order:
   * 1. User-provided title (article.title) - always wins if present and non-empty
   * 2. Metadata title (OG/video/document title from previewMetadata)
   * 3. Empty string (no title)
   * 
   * This enables automatic title display for rich-link media (YouTube, articles, Google Drive)
   * when metadata is available, without overwriting user-entered titles.
   * 
   * Note: Empty strings are treated as "no user title" to allow metadata fallback.
   */
  const resolveCardTitle = (): string => {
    // Priority 1: User-provided title (always wins if present and non-empty)
    const userTitle = article.title?.trim();
    if (userTitle) {
      return userTitle;
    }
    
    // Priority 2: Metadata title (from OG tags, video metadata, document metadata)
    const metadataTitle = article.media?.previewMetadata?.title?.trim();
    if (metadataTitle) {
      return metadataTitle;
    }
    
    // Priority 3: No title
    return '';
  };

  const resolvedTitle = resolveCardTitle();
  const shouldShowTitle = !!resolvedTitle && !isNoteOrIdea;
  
  // CRITICAL: For cardType classification, only check user-provided title, NOT metadata titles
  // Metadata titles should be used for display but shouldn't force cards to be hybrid
  // This allows media-only cards to display metadata titles in overlay without being promoted to hybrid
  const hasUserProvidedTitle = !!article.title?.trim() && !isNoteOrIdea;

  // ────────────────────────────────────────
  // CARD TYPE CLASSIFICATION (Two-card architecture)
  // ────────────────────────────────────────
  /**
   * Two-card architecture:
   * 1. 'hybrid' - Media + Text (default) - Media block at top, tags, title, body content, footer
   * 2. 'media-only' - Media fills card height, optional short caption (2-3 lines max), footer
   * 
   * PROMOTION RULE: If text would need truncation (>2-3 lines), MUST be Hybrid Card
   * "If text needs truncation, it is not a Media-Only card."
   * 
   * Media-Only cards are ONLY for:
   * - Primarily visual content (chart, screenshot, graphic, tweet, image)
   * - Text content does NOT exceed 2-3 lines (short caption)
   * - No long-form body content
   * - No user-provided title (metadata titles are allowed and displayed in overlay)
   * 
   * IMPORTANT: CardType classification uses hasUserProvidedTitle (user-entered title only),
   * NOT shouldShowTitle (which includes metadata titles). This allows media-only cards to
   * display metadata titles (e.g., YouTube video titles) without being forced to hybrid.
   */
  
  // Helper: Estimate if text would exceed 2-3 lines (rough estimate: ~150-200 chars per 2-3 lines)
  // This is a heuristic - actual line count depends on container width, but this is conservative
  const estimateTextLength = (text: string): number => {
    if (!text) return 0;
    // Strip markdown headers for estimation
    const stripped = text.replace(/^#{1,2}\s+/gm, '').trim();
    return stripped.length;
  };
  
  // Helper: Count actual lines in text (more accurate than character count)
  const countTextLines = (text: string): number => {
    if (!text) return 0;
    const stripped = text.replace(/^#{1,2}\s+/gm, '').trim();
    if (!stripped) return 0;
    // Count non-empty lines
    const lines = stripped.split('\n').filter(line => line.trim().length > 0);
    return lines.length;
  };
  
  const contentText = article.content || article.excerpt || '';
  const estimatedLength = estimateTextLength(contentText);
  // Rough estimate: 2-3 lines ≈ 150-200 characters (conservative: use 200 as threshold)
  const CAPTION_THRESHOLD = 200; // Characters that fit in 2-3 lines
  const MAX_PREVIEW_LINES = 3; // Maximum lines for media-only caption
  
  // Memoize on the article reference: ArticleGrid pins per-article identity
  // across pagination appends, so this re-runs only when the underlying article
  // actually changes (used by ghost-image dev check + handleMediaClick below).
  const allImageUrls = useMemo(() => getAllImageUrls(article), [article]);

  // Ghost-image detection (dev only). Previously ran synchronously on every
  // render — for a 100-card feed that's 200+ Set constructions per re-render.
  // Defer to a commit-time effect keyed on article id + image identity so it
  // only runs when the source actually changes.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const persistedImageUrls = getPersistedImageUrls(article);
    const persistedSet = new Set(persistedImageUrls.map(url => url.toLowerCase().trim()));
    const ghostImages = allImageUrls.filter(url => !persistedSet.has(url.toLowerCase().trim()));
    if (ghostImages.length > 0) {
      console.warn('ghost-image-detected', {
        articleId: article.id.substring(0, 8) + '...',
        renderCount: allImageUrls.length,
        persistedCount: persistedImageUrls.length,
        ghostImages,
        allRenderUrls: allImageUrls,
        allPersistedUrls: persistedImageUrls,
      });
    }
  }, [article, allImageUrls]);
  
  // Get trimmed body text for classification
  const trimmedBody = contentText.trim();
  const trimmedBodyLineCount = countTextLines(trimmedBody);
  
  // Determine card type with promotion rule.
  let cardType: 'hybrid' | 'media-only';

  // ═══════════════════════════════════════════════════════════════════════
  // ENFORCEMENT RULE: Long Text → MUST be Hybrid (regardless of media)
  // ═══════════════════════════════════════════════════════════════════════
  // If a card contains non-empty body text beyond the allowed preview line limit,
  // it MUST be treated as a HYBRID card, and truncation + fade MUST apply.
  // This applies to: single images, multiple images, any media type
  // Do NOT treat cards with long text as media-only, even if they have media.
  const hasLongText = Boolean(trimmedBody) && trimmedBodyLineCount > MAX_PREVIEW_LINES;

  if (!hasMedia) {
    cardType = 'hybrid';
  } else if (hasLongText) {
    cardType = 'hybrid';
  } else {
    // CRITICAL: Use trimmedBodyLineCount consistently (same as enforcement rule)
    const hasMinimalText = estimatedLength <= CAPTION_THRESHOLD && !contentText.trim().includes('\n\n');
    const hasMinimalLines = trimmedBodyLineCount <= MAX_PREVIEW_LINES;
    // Media-Only ONLY if: minimal text AND no user-provided title (metadata titles don't count).
    cardType = hasMinimalText && hasMinimalLines && !hasUserProvidedTitle ? 'media-only' : 'hybrid';
  }
  
  // ────────────────────────────────────────
  // DATA (formatted/derived)
  // ────────────────────────────────────────
  const data: NewsCardData = {
    id: article.id,
    title: resolvedTitle,
    excerpt: article.excerpt || article.content || '',
    content: article.content || '',
    formattedDate: article.publishedAt, // Phase 3: Pass raw ISO string for relative time formatting
    authorName: article.author.name,
    authorId: article.author.id,
    authorAvatarUrl: article.author.avatar_url, // Phase 3: Include avatar URL
    tags: article.tags || [],
    hasMedia,
    isLink,
    isNoteOrIdea,
    isTextNugget,
    sourceType: article.source_type,
    visibility: article.visibility,
    showContributor,
    contributorName: article.addedBy?.name,
    shouldShowTitle,
    media: article.media,
    images: article.images,
    video: article.video,
    cardType, // Two-card architecture: 'hybrid' | 'media-only'
    externalLinks: article.externalLinks, // External links for link button
    showDisclaimer: article.showDisclaimer,
    disclaimerText: article.disclaimerText,
  };

  // ────────────────────────────────────────
  // FLAGS
  // ────────────────────────────────────────
  const flags: NewsCardFlags = {
    // Deferred feature — backend support pending
    isRead: false, // TODO: Implement read tracking if needed
  };

  // ────────────────────────────────────────
  // HANDLERS
  // ────────────────────────────────────────

  const handleShare = () => {
    // Share logic can be added here if needed
    // For now, ShareMenu component handles this
  };

  const handleClick = () => {
    // If parent provides onClick handler, let it handle opening the modal
    // Otherwise, open the internal modal
    if (onClick) {
      onClick(article);
    } else {
      // Only open internal modal if no parent handler is provided
      setShowFullModal(true);
    }
  };

  const handleMediaClick = (e: React.MouseEvent, imageIndex?: number) => {
    e?.stopPropagation();
    
    // YOUTUBE VIDEOS: Expand inline in card (not modal)
    // This maintains context and provides better UX
    // Check multiple sources: primaryMedia, article.media, and article.video
    const isYouTube = 
      primaryMedia?.type === 'youtube' ||
      article.media?.type === 'youtube' ||
      (article.video && (article.video.includes('youtube.com') || article.video.includes('youtu.be')));
    
    if (isYouTube) {
      const youtubeUrl = primaryMedia?.url || article.media?.url || article.video;
      const videoTitle = primaryMedia?.previewMetadata?.title || article.title || '';
      if (youtubeUrl) {
        playVideo({
          videoUrl: youtubeUrl,
          videoTitle,
          startTime: 0,
          cardElementId: cardElementIdRef.current,
          articleId: article.id,
        });
      }
      return;
    }
    
    // IMAGES: Always open in-app viewer (never new tab)
    // This follows progressive-disclosure UX: images stay in context
    if (allImageUrls.length > 0 || article.media?.type === 'image') {
      // Store image index for initial display if provided
      if (imageIndex !== undefined) {
        setLightboxInitialIndex(imageIndex);
      }
      setShowLightbox(true);
      return;
    }
    
    // NON-IMAGE MEDIA: Progressive disclosure - show preview modal for links
    // Links, documents, etc. show preview modal before opening
    const linkUrl = article.media?.previewMetadata?.url || article.media?.url;
    if (linkUrl) {
      // Show link preview modal for progressive disclosure
      setLinkPreviewUrl(linkUrl);
      setShowLinkPreview(true);
    } else {
      // For other media types without URL, open full modal
      setShowFullModal(true);
    }
  };

  const handleCategoryClick = (category: string) => {
    if (onCategoryClick) {
      onCategoryClick(category);
    }
  };

  const handleTagClick = (tag: string) => {
    if (onTagClick) {
      onTagClick(tag);
    }
  };

  const handleDelete = async () => {
    setShowMenu(false);
    if (window.confirm('Delete this nugget permanently?')) {
      await storageService.deleteArticle(article.id);
      await invalidateArticleListCaches(queryClient);
      await queryClient.invalidateQueries({ queryKey: articleKeys.detail(article.id), exact: true });
      toast.success('Nugget deleted');
    }
  };

  const [showEditModal, setShowEditModal] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  const handleEdit = () => {
    setShowEditModal(true);
    setShowMenu(false);
  };

  const handleDuplicate = () => {
    toast.info(`Duplicating "${article.title?.trim() || 'Untitled'}"`);
    setShowDuplicateModal(true);
    setShowMenu(false);
  };

  const handleOpenDetails = () => {
    // Open Article Details drawer (same as clicking the card)
    if (onClick) {
      onClick(article);
    } else {
      setShowFullModal(true);
    }
  };

  const handleReport = () => {
    setShowReport(true);
    setShowMenu(false);
  };

  const handleAddToCollection = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    // Prefer the clicked button position; fallback to the menu anchor.
    const buttonRect = e?.currentTarget
      ? (e.currentTarget as HTMLElement).getBoundingClientRect()
      : menuRef.current?.getBoundingClientRect() || null;
    if (buttonRect) {
      setCollectionAnchor(buttonRect);
    }
    // Public editorial collections: admin only (server-enforced). Others use private collections.
    setCollectionMode(isAdmin ? 'public' : 'private');
    setShowCollection(true);
  };

  const handleAuthorClick = (authorId: string) => {
    navigate(`/profile/${authorId}`);
  };

  const handleYouTubeTimestampClick = (videoId: string, timestamp: number, originalUrl: string) => {
    if (import.meta.env.DEV) {
      console.log('[handleYouTubeTimestampClick] Called:', { videoId, timestamp, originalUrl });
    }
    
    // Get the YouTube video URL from the article
    const youtubeUrl = primaryMedia?.url || article.media?.url || article.video;
    
    if (import.meta.env.DEV) {
      console.log('[handleYouTubeTimestampClick] Article YouTube URL:', {
        youtubeUrl,
        primaryMediaType: primaryMedia?.type,
        articleMediaType: article.media?.type,
        articleVideo: article.video,
      });
    }
    
    // If no YouTube URL found in article, can't expand inline
    if (!youtubeUrl) {
      if (import.meta.env.DEV) {
        console.log('[handleYouTubeTimestampClick] No YouTube URL found in article');
      }
      // If originalUrl is a valid YouTube URL, open it in new tab
      if (originalUrl && (originalUrl.includes('youtube.com') || originalUrl.includes('youtu.be'))) {
        window.open(originalUrl, '_blank', 'noopener,noreferrer');
      }
      return;
    }
    
    const articleVideoId = extractYouTubeVideoId(youtubeUrl);
    
    if (import.meta.env.DEV) {
      console.log('[handleYouTubeTimestampClick] Video ID comparison:', {
        clickedVideoId: videoId || '(empty - plain text timestamp)',
        articleVideoId,
        match: !videoId || articleVideoId === videoId,
      });
    }
    
    // If videoId is empty (plain text timestamp), or if it matches the article's video
    if (!videoId || articleVideoId === videoId) {
      if (import.meta.env.DEV) {
        console.log('[handleYouTubeTimestampClick] Opening mini player with timestamp:', timestamp);
      }
      const videoTitle = primaryMedia?.previewMetadata?.title || article.title || '';
      playVideo({
        videoUrl: youtubeUrl,
        videoTitle,
        startTime: timestamp,
        cardElementId: cardElementIdRef.current,
        articleId: article.id,
      });
      return;
    }
    
    // If video doesn't match, fallback to opening link in new tab
    if (import.meta.env.DEV) {
      console.log('[handleYouTubeTimestampClick] Video mismatch, opening in new tab');
    }
    if (originalUrl) {
      window.open(originalUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleToggleVisibility = async () => {
    if (isPreview) return;
    
    const newVisibility: 'public' | 'private' = article.visibility === 'private' ? 'public' : 'private';
    
    // Snapshot previous state for rollback
    const previousArticle = { ...article };
    
    // Optimistic update: update local article immediately
    const optimisticArticle = { ...article, visibility: newVisibility };
    
    patchArticleAcrossCaches(queryClient, article.id, () => optimisticArticle);
    
    try {
      const updatedArticle = await storageService.updateArticle(article.id, { visibility: newVisibility });
      
      if (!updatedArticle) {
        throw new Error('Failed to update visibility');
      }
      
      patchArticleAcrossCaches(queryClient, article.id, () => updatedArticle);
      queryClient.setQueryData(articleKeys.detail(article.id), updatedArticle);
      await invalidateArticleListCaches(queryClient);
      
      toast.success(`Nugget is now ${newVisibility}`);
      setShowMenu(false);
    } catch (error: any) {
      // Rollback on error
      patchArticleAcrossCaches(queryClient, article.id, () => previousArticle);
      
      const errorMessage = error?.response?.status === 403
        ? 'You can only edit your own nuggets'
        : error?.response?.status === 404
        ? 'Nugget not found'
        : 'Failed to update visibility';
      
      toast.error(errorMessage);
    }
  };

  const handleToggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  const handleToggleTagPopover = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowTagPopover(!showTagPopover);
  };

  const handleCloseTagPopover = useCallback(() => {
    setShowTagPopover(false);
  }, []);

  // When in preview mode, disable all mutation handlers to prevent API calls
  const handlers: NewsCardHandlers = isPreview
    ? {
        onShare: undefined,
        onClick: undefined,
        onMediaClick: (e: React.MouseEvent) => handleMediaClick(e), // Allow media click for preview (opens URL)
        onCategoryClick: handleCategoryClick, // Allow category click (no-op in preview)
        onTagClick: onTagClick ? handleTagClick : undefined,
        onDelete: undefined,
        onEdit: undefined,
        onDuplicate: undefined,
        onReport: undefined,
        onAddToCollection: undefined,
        onToggleVisibility: undefined,
        onAuthorClick: undefined,
        onToggleMenu: handleToggleMenu, // Allow menu toggle (UI only)
        onToggleTagPopover: handleToggleTagPopover, // Allow tag popover (UI only)
        onCloseTagPopover: handleCloseTagPopover,
        onReadMore: () => setShowFullModal(true), // Allow read more (modal only)
      }
    : {
        onShare: handleShare,
        onClick: handleClick,
        onMediaClick: handleMediaClick,
        onCategoryClick: handleCategoryClick,
        onTagClick: onTagClick ? handleTagClick : undefined,
        onDelete: (isOwner || isAdmin) ? handleDelete : undefined,
        onEdit: (isOwner || isAdmin) ? handleEdit : undefined,
        onDuplicate: (isOwner || isAdmin) ? handleDuplicate : undefined,
        onReport: withAuth(handleReport, 'guestReports'),
        onAddToCollection: isAdmin ? withAuth(handleAddToCollection) : undefined,
        onToggleVisibility: isOwner ? handleToggleVisibility : undefined,
        onAuthorClick: handleAuthorClick,
        onToggleMenu: handleToggleMenu,
        onToggleTagPopover: handleToggleTagPopover,
        onCloseTagPopover: handleCloseTagPopover,
        onReadMore: () => setShowFullModal(true),
      };

  const handlersWithDetails: NewsCardHandlers & { 
    onOpenDetails?: () => void;
    onYouTubeTimestampClick?: (videoId: string, timestamp: number, originalUrl: string) => void;
  } = {
    ...handlers,
    onOpenDetails: handleOpenDetails,
    onYouTubeTimestampClick: handleYouTubeTimestampClick,
  };

  return {
    logic: {
      data,
      flags,
      handlers: handlersWithDetails,
      cardElementId: cardElementIdRef.current,
    },
    // Modal state and refs (used by Controller for rendering modals)
    modals: {
      showCollection,
      showReport,
      showFullModal,
      showLightbox,
      lightboxInitialIndex,
      showMenu,
      showTagPopover,
      showEditModal,
      showDuplicateModal,
      showLinkPreview,
      linkPreviewUrl,
      setShowCollection,
      setShowReport,
      setShowFullModal,
      setShowLightbox,
      setLightboxInitialIndex,
      setShowEditModal,
      setShowDuplicateModal,
      setShowLinkPreview,
      setLinkPreviewUrl,
      collectionMode,
      setCollectionMode,
      collectionAnchor,
      setCollectionAnchor,
    },
    refs: {
      menuRef,
    },
    article, // Original article for modals
    isOwner,
    isAdmin,
  };
};

// Helper type for hook return (extends strict interface)
export type UseNewsCardReturn = ReturnType<typeof useNewsCard>;

