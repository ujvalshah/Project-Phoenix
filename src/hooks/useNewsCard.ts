import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Article } from '@/types';
import { useToast } from './useToast';
import { useAuth } from './useAuth';
import { useRequireAuth } from './useRequireAuth';
import { storageService } from '@/services/storageService';
import { queryClient } from '@/queryClient';
import { sanitizeArticle, hasValidAuthor, logError } from '@/utils/errorHandler';
import { getAllImageUrls, classifyArticleMedia } from '@/utils/mediaClassifier';
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
  categories: string[];
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
}

export interface NewsCardFlags {
  isLiked: boolean;
  isRead: boolean;
}

export interface NewsCardHandlers {
  onLike: (() => void) | undefined;
  onShare: (() => void) | undefined;
  onClick: (() => void) | undefined;
  onMediaClick: (e: React.MouseEvent, imageIndex?: number) => void;
  onCategoryClick: (category: string) => void;
  onTagClick?: (tag: string) => void;
  onDelete?: () => void;
  onEdit?: () => void;
  onReport?: () => void;
  onAddToCollection?: (e: React.MouseEvent) => void;
  onToggleVisibility?: () => void;
  onAuthorClick: ((authorId: string) => void) | undefined;
  onToggleMenu: (e: React.MouseEvent) => void;
  onToggleTagPopover: (e: React.MouseEvent) => void;
  onReadMore: () => void;
}

export interface NewsCardLogic {
  data: NewsCardData;
  flags: NewsCardFlags;
  handlers: NewsCardHandlers;
}

interface UseNewsCardProps {
  article: Article;
  currentUserId?: string;
  onCategoryClick?: (category: string) => void;
  onTagClick?: (tag: string) => void;
  onClick?: (article: Article) => void;
  isPreview?: boolean;
}

