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
  
  // 🔍 AUDIT LOGGING - Card Type Usage in FeedVariant (Enhanced Diagnostics)
  React.useEffect(() => {
    const renderBranch = data.cardType === 'media-only' ? 'TYPE-B-MEDIA-ONLY' : 'TYPE-A-HYBRID';
    const hasText = Boolean((data.content || data.excerpt || '').trim());
    const textLength = (data.content || data.excerpt || '').length;
    
    const renderingData = {
      id: data.id.substring(0, 8) + '...',
      renderComponent: 'FeedVariant',
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
    console.log('[CARD-AUDIT] FeedVariant Rendering:', JSON.stringify(renderingData, null, 2));
    console.log('[CARD-AUDIT] FeedVariant Rendering (expanded):', renderingData);
    
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

  return (
    <div
      className="group relative flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] transition-all duration-150 w-full p-6 gap-4 hover:-translate-y-0.5"
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
                  console.log('[CARD-CLICK] Media-only card image clicked - opening lightbox (FeedVariant)');
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
                    variant="feed"
                    allowExpansion={false}
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
            {data.categories && data.categories.length > 0 && (
              <div onClick={(e) => e.stopPropagation()} className="mb-2">
                <CardTags
                  categories={data.categories}
                  onCategoryClick={handlers.onCategoryClick}
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
    </div>
  );
};

