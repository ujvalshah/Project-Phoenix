/**
 * ============================================================================
 * ARTICLE DETAIL DRAWER: Analysis-First Media Rendering
 * ============================================================================
 * 
 * RENDERING ORDER (STRICT):
 * 1. Structured Markdown content (analysis text)
 * 2. Primary media embed (if exists)
 * 3. Supporting media section (images grid + videos/docs list)
 * 
 * PRINCIPLES:
 * - Analysis text ALWAYS precedes media
 * - Media never interrupts text flow
 * - Internal scroll only (no body scroll)
 * - No auto-play, no sticky media
 * 
 * MARKDOWN RENDERING PARITY FIX (Applied):
 * ============================================================================
 * This component now uses the EXACT same MarkdownRenderer as CardContent
 * (Nugget/News Card preview) to ensure rendering consistency.
 * 
 * What was fixed:
 * - Title: Previously rendered as plain text. Now uses MarkdownRenderer to
 *   support markdown links, inline formatting, and embedded markdown.
 * - Content: Previously had extensive className overrides that could interfere
 *   with MarkdownRenderer's component styles. Now uses the same configuration
 *   as CardContent (no prose prop, simplified className structure).
 * 
 * Renderer reused: MarkdownRenderer from @/components/MarkdownRenderer
 * - Uses react-markdown with remarkGfm for GitHub-flavored markdown
 * - Supports: links, tables, inline formatting (bold, italic, code), lists,
 *   blockquotes, headers, and all GFM features
 * 
 * Why ArticleDetail previously failed to render markdown:
 * 1. Title was plain text - no markdown parsing at all
 * 2. Content had className overrides that could conflict with MarkdownRenderer's
 *    internal component styles (e.g., [&_a]:text-primary-600 overriding link styles)
 * 3. Both title and content now use identical MarkdownRenderer configuration
 *    as CardContent, ensuring perfect parity
 * 
 * No global behavior or unrelated components were altered - only ArticleDetail
 * drawer was updated to reuse the existing MarkdownRenderer.
 * 
 * ============================================================================
 */

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Article } from '@/types';
import { Clock, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDate, formatReadTime } from '@/utils/formatters';
import { AddToCollectionModal } from './AddToCollectionModal';
import { DetailTopBar } from './shared/DetailTopBar';
import { MarkdownRenderer } from './MarkdownRenderer';
import { EmbeddedMedia } from './embeds/EmbeddedMedia';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useAuth } from '@/hooks/useAuth';
import { ReportModal } from './ReportModal';
import { classifyArticleMedia } from '@/utils/mediaClassifier';
import { extractYouTubeVideoId } from '@/utils/youtubeUtils';
import { useVideoPlayer } from '@/context/VideoPlayerContext';

interface ArticleDetailProps {
  article: Article;
  onClose?: () => void;
  isModal?: boolean;
  /** Controls whether the sticky top bar (author, actions, close) is shown.
   *  Defaults to the value of isModal for backward compatibility. */
  showHeader?: boolean;
  constrainWidth?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onToggleVisibility?: () => void;
  onYouTubeTimestampClick?: (videoId: string, timestamp: number, originalUrl: string) => void;
}