export const useNewsCard = ({
  article,
  currentUserId,
  onCategoryClick,
  onTagClick,
  onClick,
  isPreview = false,
}: UseNewsCardProps) => {
  const navigate = useNavigate();
  const toast = useToast();
  const { isAdmin = false } = useAuth(); // Phase 3: Default to false to ensure boolean type
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
  const [collectionAnchor, setCollectionAnchor] = useState<DOMRect | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);
  const tagPopoverRef = useRef<HTMLDivElement>(null);

  // ────────────────────────────────────────
  // CLICK OUTSIDE HANDLER
  // ────────────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
      if (tagPopoverRef.current && !tagPopoverRef.current.contains(event.target as Node)) {
        setShowTagPopover(false);
      }
    };
    if (showMenu || showTagPopover) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu, showTagPopover]);

  // ────────────────────────────────────────
  // COMPUTED VALUES / DERIVED DATA
  // ────────────────────────────────────────
  // Sanitize article data to ensure all required fields exist
  const sanitizedArticle = sanitizeArticle(article);
  if (!sanitizedArticle) {
    logError('useNewsCard', new Error('Invalid article data'), { article });
    throw new Error('Invalid article: article is null or undefined');
  }
  
  // Ensure author exists
  if (!hasValidAuthor(sanitizedArticle)) {
    logError('useNewsCard', new Error('Article missing author data'), { article: sanitizedArticle });
    // Create fallback author
    sanitizedArticle.author = {
      id: sanitizedArticle.author?.id || '',
      name: sanitizedArticle.author?.name || 'Unknown',
      avatar_url: sanitizedArticle.author?.avatar_url,
    };
  }
  
  // Use sanitized article for all operations
  article = sanitizedArticle;

  const isOwner = currentUserId === article.author.id;
  
  // ═══════════════════════════════════════════════════════════════════════
  // MEDIA DETECTION: Comprehensive check for all media types
  // ═══════════════════════════════════════════════════════════════════════
  // Check for media in all possible locations:
  // 1. Primary/supporting media (new format)
  // 2. Legacy media field (includes Twitter/LinkedIn links)
  // 3. Legacy images array
  // 4. Legacy video field
  // CRITICAL: Twitter/LinkedIn embeds are in article.media with type='twitter'/'linkedin'
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
  const actualLineCount = countTextLines(contentText);
  // Rough estimate: 2-3 lines ≈ 150-200 characters (conservative: use 200 as threshold)
  const CAPTION_THRESHOLD = 200; // Characters that fit in 2-3 lines
  const MAX_PREVIEW_LINES = 3; // Maximum lines for media-only caption
  
  // Check for multi-image media
  const allImageUrls = getAllImageUrls(article);
  const hasMultipleImages = allImageUrls.length > 1;
  
  // Get trimmed body text for classification
  const trimmedBody = contentText.trim();
  const trimmedBodyLineCount = countTextLines(trimmedBody);
  
  // DIAGNOSTIC: Log image detection BEFORE classification
  if (hasMedia) {
    console.log(`[CARD-AUDIT] Image Detection for ${article.id.substring(0, 8)}:`, {
      allImageUrls: allImageUrls,
      imageCount: allImageUrls.length,
      hasMultipleImages: hasMultipleImages,
      hasLegacyImages: !!(article.images && article.images.length > 0),
      hasPrimaryMedia: !!article.primaryMedia,
      hasSupportingMedia: !!(article.supportingMedia && article.supportingMedia.length > 0),
      primaryMediaType: article.primaryMedia?.type,
      mediaType: article.media?.type,
    });
  }
  
  // Determine card type with promotion rule
  let cardType: 'hybrid' | 'media-only';
  let classificationReason = '';
  
  // ═══════════════════════════════════════════════════════════════════════
  // ENFORCEMENT RULE: Long Text → MUST be Hybrid (regardless of media)
  // ═══════════════════════════════════════════════════════════════════════
  // If a card contains non-empty body text beyond the allowed preview line limit,
  // it MUST be treated as a HYBRID card, and truncation + fade MUST apply.
  // This applies to: single images, multiple images, any media type
  // Do NOT treat cards with long text as media-only, even if they have media.
  const hasLongText = Boolean(trimmedBody) && trimmedBodyLineCount > MAX_PREVIEW_LINES;
  const isMultiImageWithLongText = hasMultipleImages && hasLongText;
  
  if (!hasMedia) {
    // No media = always Hybrid (text-only is a subset of Hybrid without media)
    cardType = 'hybrid';
    classificationReason = 'no-media';
  } else if (hasLongText) {
    // ENFORCEMENT: Any media + long text → MUST be Hybrid
    // This ensures truncation + fade apply for all cards with long text
    // Special case: Multi-image gets specific reason for debugging
    if (isMultiImageWithLongText) {
      cardType = 'hybrid';
      classificationReason = `multi-image-long-text (${allImageUrls.length} images, ${trimmedBodyLineCount} lines > ${MAX_PREVIEW_LINES})`;
    } else {
      cardType = 'hybrid';
      classificationReason = `long-text (${trimmedBodyLineCount} lines > ${MAX_PREVIEW_LINES})`;
    }
  } else {
    // Has media - check if qualifies for Media-Only
    // CRITICAL: Use trimmedBodyLineCount consistently (same as enforcement rule)
    const hasMinimalText = estimatedLength <= CAPTION_THRESHOLD && !contentText.trim().includes('\n\n');
    const hasMinimalLines = trimmedBodyLineCount <= MAX_PREVIEW_LINES;
    
    // Media-Only ONLY if: minimal text AND no user-provided title (metadata titles don't count)
    // Promotion rule: if text exceeds threshold or has user-provided title → Hybrid
    // NOTE: Metadata titles are allowed for media-only cards (displayed in overlay, don't force hybrid)
    // CRITICAL: hasUserProvidedTitle checks ONLY article.title (user-entered), NOT metadata titles
    if (hasMinimalText && hasMinimalLines && !hasUserProvidedTitle) {
      cardType = 'media-only';
      classificationReason = 'minimal-text-no-user-title';
    } else {
      // Promotion to Hybrid: text exceeds caption length, has user-provided title, or has structured content
      cardType = 'hybrid';
      if (!hasMinimalText) {
        classificationReason = `text-exceeds-threshold (${estimatedLength} > ${CAPTION_THRESHOLD})`;
      } else if (!hasMinimalLines) {
        classificationReason = `lines-exceed-preview (${trimmedBodyLineCount} > ${MAX_PREVIEW_LINES})`;
      } else if (hasUserProvidedTitle) {
        classificationReason = 'has-user-provided-title';
      } else {
        classificationReason = 'other';
      }
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // COMPREHENSIVE DIAGNOSTICS: Log all card properties for debugging
  // ═══════════════════════════════════════════════════════════════════════
  
  // Detect media variant (single image, gallery, embed, video, screenshot, etc.)
  const { primaryMedia } = classifyArticleMedia(article);
  let mediaVariant = 'none';
  if (hasMedia) {
    if (hasMultipleImages && allImageUrls.length >= 2) {
      mediaVariant = `gallery (${allImageUrls.length} images)`;
    } else if (primaryMedia) {
      if (primaryMedia.type === 'youtube') {
        mediaVariant = 'video-youtube';
      } else if (primaryMedia.type === 'image') {
        mediaVariant = 'single-image';
      } else if (primaryMedia.type === 'twitter' || article.media?.type === 'twitter') {
        mediaVariant = 'embed-twitter';
      } else if (primaryMedia.type === 'linkedin' || article.media?.type === 'linkedin') {
        mediaVariant = 'embed-linkedin';
      } else if (primaryMedia.type === 'document' || primaryMedia.type === 'pdf') {
        mediaVariant = 'document';
      } else if (article.media?.type) {
        mediaVariant = `embed-${article.media.type}`;
      } else {
        mediaVariant = `other-${primaryMedia.type || 'unknown'}`;
      }
    } else if (article.media) {
      if (article.media.type === 'twitter') {
        mediaVariant = 'embed-twitter';
      } else if (article.media.type === 'linkedin') {
        mediaVariant = 'embed-linkedin';
      } else {
        mediaVariant = `embed-${article.media.type}`;
      }
    } else if (hasLegacyImages) {
      mediaVariant = hasMultipleImages ? `gallery (${allImageUrls.length} images)` : 'single-image';
    } else if (hasLegacyVideo) {
      mediaVariant = 'video';
    }
  }
  
  // Determine if card has body text (content or excerpt)
  const hasBodyText = Boolean(trimmedBody && trimmedBody.length > 0);
  
  // For Media-Only cards, overlay text is rendered inside media container
  // For Hybrid cards, body text is rendered in the content area
  const hasOverlayText = cardType === 'media-only' && hasBodyText;
  
  // 🔍 AUDIT LOGGING - Card Classification (Enhanced with all diagnostics)
  const auditData = {
    id: article.id.substring(0, 8) + '...', // Shortened for readability
    detectedCardType: cardType,
    hasMedia,
    mediaVariant,
    hasPrimaryMedia,
    hasSupportingMedia,
    hasLegacyMedia,
    hasLegacyImages,
    hasLegacyVideo,
    primaryMediaType: primaryMedia?.type || article.media?.type || 'none',
    mediaCount: allImageUrls.length,
    hasMultipleImages,
    hasBodyText,
    hasOverlayText,
    contentLength: contentText.length,
    estimatedLength,
    actualLineCount,
    trimmedBodyLineCount,
    hasLongText,
    isMultiImageWithLongText,
    hasUserProvidedTitle,
    hasMetadataTitle: !!article.media?.previewMetadata?.title?.trim(),
    shouldShowTitle, // For display purposes (includes metadata titles)
    classificationReason,
    maxPreviewLines: MAX_PREVIEW_LINES,
    contentPreview: contentText.substring(0, 80) + (contentText.length > 80 ? '...' : ''),
  };
  
  // Log as table for better readability - use JSON.stringify to force visibility
  console.log('[CARD-AUDIT] Classification:', JSON.stringify(auditData, null, 2));
  console.log('[CARD-AUDIT] Classification (expanded):', auditData);
  
  // Also log the enforcement rule check separately for multi-image cards
  if (hasMultipleImages) {
    const multiImageCheck = {
      id: article.id.substring(0, 8) + '...',
      imageCount: allImageUrls.length,
      hasText: Boolean(trimmedBody),
      lineCount: trimmedBodyLineCount,
      exceedsPreview: trimmedBodyLineCount > MAX_PREVIEW_LINES,
      shouldBeHybrid: isMultiImageWithLongText,
      finalCardType: cardType,
    };
    console.log(`[CARD-AUDIT] Multi-Image Card Check:`, JSON.stringify(multiImageCheck, null, 2));
    console.log(`[CARD-AUDIT] Multi-Image Card Check (expanded):`, multiImageCheck);
  }
  
  // CRITICAL: Log if long text should force hybrid
  if (hasLongText) {
    console.log(`[CARD-AUDIT] ⚠️ LONG TEXT DETECTED - Should be Hybrid:`, {
      id: article.id.substring(0, 8) + '...',
      lineCount: trimmedBodyLineCount,
      maxPreview: MAX_PREVIEW_LINES,
      cardType: cardType,
      isHybrid: cardType === 'hybrid',
    });
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
    categories: article.categories || [],
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
  };

  // ────────────────────────────────────────
  // FLAGS
  // ────────────────────────────────────────
  const flags: NewsCardFlags = {
    // Deferred feature — backend support pending
    isLiked: false, // TODO: Implement like functionality if needed
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
    
    // Media acts as source citation - always try to open source URL if available
    const linkUrl = article.media?.previewMetadata?.url || article.media?.url;
    if (linkUrl) {
      // Open source URL in new tab
      window.open(linkUrl, '_blank', 'noopener,noreferrer');
    } else {
      // Fallback: Open images in lightbox if no URL available
      if (article.media?.type === 'image' || (article.images && article.images.length > 0)) {
        // Store image index for initial display if provided
        if (imageIndex !== undefined) {
          setLightboxInitialIndex(imageIndex);
        }
        setShowLightbox(true);
      } else {
        // For other media types without URL, open full modal
        setShowFullModal(true);
      }
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
      await queryClient.invalidateQueries({ queryKey: ['articles'] });
      toast.success('Nugget deleted');
    }
  };

  const [showEditModal, setShowEditModal] = useState(false);

  const handleEdit = () => {
    setShowEditModal(true);
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

  const handleAddToCollection = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Get the button's bounding rect for popover positioning
    const buttonRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setCollectionAnchor(buttonRect);
    setCollectionMode('public');
    setShowCollection(true);
  };

  const handleAuthorClick = (authorId: string) => {
    navigate(`/profile/${authorId}`);
  };

  const handleToggleVisibility = async () => {
    if (isPreview) return;
    
    const newVisibility: 'public' | 'private' = article.visibility === 'private' ? 'public' : 'private';
    
    // Snapshot previous state for rollback
    const previousArticle = { ...article };
    
    // Optimistic update: update local article immediately
    const optimisticArticle = { ...article, visibility: newVisibility };
    
    // Update query cache optimistically
    queryClient.setQueryData(['articles'], (oldData: any) => {
      if (!oldData) return oldData;
      
      // Handle paginated response
      if (oldData.data && Array.isArray(oldData.data)) {
        return {
          ...oldData,
          data: oldData.data.map((a: Article) => 
            a.id === article.id ? optimisticArticle : a
          )
        };
      }
      
      // Handle array response
      if (Array.isArray(oldData)) {
        return oldData.map((a: Article) => 
          a.id === article.id ? optimisticArticle : a
        );
      }
      
      return oldData;
    });
    
    try {
      const updatedArticle = await storageService.updateArticle(article.id, { visibility: newVisibility });
      
      if (!updatedArticle) {
        throw new Error('Failed to update visibility');
      }
      
      // Update cache with server response
      queryClient.setQueryData(['articles'], (oldData: any) => {
        if (!oldData) return oldData;
        
        if (oldData.data && Array.isArray(oldData.data)) {
          return {
            ...oldData,
            data: oldData.data.map((a: Article) => 
              a.id === article.id ? updatedArticle : a
            )
          };
        }
        
        if (Array.isArray(oldData)) {
          return oldData.map((a: Article) => 
            a.id === article.id ? updatedArticle : a
          );
        }
        
        return oldData;
      });
      
      // Invalidate to ensure consistency across all queries
      await queryClient.invalidateQueries({ queryKey: ['articles'] });
      
      toast.success(`Nugget is now ${newVisibility}`);
      setShowMenu(false);
    } catch (error: any) {
      // Rollback on error
      queryClient.setQueryData(['articles'], (oldData: any) => {
        if (!oldData) return oldData;
        
        if (oldData.data && Array.isArray(oldData.data)) {
          return {
            ...oldData,
            data: oldData.data.map((a: Article) => 
              a.id === article.id ? previousArticle : a
            )
          };
        }
        
        if (Array.isArray(oldData)) {
          return oldData.map((a: Article) => 
            a.id === article.id ? previousArticle : a
          );
        }
        
        return oldData;
      });
      
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

  // When in preview mode, disable all mutation handlers to prevent API calls
  const handlers: NewsCardHandlers = isPreview
    ? {
        onLike: undefined,
        onShare: undefined,
        onClick: undefined,
        onMediaClick: (e: React.MouseEvent) => handleMediaClick(e), // Allow media click for preview (opens URL)
        onCategoryClick: handleCategoryClick, // Allow category click (no-op in preview)
        onTagClick: onTagClick ? handleTagClick : undefined,
        onDelete: undefined,
        onEdit: undefined,
        onReport: undefined,
        onAddToCollection: undefined,
        onToggleVisibility: undefined,
        onAuthorClick: undefined,
        onToggleMenu: handleToggleMenu, // Allow menu toggle (UI only)
        onToggleTagPopover: handleToggleTagPopover, // Allow tag popover (UI only)
        onReadMore: () => setShowFullModal(true), // Allow read more (modal only)
      }
    : {
        // Deferred feature — backend support pending
        onLike: () => {
          // TODO: Implement like functionality
        },
        onShare: handleShare,
        onClick: handleClick,
        onMediaClick: handleMediaClick,
        onCategoryClick: handleCategoryClick,
        onTagClick: onTagClick ? handleTagClick : undefined,
        onDelete: (isOwner || isAdmin) ? handleDelete : undefined,
        onEdit: (isOwner || isAdmin) ? handleEdit : undefined,
        onReport: withAuth(handleReport, 'guestReports'),
        onAddToCollection: withAuth(handleAddToCollection),
        onToggleVisibility: isOwner ? handleToggleVisibility : undefined,
        onAuthorClick: handleAuthorClick,
        onToggleMenu: handleToggleMenu,
        onToggleTagPopover: handleToggleTagPopover,
        onReadMore: () => setShowFullModal(true),
      };

  // Add onOpenDetails to handlers
  const handlersWithDetails: NewsCardHandlers & { onOpenDetails?: () => void } = {
    ...handlers,
    onOpenDetails: handleOpenDetails,
  };

  return {
    logic: {
      data,
      flags,
      handlers: handlersWithDetails,
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
      setShowCollection,
      setShowReport,
      setShowFullModal,
      setShowLightbox,
      setLightboxInitialIndex,
      setShowEditModal,
      collectionMode,
      setCollectionMode,
      collectionAnchor,
      setCollectionAnchor,
    },
    refs: {
      menuRef,
      tagPopoverRef,
    },
    article, // Original article for modals
    isOwner,
    isAdmin,
  };
};

// Helper type for hook return (extends strict interface)
export type UseNewsCardReturn = ReturnType<typeof useNewsCard>;

