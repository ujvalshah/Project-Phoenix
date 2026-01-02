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

interface UtilityVariantProps {
  logic: NewsCardLogic;
  showTagPopover: boolean;
  showMenu: boolean;
  menuRef: React.RefObject<HTMLDivElement | null>;
  tagPopoverRef: React.RefObject<HTMLDivElement | null>;
  isOwner: boolean;
  isAdmin: boolean;
  isPreview?: boolean;
}

// Utility variant: Tags → Title → Body → Media (anchored to bottom)
export const UtilityVariant: React.FC<UtilityVariantProps> = ({
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
  
  // 🔍 AUDIT LOGGING - Card Type Usage in UtilityVariant (Enhanced Diagnostics)
  React.useEffect(() => {
    const renderBranch = data.cardType === 'media-only' ? 'TYPE-B-MEDIA-ONLY' : 'TYPE-A-HYBRID';
    const hasText = Boolean((data.content || data.excerpt || '').trim());
    const textLength = (data.content || data.excerpt || '').length;
    
    const renderingData = {
      id: data.id.substring(0, 8) + '...',
      renderComponent: 'UtilityVariant',
      renderBranch,
      cardType: data.cardType,
      hasMedia: data.hasMedia,
      hasText,
      textLength,
      shouldShowTitle: data.shouldShowTitle,
      willUseCardMedia: data.hasMedia,
      willUseOverlayText: data.cardType === 'media-only' && hasText,
      willUseTruncation: data.cardType === 'hybrid',
    };
    console.log('[CARD-AUDIT] UtilityVariant Rendering:', JSON.stringify(renderingData, null, 2));
    console.log('[CARD-AUDIT] UtilityVariant Rendering (expanded):', renderingData);
    
    // CRITICAL: Warn if cardType is media-only but has long text
    if (data.cardType === 'media-only' && textLength > 200) {
      console.warn('[CARD-AUDIT] ⚠️ MEDIA-ONLY CARD WITH LONG TEXT!', {
        id: data.id.substring(0, 8) + '...',
        cardType: data.cardType,
        contentLength: textLength,
        renderBranch,
      });
    }
  }, [data.id, data.cardType, data.hasMedia, data.content, data.excerpt, data.shouldShowTitle]);

  // Generate descriptive aria-label for the card
  const ariaLabelParts: string[] = [];
  if (data.title) {
    ariaLabelParts.push(data.title);
  }
  if (data.categories.length > 0) {
    ariaLabelParts.push(`Tagged with ${data.categories.join(', ')}`);
  }
  if (data.authorName) {
    ariaLabelParts.push(`by ${data.authorName}`);
  }
  if (data.excerpt) {
    const excerptPreview = data.excerpt.length > 100 
      ? `${data.excerpt.substring(0, 100)}...` 
      : data.excerpt;
    ariaLabelParts.push(excerptPreview);
  }
  const ariaLabel = ariaLabelParts.length > 0 
    ? ariaLabelParts.join('. ') + '. Click to view full article.'
    : 'Article card. Click to view details.';

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Allow keyboard navigation within card (buttons, links)
    const target = e.target as HTMLElement;
    if (target.tagName === 'BUTTON' || target.tagName === 'A' || target.closest('button') || target.closest('a')) {
      return; // Let buttons and links handle their own keyboard events
    }

    // Enter or Space activates the card
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handlers.onClick?.();
    }
  };

  return (
    <article
      role="article"
      aria-label={ariaLabel}
      tabIndex={0}
      className="group relative flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-300 w-full p-5 gap-4 h-full min-h-[400px] focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
      onKeyDown={handleKeyDown}
    >
      {/* TWO-CARD ARCHITECTURE: Hybrid vs Media-Only */}
      {data.cardType === 'media-only' ? (
        /* TYPE B: MEDIA-ONLY CARD - Media fills card height, optional short caption, footer */
        <div 
          className="flex-1 flex flex-col min-h-0 relative overflow-hidden rounded-lg cursor-pointer"
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
                  console.log('[CARD-CLICK] Media-only card image clicked - opening lightbox (UtilityVariant)');
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
                <div className="px-2 py-1 text-white drop-shadow-sm line-clamp-3 [&_*]:text-white pointer-events-auto [&_a]:pointer-events-auto">
                  <CardContent
                    excerpt={data.excerpt}
                    content={data.content}
                    isTextNugget={data.isTextNugget}
                    variant="utility"
                    allowExpansion={false}
                    cardType="media-only"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* TYPE A: HYBRID CARD - Tags, title, body content, media at bottom, footer */
        <>
          {/* Card Body - Clickable area for opening drawer */}
          <div 
            className="flex flex-col flex-1 min-w-0 gap-4 cursor-pointer"
            onClick={handlers.onClick}
          >
            {/* 1. Header Zone: Tags (Left) + Source Badge (Right) */}
            <div className="flex justify-between items-start gap-2">
              <div className="flex-1 min-w-0">
                <CardTags
                  categories={data.categories}
                  onCategoryClick={handlers.onCategoryClick}
                  showTagPopover={showTagPopover}
                  onToggleTagPopover={handlers.onToggleTagPopover}
                  tagPopoverRef={tagPopoverRef}
                />
              </div>
              {/* Source Badge - Right Side of Header */}
              {!data.isTextNugget && data.sourceType === 'link' && (
                <CardBadge
                  isTextNugget={data.isTextNugget}
                  sourceType={data.sourceType}
                  media={data.media}
                  variant="inline"
                  size="sm"
                />
              )}
            </div>

        {/* 2. Title + Body/Content - wrapped together in truncation wrapper for consistent fade alignment */}
        {/* Title is now included inside CardContent's truncation wrapper */}
        <div className="flex flex-col flex-1 min-w-0 gap-4">
          <CardContent
            excerpt={data.excerpt}
            content={data.content}
            isTextNugget={data.isTextNugget}
            variant="utility"
            allowExpansion={true}
            cardType="hybrid"
            title={data.shouldShowTitle ? data.title : undefined}
          />
              
              {/* 4. Media anchored to bottom for uniformity across cards (or gradient fallback) */}
              {data.hasMedia ? (
                <div className="pt-2 px-2 pb-2 mt-auto">
                  <CardMedia
                    article={data}
                    visibility={data.visibility}
                    onMediaClick={handlers.onMediaClick}
                    className="rounded-lg shrink-0"
                  />
                </div>
              ) : (
                <div className="pt-2 px-2 pb-2 mt-auto">
                  <CardGradientFallback title={data.title} className="rounded-lg" />
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Footer - Actions only, must NOT open drawer */}
      <div 
        className="pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0"
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
        />
      </div>

      {data.showContributor && data.contributorName && (
        <CardContributor contributorName={data.contributorName} />
      )}
    </article>
  );
};

