import React from 'react';
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

interface FeedVariantProps {
  logic: NewsCardLogic;
  showTagPopover: boolean;
  showMenu: boolean;
  menuRef: React.RefObject<HTMLDivElement | null>;
  tagPopoverRef: React.RefObject<HTMLDivElement | null>;
  isOwner: boolean;
  isAdmin: boolean;
  isPreview?: boolean;
}

export const FeedVariant: React.FC<FeedVariantProps> = ({
  logic,
  showTagPopover,
  showMenu,
  menuRef,
  tagPopoverRef,
  isOwner,
  isAdmin,
  isPreview = false,
}) => {
  const { data, handlers } = logic;
  
  // Warn if cardType is media-only but has long text
  React.useEffect(() => {
    const textLength = (data.content || data.excerpt || '').length;
    if (data.cardType === 'media-only' && textLength > 200) {
      console.warn('[CARD-AUDIT] ⚠️ MEDIA-ONLY CARD WITH LONG TEXT!', {
        id: data.id.substring(0, 8) + '...',
        cardType: data.cardType,
        contentLength: textLength,
      });
    }
  }, [data.id, data.cardType, data.content, data.excerpt]);

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
      if (handlers.onClick) {
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
      aria-label={ariaLabel}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="group relative flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] transition-all duration-150 w-full p-6 gap-4 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900"
    >
      {/* TWO-CARD ARCHITECTURE: Hybrid vs Media-Only */}
      {data.cardType === 'media-only' ? (
        /* TYPE B: MEDIA-ONLY CARD - Media fills card height, optional short caption, footer */
        /* min-h-[200px] prevents collapse on small screens where flex space is limited */
        <div
          className="flex-1 flex flex-col min-h-[200px] relative overflow-hidden rounded-lg cursor-pointer"
          onClick={handlers.onClick}
        >
          {/* Media fills full available height (except caption + footer) */}
          {/* For Media-Only cards: image click opens lightbox (same as hybrid cards) */}
          {data.hasMedia && (
            <div className="absolute inset-0 pt-2 px-2 relative">
              <CardMedia
                article={data}
                visibility={data.visibility}
                onMediaClick={(e) => {
                  // UNIFIED BEHAVIOR: Media-only cards use same lightbox behavior as hybrid cards
                  handlers.onMediaClick(e);
                }}
                className="w-full h-full"
              />
            </div>
          )}
          
          {/* Optional short caption with compact bottom-band gradient - only render when caption exists */}
          {((data.content || data.excerpt || '').trim().length > 0) && (
            <div className="absolute bottom-0 left-0 right-0 z-10">
              {/* Compact bottom-band gradient - height auto, sized to caption content - matches YouTube gradient intensity */}
              <div className="bg-gradient-to-t from-black/80 via-black/60 to-transparent dark:from-black/80 dark:via-black/60 dark:to-transparent pointer-events-none">
                {/* Caption container - bottom-left aligned, small padding */}
                {/* Allow pointer events on content so links are clickable */}
                {/* NOTE: Removed line-clamp-3 - CardContent handles overflow detection and "Read more" */}
                <div className="px-2 py-1 text-white drop-shadow-sm [&_*]:text-white pointer-events-auto [&_a]:pointer-events-auto">
                  <CardContent
                    excerpt={data.excerpt}
                    content={data.content}
                    isTextNugget={data.isTextNugget}
                    variant="feed"
                    allowExpansion={true}
                    cardType="media-only"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* TYPE A: HYBRID CARD - Media block at top, tags, title, body content, footer */
        <>
          {/* Card Body - Clickable area for opening drawer */}
          <div 
            className="flex flex-col min-w-0 cursor-pointer"
            onClick={handlers.onClick}
          >
            {/* 1. Media first (or gradient fallback if no media) */}
            {data.hasMedia ? (
              <div className="pt-2 px-2 pb-2">
                <CardMedia
                  article={data}
                  visibility={data.visibility}
                  onMediaClick={handlers.onMediaClick}
                  className="rounded-lg shrink-0"
                />
              </div>
            ) : (
              <div className="pt-2 px-2 pb-2">
                <CardGradientFallback title={data.title} className="rounded-lg" />
              </div>
            )}

            {/* 2. Tags - Visually demoted (1-2 max, muted pills) */}
            {data.tags && data.tags.length > 0 && (
              <div onClick={(e) => e.stopPropagation()} className="mb-2">
                <CardTags
                  tags={data.tags}
                  onTagClick={handlers.onTagClick}
                  showTagPopover={showTagPopover}
                  onToggleTagPopover={handlers.onToggleTagPopover}
                  tagPopoverRef={tagPopoverRef}
                  variant="feed"
                />
              </div>
            )}

            {/* 3. Title + Content body - wrapped together in truncation wrapper for consistent fade alignment */}
            {/* Title is now included inside CardContent's truncation wrapper */}
            <CardContent
              excerpt={data.excerpt}
              content={data.content}
              isTextNugget={data.isTextNugget}
              variant="feed"
              allowExpansion={true}
              cardType="hybrid"
              title={data.shouldShowTitle ? data.title : undefined}
            />
          </div>
        </>
      )}

      {/* Footer - Actions only, must NOT open drawer */}
      {/* Finance-grade: Reduced visual weight, increased hit areas, cohesive grouping */}
      <div 
        className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <CardMeta
          authorName={data.authorName}
          authorId={data.authorId}
          formattedDate={data.formattedDate}
          authorAvatarUrl={data.authorAvatarUrl}
          onAuthorClick={handlers.onAuthorClick}
        />

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
          variant="feed"
        />
      </div>

      {data.showContributor && data.contributorName && (
        <CardContributor contributorName={data.contributorName} />
      )}
    </article>
  );
};

