import React, { useMemo } from 'react';
import { Check, ExternalLink } from 'lucide-react';
import { NewsCardLogic } from '@/hooks/useNewsCard';
import { CardMedia } from '../atoms/CardMedia';
import { CardTitle } from '../atoms/CardTitle';
import { CardMeta } from '../atoms/CardMeta';
import { CardTags } from '../atoms/CardTags';
import { CardActions } from '../atoms/CardActions';
import { CardContent } from '../atoms/CardContent';
import { CardContributor } from '../atoms/CardContributor';
import { CardBadge } from '../atoms/CardBadge';
import { CardGradientFallback } from '../atoms/CardGradientFallback';

interface GridVariantProps {
  logic: NewsCardLogic;
  showTagPopover: boolean;
  showMenu: boolean;
  menuRef: React.RefObject<HTMLDivElement | null>;
  tagPopoverRef: React.RefObject<HTMLDivElement | null>;
  isOwner: boolean;
  isAdmin: boolean;
  isPreview?: boolean;
  selectionMode?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
}

export const GridVariant: React.FC<GridVariantProps> = ({
  logic,
  showTagPopover,
  showMenu,
  menuRef,
  tagPopoverRef,
  isOwner,
  isAdmin,
  isPreview = false,
  selectionMode = false,
  isSelected = false,
  onSelect,
}) => {
  const { data, handlers } = logic;
  
  // Calculate link button props (for rendering link button independently of media)
  // Priority: externalLinks > previewMetadata.url (original source) > media.url (for link-type only)
  const linkButtonProps = useMemo(() => {
    // 1. New system: explicit externalLinks
    const primaryExternalLink = data.externalLinks?.find(link => link.isPrimary);
    if (primaryExternalLink?.url) {
      return { url: primaryExternalLink.url, shouldShow: true };
    }

    // 2. Original source URL from unfurl metadata
    if (data.media?.previewMetadata?.url) {
      const isYouTube = data.media?.type === 'youtube';
      return { url: data.media.previewMetadata.url, shouldShow: !isYouTube };
    }

    // 3. media.url ONLY for link-type media (the URL IS the source, not Cloudinary)
    if (data.media?.type === 'link' && data.media?.url) {
      return { url: data.media.url, shouldShow: true };
    }

    // No valid source URL found (don't use Cloudinary URLs from images[])
    return { url: null, shouldShow: false };
  }, [data.externalLinks, data.media]);
  
  // Warn if cardType is media-only but will render as hybrid or has long text
  React.useEffect(() => {
    const hasText = Boolean((data.content || data.excerpt || '').trim());
    const textLength = (data.content || data.excerpt || '').length;
    const renderedCardType = data.cardType === 'media-only' ? 'media-only' : 'hybrid';
    
    if (data.cardType === 'media-only' && renderedCardType !== 'media-only') {
      console.error('[CARD-AUDIT] ❌ CRITICAL: Media-only card being rendered as hybrid!', {
        id: data.id.substring(0, 8) + '...',
        detectedCardType: data.cardType,
        renderedCardType,
      });
    }
    
    if (data.cardType === 'media-only' && textLength > 200) {
      console.warn('[CARD-AUDIT] ⚠️ MEDIA-ONLY CARD WITH LONG TEXT!', {
        id: data.id.substring(0, 8) + '...',
        cardType: data.cardType,
        contentLength: textLength,
      });
    }
  }, [data.id, data.cardType, data.content, data.excerpt]);

  const handleCardClick = (e: React.MouseEvent) => {
    if (selectionMode && onSelect) {
      e.stopPropagation();
      onSelect();
    } else if (handlers.onClick) {
      handlers.onClick();
    }
  };

  // Keyboard navigation handler
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Allow keyboard navigation within card (buttons, links)
    const target = e.target as HTMLElement;
    if (target.tagName === 'BUTTON' || target.tagName === 'A') {
      return; // Let buttons and links handle their own keyboard events
    }

    // Handle Enter or Space to open card
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (selectionMode && onSelect) {
        onSelect();
      } else if (handlers.onClick) {
        handlers.onClick();
      }
    }
  };

  // Generate descriptive aria-label for the card
  const ariaLabelParts: string[] = [];
  if (data.title) {
    ariaLabelParts.push(data.title);
  }
  if (data.tags && data.tags.length > 0) {
    ariaLabelParts.push(`Tagged with ${data.tags.slice(0, 3).join(', ')}`);
  }
  if (data.authorName) {
    ariaLabelParts.push(`by ${data.authorName}`);
  }
  if (data.excerpt || data.content) {
    const excerptPreview = (data.excerpt || data.content).substring(0, 100);
    ariaLabelParts.push(excerptPreview);
  }
  const ariaLabel = ariaLabelParts.length > 0
    ? ariaLabelParts.join('. ') + '. Click to view full article.'
    : 'Article card. Click to view details.';

  return (
    <article
      data-article-id={data.id}
      role="article"
      aria-label={selectionMode ? `${ariaLabel} ${isSelected ? 'Selected' : 'Not selected'}` : ariaLabel}
      tabIndex={selectionMode ? -1 : 0}
      onKeyDown={handleKeyDown}
      className={`
        group relative flex flex-col h-full overflow-hidden
        bg-white dark:bg-slate-900
        border rounded-xl
        shadow-sm hover:shadow-md
        transition-shadow duration-200
        focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
        focus:ring-offset-white dark:focus:ring-offset-slate-900
        ${selectionMode
          ? isSelected
            ? 'border-primary-500 ring-1 ring-primary-500'
            : 'border-slate-200 dark:border-slate-700'
          : 'border-slate-200 dark:border-slate-700'
        }
      `}
    >
      {/* Selection Checkbox Overlay */}
      {selectionMode && (
        <div
          className="absolute top-3 right-3 z-20"
          onClick={(e) => e.stopPropagation()}
        >
          <label className="cursor-pointer">
            <input
              type="checkbox"
              className="sr-only"
              checked={isSelected}
              onChange={onSelect}
              aria-label={`Select ${data.title || 'article'}`}
            />
            <div
              className={`
                w-6 h-6 rounded-full border-2 flex items-center justify-center
                transition-all duration-150
                focus-within:ring-2 focus-within:ring-primary-500 focus-within:ring-offset-2
                ${isSelected
                  ? 'bg-primary-500 border-primary-500 text-white'
                  : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 hover:border-primary-400'
                }
              `}
            >
              {isSelected && <Check size={14} strokeWidth={3} aria-hidden="true" />}
            </div>
          </label>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TWO-CARD ARCHITECTURE: Hybrid vs Media-Only
          ═══════════════════════════════════════════════════════════════════════ */}
      
      {data.cardType === 'media-only' ? (
        /* TYPE B: MEDIA-ONLY CARD - Media fills card body, optional short caption, footer */
        /* CRITICAL: No text wrapper block, no hybrid spacing/padding - image fills available space */
        /* flex-1 allows media to expand and fill available height in equal-height grid rows */
        /* min-h-[200px] prevents collapse on small screens where flex space is limited */
        <div
          className="flex-1 flex flex-col relative overflow-hidden rounded-t-xl cursor-pointer min-h-[200px]"
          onClick={handleCardClick}
        >
          {/* Media fills full available card body space (no padding wrapper like hybrid cards) */}
          {/* For Media-Only cards: image click opens lightbox (same as hybrid cards) */}
          {data.hasMedia && (
            <div className="absolute inset-0 pt-2 px-2 pb-2 bg-slate-100 dark:bg-slate-800">
              <CardMedia
                article={data}
                visibility={data.visibility}
                onMediaClick={(e) => {
                  // UNIFIED BEHAVIOR: Media-only cards use same lightbox behavior as hybrid cards
                  handlers.onMediaClick(e);
                }}
                className="w-full h-full rounded-lg"
                isMediaOnly={true}
              />
              
              {/* Optional short caption with compact bottom-band gradient - only render when caption exists */}
              {/* Positioned absolutely within the media container */}
              {((data.content || data.excerpt || '').trim().length > 0) && (
                <div className="absolute bottom-2 left-2 right-2 z-10 rounded-lg overflow-hidden">
                  {/* Compact bottom-band gradient - height auto, sized to caption content - matches YouTube gradient intensity */}
                  <div className="bg-gradient-to-t from-black/80 via-black/60 to-transparent dark:from-black/80 dark:via-black/60 dark:to-transparent pointer-events-none">
                    {/* Caption container - bottom-left aligned, small padding */}
                    {/* Allow pointer events on content so links are clickable */}
                    <div className="px-2 py-1 text-white drop-shadow-sm line-clamp-3 [&_*]:text-white pointer-events-auto [&_a]:pointer-events-auto">
                      <CardContent
                        excerpt={data.excerpt}
                        content={data.content}
                        isTextNugget={data.isTextNugget}
                        variant="grid"
                        allowExpansion={false}
                        cardType="media-only"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Link Button - positioned absolutely in top-right (shows even when no media) */}
          {linkButtonProps.shouldShow && linkButtonProps.url && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                window.open(linkButtonProps.url, '_blank', 'noopener,noreferrer');
              }}
              className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-full tracking-wide flex items-center gap-1 transition-all hover:bg-black/90 hover:scale-105 z-20"
              aria-label="Open link in new tab"
            >
              <ExternalLink size={10} />
              <span>Link</span>
            </button>
          )}
        </div>
      ) : (
        /* TYPE A: HYBRID CARD - Media block at top, tags, title, body content, footer */
        <>
          {/* 1) MEDIA BLOCK (or gradient fallback if no media) */}
          {data.hasMedia ? (
            <div 
              className="relative w-full overflow-hidden rounded-t-xl pt-2 px-2 pb-2"
              onClick={(e) => {
                e.stopPropagation();
                handlers.onMediaClick(e);
              }}
            >
              <CardMedia
                article={data}
                visibility={data.visibility}
                onMediaClick={handlers.onMediaClick}
                className="aspect-video rounded-lg"
              />
              {/* Source Badge Overlay */}
              {!data.isTextNugget && data.sourceType === 'link' && (
                <CardBadge
                  isTextNugget={data.isTextNugget}
                  sourceType={data.sourceType}
                  media={data.media}
                  variant="overlay"
                  size="sm"
                  className="absolute top-3 left-3 z-10"
                />
              )}
              {/* Link Button - positioned absolutely in top-right */}
              {linkButtonProps.shouldShow && linkButtonProps.url && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(linkButtonProps.url, '_blank', 'noopener,noreferrer');
                  }}
                  className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-full tracking-wide flex items-center gap-1 transition-all hover:bg-black/90 hover:scale-105 z-20"
                  aria-label="Open link in new tab"
                >
                  <ExternalLink size={10} />
                  <span>Link</span>
                </button>
              )}
            </div>
          ) : (
            <div className="relative pt-2 px-2 pb-2">
              <CardGradientFallback title={data.title} className="rounded-t-xl" />
              {/* Link Button - for cards without media */}
              {linkButtonProps.shouldShow && linkButtonProps.url && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(linkButtonProps.url, '_blank', 'noopener,noreferrer');
                  }}
                  className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-full tracking-wide flex items-center gap-1 transition-all hover:bg-black/90 hover:scale-105 z-20"
                  aria-label="Open link in new tab"
                >
                  <ExternalLink size={10} />
                  <span>Link</span>
                </button>
              )}
            </div>
          )}

          {/* Card Body - Clickable for opening drawer */}
          {/* PHASE 2: 8-pt spacing rhythm (p-4 = 16px, gap-2 = 8px) */}
          {/* overflow-hidden + min-h-0 ensure content doesn't overflow in equal-height grid rows */}
          <div
            className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden px-4 pb-2 gap-2 cursor-pointer"
            onClick={handleCardClick}
          >
            {/* 2) TAGS - max 3, muted pills */}
            {data.tags && data.tags.length > 0 && (
              <CardTags
                tags={data.tags}
                onTagClick={handlers.onTagClick}
                showTagPopover={showTagPopover}
                onToggleTagPopover={handlers.onToggleTagPopover}
                tagPopoverRef={tagPopoverRef}
                variant="grid"
              />
            )}

            {/* 3) TITLE + BODY CONTENT - wrapped together in truncation wrapper for consistent fade alignment */}
            {/* Title is now included inside CardContent's truncation wrapper */}
            <CardContent
              excerpt={data.excerpt}
              content={data.content}
              isTextNugget={data.isTextNugget}
              variant="grid"
              allowExpansion={true}
              cardType={data.cardType}
              title={data.shouldShowTitle ? data.title : undefined}
            />
          </div>
        </>
      )}

      {/* 5) METADATA ROW + 6) ACTION ROW */}
      {/* PHASE 2: 8-pt spacing (px-4 = 16px, py-2 = 8px) */}
      <div 
        className={`
          mt-auto px-4 py-2
          border-t border-slate-100 dark:border-slate-800 
          flex items-center justify-between
          ${selectionMode ? 'opacity-50 pointer-events-none' : ''}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 5) METADATA - author, date (small + muted) */}
        <CardMeta
          authorName={data.authorName}
          authorId={data.authorId}
          formattedDate={data.formattedDate}
          authorAvatarUrl={data.authorAvatarUrl}
          onAuthorClick={handlers.onAuthorClick}
        />

        {/* 6) ACTIONS - share, save, menu (aligned) */}
        <CardActions
          articleId={data.id}
          articleTitle={data.title}
          articleExcerpt={data.excerpt}
          authorName={data.authorName}
          isOwner={isOwner}
          isAdmin={isAdmin}
          visibility={data.visibility}
          onAddToCollection={handlers.onAddToCollection}
          onReport={handlers.onReport}
          onEdit={handlers.onEdit}
          onDelete={handlers.onDelete}
          onToggleVisibility={handlers.onToggleVisibility}
          showMenu={showMenu}
          onToggleMenu={handlers.onToggleMenu}
          menuRef={menuRef}
          isPreview={isPreview}
        />
      </div>

      {/* Contributor badge (if applicable) */}
      {data.showContributor && data.contributorName && (
        <CardContributor contributorName={data.contributorName} />
      )}
    </article>
  );
};

