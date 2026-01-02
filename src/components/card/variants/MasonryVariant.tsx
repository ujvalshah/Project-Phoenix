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

interface MasonryVariantProps {
  logic: NewsCardLogic;
  showTagPopover: boolean;
  showMenu: boolean;
  menuRef: React.RefObject<HTMLDivElement | null>;
  tagPopoverRef: React.RefObject<HTMLDivElement | null>;
  isOwner: boolean;
  isAdmin: boolean;
  isPreview?: boolean;
}

export const MasonryVariant: React.FC<MasonryVariantProps> = ({
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
  
  // 🔍 AUDIT LOGGING - Card Type Usage in MasonryVariant (Enhanced Diagnostics)
  React.useEffect(() => {
    const renderBranch = data.cardType === 'media-only' ? 'TYPE-B-MEDIA-ONLY' : 'TYPE-A-HYBRID';
    const hasText = Boolean((data.content || data.excerpt || '').trim());
    const textLength = (data.content || data.excerpt || '').length;
    
    const renderingData = {
      id: data.id.substring(0, 8) + '...',
      renderComponent: 'MasonryVariant',
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
    console.log('[CARD-AUDIT] MasonryVariant Rendering:', JSON.stringify(renderingData, null, 2));
    console.log('[CARD-AUDIT] MasonryVariant Rendering (expanded):', renderingData);
    
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
      className="group relative flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-300 w-full p-4 break-inside-avoid mb-6"
      style={{ height: 'auto' }}
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
                  console.log('[CARD-CLICK] Media-only card image clicked - opening lightbox (MasonryVariant)');
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
                    variant="masonry"
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
            className="flex flex-col flex-1 min-w-0 cursor-pointer"
            onClick={handlers.onClick}
          >
            {data.hasMedia ? (
              <div className="pt-2 px-2 pb-2">
                <CardMedia
                  article={data}
                  visibility={data.visibility}
                  onMediaClick={handlers.onMediaClick}
                  className="w-full rounded-lg"
                />
              </div>
            ) : (
              <div className="pt-2 px-2 pb-2">
                <CardGradientFallback title={data.title} className="rounded-lg" />
              </div>
            )}

            <div className="flex flex-col flex-1 min-w-0">
              <CardBadge 
                isTextNugget={data.isTextNugget} 
                sourceType={data.sourceType}
                media={data.media}
              />

              <CardTags
                categories={data.categories}
                onCategoryClick={handlers.onCategoryClick}
                showTagPopover={showTagPopover}
                onToggleTagPopover={handlers.onToggleTagPopover}
                tagPopoverRef={tagPopoverRef}
                className="mb-2"
              />

              {/* Title + Content body - wrapped together in truncation wrapper for consistent fade alignment */}
              {/* Title is now included inside CardContent's truncation wrapper */}
              <CardContent
                excerpt={data.excerpt}
                content={data.content}
                isTextNugget={data.isTextNugget}
                variant="masonry"
                allowExpansion={true}
                cardType="hybrid"
                title={data.shouldShowTitle ? data.title : undefined}
              />
            </div>
          </div>
        </>
      )}

      {/* Footer - Actions only, must NOT open drawer */}
      <div 
        className="mt-auto pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0"
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
    </div>
  );
};