export const ArticleDetail: React.FC<ArticleDetailProps> = ({ 
  article, 
  onClose, 
  isModal = false,
  showHeader,
  constrainWidth = true,
  onEdit,
  onDelete,
  onToggleVisibility,
  onYouTubeTimestampClick,
}) => {
  // Early return if article is not available
  if (!article) {
    // eslint-disable-next-line no-console
    console.warn('[ArticleDetail] Article is not available');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 dark:text-slate-400 mb-4">Article not available</p>
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    );
  }

  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [drawerMediaIndex, setDrawerMediaIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [inlineVideoStartTime, setInlineVideoStartTime] = useState<number | null>(null);
  const mediaCarouselRef = useRef<HTMLDivElement>(null);
  
  const { withAuth } = useRequireAuth();
  const { currentUser, isAdmin } = useAuth();
  const { playVideo } = useVideoPlayer();
  
  const shouldShowHeader = showHeader ?? isModal;

  // Author resolution: check both transformed (author.name) and raw DB (authorName) shapes
  const rawAuthorName = article?.author?.name || (article as any)?.authorName;
  const authorName = article?.displayAuthor?.name
    || (rawAuthorName && rawAuthorName !== 'Unknown' ? rawAuthorName : '')
    || article?.media?.previewMetadata?.authorName
    || article?.media?.previewMetadata?.siteName
    || article?.primaryMedia?.previewMetadata?.authorName
    || article?.primaryMedia?.previewMetadata?.siteName
    || '';
  const authorId = article?.author?.id ?? "";
  const isOwner = currentUser?.id === authorId;
  
  // Resolve source URL for "View Original Source" button
  // Priority: externalLinks (primary) > previewMetadata.url > media.url (link-type)
  const sourceUrl = useMemo(() => {
    const primaryExternalLink = article?.externalLinks?.find(l => l.isPrimary);
    if (primaryExternalLink?.url) return primaryExternalLink.url;
    if (article?.primaryMedia?.previewMetadata?.url) return article.primaryMedia.previewMetadata.url;
    if (article?.media?.previewMetadata?.url) return article.media.previewMetadata.url;
    if (article?.media?.url && article.source_type === 'link') return article.media.url;
    return null;
  }, [article]);

  // Classify media into primary and supporting (safe with null checks)
  const { primaryMedia, supportingMedia } = classifyArticleMedia(article);
  const drawerMediaItems = useMemo(() => {
    const items: Array<{
      type: string;
      url: string;
      thumbnail: string | undefined;
      aspect_ratio: string | undefined;
      previewMetadata: any;
    }> = [];

    // images[] preserves user drag/drop order — use it as canonical source first
    if (article?.images && article.images.length > 0) {
      for (const url of article.images) {
        items.push({
          type: 'image' as const,
          url,
          thumbnail: url,
          aspect_ratio: undefined,
          previewMetadata: undefined,
        });
      }
    }

    // Add classified media (primaryMedia, supportingMedia) for non-image types
    // or images not already in images[]. Dedup below handles overlaps.
    if (primaryMedia) {
      items.push({
        type: primaryMedia.type,
        url: primaryMedia.url,
        thumbnail: primaryMedia.thumbnail,
        aspect_ratio: primaryMedia.aspect_ratio,
        previewMetadata: primaryMedia.previewMetadata,
      });
    }
    for (const item of supportingMedia || []) {
      items.push({
        type: item.type,
        url: item.url,
        thumbnail: item.thumbnail,
        aspect_ratio: undefined,
        previewMetadata: item.previewMetadata,
      });
    }

    const seen = new Set<string>();
    return items.filter((item) => {
      const key = `${item.type}:${item.url}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [primaryMedia, supportingMedia, article?.images]);
  const currentDrawerMedia = drawerMediaItems[drawerMediaIndex] || null;

  const handleAddToCollection = () => {
      setIsCollectionModalOpen(true);
  };

  const youtubeCarouselIndex = useMemo(() => {
    return drawerMediaItems.findIndex((item) => item.type === 'youtube');
  }, [drawerMediaItems]);

  const articleYouTubeUrl = useMemo(() => {
    const ytItem = drawerMediaItems.find((item) => item.type === 'youtube');
    return ytItem?.url || article?.media?.url || article?.video || null;
  }, [drawerMediaItems, article?.media?.url, article?.video]);

  const handleDrawerTimestampClick = useCallback(
    (videoId: string, timestamp: number, originalUrl: string) => {
      if (!isModal) {
        if (onYouTubeTimestampClick) {
          onYouTubeTimestampClick(videoId, timestamp, originalUrl);
        } else if (articleYouTubeUrl) {
          playVideo({
            videoUrl: articleYouTubeUrl,
            videoTitle: article?.title || '',
            startTime: timestamp,
            cardElementId: `drawer-video-${article?.id ?? ''}`,
            articleId: article?.id ?? '',
          });
        }
        return;
      }

      if (youtubeCarouselIndex >= 0) {
        setDrawerMediaIndex(youtubeCarouselIndex);
        setInlineVideoStartTime(timestamp);
        mediaCarouselRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else if (articleYouTubeUrl) {
        playVideo({
          videoUrl: articleYouTubeUrl,
          videoTitle: article?.title || '',
          startTime: timestamp,
          cardElementId: `drawer-video-${article?.id ?? ''}`,
          articleId: article?.id ?? '',
        });
      } else if (originalUrl) {
        window.open(originalUrl, '_blank', 'noopener,noreferrer');
      }
    },
    [isModal, onYouTubeTimestampClick, youtubeCarouselIndex, articleYouTubeUrl, playVideo, article?.id, article?.title]
  );

  useEffect(() => {
    setDrawerMediaIndex(0);
    setInlineVideoStartTime(null);
  }, [article?.id, drawerMediaItems.length]);

  const goToPreviousMedia = () => {
    if (drawerMediaItems.length <= 1) return;
    setDrawerMediaIndex((prev) => (prev === 0 ? drawerMediaItems.length - 1 : prev - 1));
    setInlineVideoStartTime(null);
  };

  const goToNextMedia = () => {
    if (drawerMediaItems.length <= 1) return;
    setDrawerMediaIndex((prev) => (prev === drawerMediaItems.length - 1 ? 0 : prev + 1));
    setInlineVideoStartTime(null);
  };

  const isCurrentItemYouTube = currentDrawerMedia?.type === 'youtube';
  const shouldShowInlineVideo = isModal && isCurrentItemYouTube && inlineVideoStartTime !== null;

  const inlineEmbedUrl = useMemo(() => {
    if (!shouldShowInlineVideo || !currentDrawerMedia) return null;
    const vId = extractYouTubeVideoId(currentDrawerMedia.url);
    if (!vId) return null;
    const params = new URLSearchParams({
      rel: '0',
      modestbranding: '1',
      playsinline: '1',
      autoplay: '1',
      iv_load_policy: '3',
      playlist: vId,
      loop: '0',
    });
    if (inlineVideoStartTime && inlineVideoStartTime > 0) {
      params.set('start', String(Math.floor(inlineVideoStartTime)));
    }
    return `https://www.youtube-nocookie.com/embed/${vId}?${params.toString()}`;
  }, [shouldShowInlineVideo, currentDrawerMedia, inlineVideoStartTime]);

  // Root container: Apply width constraints when not in modal mode
  // When constrainWidth = true (desktop right-pane), enforce max-width and center alignment
  // When constrainWidth = false (mobile bottom sheet), do not cap width
  const rootContainerClasses = isModal 
    ? 'bg-white dark:bg-slate-950 min-h-full flex flex-col'
    : constrainWidth
      ? 'bg-white dark:bg-slate-950 min-h-full flex flex-col w-full max-w-[720px] mx-auto px-4 py-6 xl:px-6'
      : 'bg-white dark:bg-slate-950 min-h-full flex flex-col w-full px-4 py-6 xl:px-6';

  return (
    <div className={rootContainerClasses}>
       {shouldShowHeader && (
           <DetailTopBar
               authorName={authorName}
               article={article}
               onClose={onClose}
               onEdit={onEdit}
               onDelete={onDelete}
               onToggleVisibility={onToggleVisibility}
               onAddToCollection={withAuth(handleAddToCollection)}
               onReport={() => setShowReportModal(true)}
               isOwner={isOwner}
               isAdmin={isAdmin}
           />
       )}

       {/* Content Container
           Scroll behavior: In modal mode, ArticleModal handles scrolling.
           In standalone mode, this container provides scrolling. */}
       <div className={isModal ? "flex-1" : "flex-1 overflow-y-auto custom-scrollbar"}>
           <div className={`${isModal ? "max-w-none px-5 py-6" : "w-full px-0"} space-y-6`}>
               {/* Title & Meta */}
               <div>
                   {/* CATEGORY PHASE-OUT: Tags - Matches card styling */}
                   {article?.tags && article.tags.length > 0 && (
                       <div className="flex flex-wrap gap-1 mb-3">
                           {article.tags.map(tag => (
                               <span key={tag} className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-slate-50 border border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400">
                                   {tag}
                               </span>
                           ))}
                       </div>
                   )}
                   
                   {/* Title - RENDERING PARITY FIX: Uses MarkdownRenderer to match CardContent behavior.
                       This ensures markdown links, inline formatting, and embedded markdown render
                       correctly in both preview and full view. Uses div with heading role for
                       accessibility while allowing MarkdownRenderer to handle all markdown parsing. */}
                   {article?.title && (
                       <div 
                           role="heading" 
                           aria-level={1}
                           className="text-sm font-semibold text-slate-900 dark:text-white leading-snug mb-3"
                       >
                           <MarkdownRenderer content={article.title} />
                       </div>
                   )}
                   
                   {/* Meta Information */}
                   <div className="flex items-center gap-4 text-xs font-medium text-slate-500 dark:text-slate-400">
                       <div className="flex items-center gap-1.5">
                           <Clock size={14} />
                           <span>{formatReadTime(article?.readTime ?? 1)}</span>
                       </div>
                       {article?.publishedAt && (
                           <div>{formatDate(article.publishedAt)}</div>
                       )}
                   </div>
               </div>

              {/* Source Attribution Button */}
              {sourceUrl && (
                  <a
                      href={sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-200 transition-colors w-fit"
                  >
                      <ExternalLink size={12} className="flex-shrink-0" />
                      <span className="text-[11px] font-semibold">Source</span>
                  </a>
              )}

              {/* Unified drawer media carousel (primary + supporting, no duplicates).
                  YouTube items swap from thumbnail → live iframe when a timestamp is clicked. */}
              {isModal && currentDrawerMedia && (
                  <div className="pt-2" ref={mediaCarouselRef}>
                      <div
                          className="relative"
                          onTouchStart={(e) => {
                              if (shouldShowInlineVideo) return;
                              setTouchStartX(e.touches[0].clientX);
                          }}
                          onTouchEnd={(e) => {
                              if (shouldShowInlineVideo) return;
                              if (touchStartX === null) return;
                              const deltaX = e.changedTouches[0].clientX - touchStartX;
                              setTouchStartX(null);
                              if (Math.abs(deltaX) < 40) return;
                              if (deltaX > 0) {
                                  goToPreviousMedia();
                              } else {
                                  goToNextMedia();
                              }
                          }}
                      >
                          <div
                              className="w-full bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
                              style={{
                                  aspectRatio: currentDrawerMedia.type === 'youtube'
                                      ? '16/9'
                                      : currentDrawerMedia.type === 'image'
                                      ? (currentDrawerMedia.aspect_ratio || '4/3')
                                      : undefined,
                              }}
                          >
                              {shouldShowInlineVideo && inlineEmbedUrl ? (
                                  <iframe
                                      key={inlineEmbedUrl}
                                      src={inlineEmbedUrl}
                                      className="w-full h-full"
                                      title={currentDrawerMedia.previewMetadata?.title || 'YouTube video'}
                                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                      allowFullScreen
                                      loading="lazy"
                                  />
                              ) : (
                                  <div
                                      className="w-full h-full cursor-pointer"
                                      onClick={(e) => {
                                          e.stopPropagation();
                                          if (isCurrentItemYouTube) {
                                              setInlineVideoStartTime(0);
                                          } else {
                                              const linkUrl = currentDrawerMedia.previewMetadata?.url || currentDrawerMedia.url;
                                              if (linkUrl) {
                                                  window.open(linkUrl, '_blank', 'noopener,noreferrer');
                                              }
                                          }
                                      }}
                                  >
                                      <EmbeddedMedia
                                          media={{
                                              type: currentDrawerMedia.type,
                                              url: currentDrawerMedia.url,
                                              thumbnail_url: currentDrawerMedia.thumbnail,
                                              aspect_ratio: currentDrawerMedia.aspect_ratio,
                                              previewMetadata: currentDrawerMedia.previewMetadata,
                                          }}
                                      />
                                  </div>
                              )}
                          </div>

                          {drawerMediaItems.length > 1 && (
                              <>
                                  <button
                                      onClick={(e) => {
                                          e.stopPropagation();
                                          goToPreviousMedia();
                                      }}
                                      className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 hover:bg-black/75 text-white transition-colors z-10"
                                      aria-label="Previous media"
                                  >
                                      <ChevronLeft size={16} />
                                  </button>
                                  <button
                                      onClick={(e) => {
                                          e.stopPropagation();
                                          goToNextMedia();
                                      }}
                                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 hover:bg-black/75 text-white transition-colors z-10"
                                      aria-label="Next media"
                                  >
                                      <ChevronRight size={16} />
                                  </button>
                                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 text-white text-[10px] px-2 py-1 z-10">
                                      {drawerMediaIndex + 1} / {drawerMediaItems.length}
                                  </div>
                              </>
                          )}
                      </div>
                  </div>
              )}

              {/* Content - RENDERING PARITY FIX: Uses exact same MarkdownRenderer configuration
                  as CardContent (no prose prop, same className structure). Removed extensive
                  className overrides that could interfere with MarkdownRenderer's component styles.
                  This ensures GitHub-style markdown (links, tables, inline formatting) renders
                  identically to the card preview. */}
              <div className="nugget-content text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  <MarkdownRenderer 
                    content={article?.content ?? article?.excerpt ?? ''} 
                    onYouTubeTimestampClick={handleDrawerTimestampClick}
                  />
              </div>

               {/* Primary Media Embed */}
               {!isModal && primaryMedia && (
                   <div className="pt-5 border-t border-slate-100 dark:border-slate-800">
                       <div 
                           className="w-full bg-slate-100 dark:bg-slate-900 cursor-pointer rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
                           style={{
                               aspectRatio: primaryMedia.type === 'youtube' ? '16/9' : 
                                           primaryMedia.type === 'image' ? (primaryMedia.aspect_ratio || '4/3') :
                                           undefined
                           }}
                           onClick={(e) => {
                               e.stopPropagation();
                               const linkUrl = primaryMedia.previewMetadata?.url || primaryMedia.url;
                               if (linkUrl) {
                                   window.open(linkUrl, '_blank', 'noopener,noreferrer');
                               }
                           }}
                       >
                           <EmbeddedMedia 
                               media={{
                                   type: primaryMedia.type,
                                   url: primaryMedia.url,
                                   thumbnail_url: primaryMedia.thumbnail,
                                   aspect_ratio: primaryMedia.aspect_ratio,
                                   previewMetadata: primaryMedia.previewMetadata,
                               }} 
                           />
                       </div>
                   </div>
               )}

               {/* Supporting Media */}
           </div>
       </div>

      <AddToCollectionModal
          isOpen={isCollectionModalOpen}
          onClose={() => setIsCollectionModalOpen(false)}
          articleIds={[article?.id ?? '']}
      />

      <ReportModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          targetId={article?.id ?? ''}
          targetType="nugget"
      />
    </div>
  );
};


