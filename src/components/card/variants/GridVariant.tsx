import React from 'react';
import { Check } from 'lucide-react';
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
  
  // 🔍 AUDIT LOGGING - Card Type Usage in GridVariant (Enhanced Diagnostics)
  React.useEffect(() => {
    const renderBranch = data.cardType === 'media-only' ? 'TYPE-B-MEDIA-ONLY' : 'TYPE-A-HYBRID';
    const hasText = Boolean((data.content || data.excerpt || '').trim());
    const textLength = (data.content || data.excerpt || '').length;
    
    // DEFENSIVE: Log resolved renderedCardType to track classification -> rendering path
    const renderedCardType = data.cardType === 'media-only' ? 'media-only' : 'hybrid';
    
    const renderingData = {
      id: data.id.substring(0, 8) + '...',
      renderComponent: 'GridVariant',
      detectedCardType: data.cardType,
      renderedCardType, // Track what layout will actually be used
      renderBranch,
      hasMedia: data.hasMedia,
      hasText,
      textLength,
      shouldShowTitle: data.shouldShowTitle,
      willPassCardTypeToContent: data.cardType, // Verify this matches what's passed to CardContent
      willUseCardMedia: data.hasMedia,
      willUseOverlayText: data.cardType === 'media-only' && hasText,
      willUseTruncation: data.cardType === 'hybrid',
    };
    console.log('[CARD-AUDIT] GridVariant Rendering:', JSON.stringify(renderingData, null, 2));
    console.log('[CARD-AUDIT] GridVariant Rendering (expanded):', renderingData);
    
    // CRITICAL: Warn if cardType is media-only but will render as hybrid
    if (data.cardType === 'media-only' && renderedCardType !== 'media-only') {
      console.error('[CARD-AUDIT] ❌ CRITICAL: Media-only card being rendered as hybrid!', {
        id: data.id.substring(0, 8) + '...',
        detectedCardType: data.cardType,
        renderedCardType,
        renderBranch,
      });
    }
    
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

  const handleCardClick = (e: React.MouseEvent) => {
    if (selectionMode && onSelect) {
      e.stopPropagation();
      onSelect();
    } else if (handlers.onClick) {
      handlers.onClick();
    }
  };

  return (
    <article
      className={`
        group relative flex flex-col h-full
        bg-white dark:bg-slate-900 
        border rounded-xl
        shadow-sm hover:shadow-md
        transition-shadow duration-200
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
          <div 
            className={`
              w-5 h-5 rounded-full border-2 flex items-center justify-center 
              transition-colors duration-150 cursor-pointer
              ${isSelected 
                ? 'bg-primary-500 border-primary-500 text-white' 
                : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600'
              }
            `}
            onClick={onSelect}
          >
            {isSelected && <Check size={12} strokeWidth={3} />}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TWO-CARD ARCHITECTURE: Hybrid vs Media-Only
          ═══════════════════════════════════════════════════════════════════════ */}
      
      {data.cardType === 'media-only' ? (
        /* TYPE B: MEDIA-ONLY CARD - Media fills card body, optional short caption, footer */
        /* CRITICAL: No text wrapper block, no hybrid spacing/padding - image fills available space */
        <div 
          className="flex-1 flex flex-col relative overflow-hidden rounded-t-xl cursor-pointer min-h-[240px]"
          onClick={handleCardClick}
        >
          {/* Media fills full available card body space (no padding wrapper like hybrid cards) */}
          {/* For Media-Only cards: image click opens lightbox (same as hybrid cards) */}
          {data.hasMedia && (
            <div className="absolute inset-0 pt-2 px-2 pb-2 min-h-[240px] bg-slate-100 dark:bg-slate-800">
              <CardMedia
                article={data}
                visibility={data.visibility}
                onMediaClick={(e) => {
                  // UNIFIED BEHAVIOR: Media-only cards use same lightbox behavior as hybrid cards
                  console.log('[CARD-CLICK] Media-only card image clicked - opening lightbox (GridVariant)');
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
            </div>
          ) : (
            <div className="pt-2 px-2 pb-2">
              <CardGradientFallback title={data.title} className="rounded-t-xl" />
            </div>
          )}

          {/* Card Body - Clickable for opening drawer */}
          {/* PHASE 2: 8-pt spacing rhythm (p-4 = 16px, gap-2 = 8px) */}
          <div 
            className="flex flex-col flex-1 min-w-0 px-4 pb-2 gap-2 cursor-pointer"
            onClick={handleCardClick}
          >
            {/* 2) CATEGORY TAGS - max 3, muted pills */}
            {data.categories && data.categories.length > 0 && (
              <CardTags
                categories={data.categories}
                onCategoryClick={handlers.onCategoryClick}
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

