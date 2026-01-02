import { forwardRef } from 'react';
import { Article } from '@/types';
import { useNewsCard } from '@/hooks/useNewsCard';
import { GridVariant } from './card/variants/GridVariant';
import { FeedVariant } from './card/variants/FeedVariant';
import { MasonryVariant } from './card/variants/MasonryVariant';
import { UtilityVariant } from './card/variants/UtilityVariant';
import { CollectionPopover } from './CollectionPopover';
import { ReportModal, ReportPayload } from './ReportModal';
import { ArticleModal } from './ArticleModal';
import { ImageLightbox } from './ImageLightbox';
import { ArticleDetail } from './ArticleDetail';
import { CreateNuggetModal } from './CreateNuggetModal';
import { useToast } from '@/hooks/useToast';
import { adminModerationService } from '@/admin/services/adminModerationService';
import { useAuth } from '@/hooks/useAuth';

interface NewsCardProps {
  article: Article;
  viewMode: 'grid' | 'feed' | 'masonry' | 'utility';
  onTagClick?: (tag: string) => void;
  onCategoryClick: (category: string) => void;
  onClick: (article: Article) => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
  currentUserId?: string;
  isPreview?: boolean;
  // Selection Props
  selectionMode?: boolean;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
}

export const NewsCard = forwardRef<HTMLDivElement, NewsCardProps>(
  (
    {
      article,
      viewMode,
      onCategoryClick,
      onClick,
      currentUserId,
      onTagClick,
      isPreview = false,
      selectionMode = false,
      isSelected = false,
      onSelect,
    },
    ref
  ) => {
    const toast = useToast();
    const { currentUser } = useAuth();

    // Call the logic hook
    const hookResult = useNewsCard({
      article,
      currentUserId,
      onCategoryClick,
      onTagClick,
      onClick,
      isPreview,
    });

    const { logic, modals, refs, article: originalArticle, isOwner, isAdmin } = hookResult;

    // Switch on viewMode to render the appropriate variant
    // Debug: Log viewMode to verify it's being passed correctly
    if (process.env.NODE_ENV === 'development' && viewMode === 'utility') {
      console.log('[NewsCard] Rendering utility variant for article:', article.id);
    }
    
    let variant;
    switch (viewMode) {
      case 'grid':
        variant = (
          <GridVariant
            logic={logic}
            showTagPopover={modals.showTagPopover}
            showMenu={modals.showMenu}
            menuRef={refs.menuRef}
            tagPopoverRef={refs.tagPopoverRef}
            isOwner={isOwner}
            isAdmin={isAdmin}
            isPreview={isPreview}
            selectionMode={selectionMode}
            isSelected={isSelected}
            onSelect={onSelect ? () => onSelect(article.id) : undefined}
          />
        );
        break;
      case 'feed':
        variant = (
          <FeedVariant
            logic={logic}
            showTagPopover={modals.showTagPopover}
            showMenu={modals.showMenu}
            menuRef={refs.menuRef}
            tagPopoverRef={refs.tagPopoverRef}
            isOwner={isOwner}
            isAdmin={isAdmin}
            isPreview={isPreview}
          />
        );
        break;
      case 'masonry':
        variant = (
          <MasonryVariant
            logic={logic}
            showTagPopover={modals.showTagPopover}
            showMenu={modals.showMenu}
            menuRef={refs.menuRef}
            tagPopoverRef={refs.tagPopoverRef}
            isOwner={isOwner}
            isAdmin={isAdmin}
            isPreview={isPreview}
          />
        );
        break;
      case 'utility':
        variant = (
          <UtilityVariant
            logic={logic}
            showTagPopover={modals.showTagPopover}
            showMenu={modals.showMenu}
            menuRef={refs.menuRef}
            tagPopoverRef={refs.tagPopoverRef}
            isOwner={isOwner}
            isAdmin={isAdmin}
            isPreview={isPreview}
          />
        );
        break;
      default:
        variant = (
          <GridVariant
            logic={logic}
            showTagPopover={modals.showTagPopover}
            showMenu={modals.showMenu}
            menuRef={refs.menuRef}
            tagPopoverRef={refs.tagPopoverRef}
            isOwner={isOwner}
            isAdmin={isAdmin}
            isPreview={isPreview}
          />
        );
    }

    return (
      <>
        <div ref={ref}>{variant}</div>

        {/* Modals rendered by Controller */}
        <CollectionPopover
          isOpen={modals.showCollection}
          onClose={() => modals.setShowCollection(false)}
          articleId={originalArticle.id}
          mode={modals.collectionMode}
          anchorRect={modals.collectionAnchor}
        />
        <ReportModal
          isOpen={modals.showReport}
          onClose={() => modals.setShowReport(false)}
          onSubmit={async (payload: ReportPayload) => {
            try {
              // FIX #6: Normalize optional fields (trim strings, pass undefined when empty)
              const normalizedComment = payload.comment?.trim() || undefined;

              await adminModerationService.submitReport(
                payload.articleId,
                'nugget',
                payload.reason,
                normalizedComment,
                currentUser ? {
                  id: currentUser.id,
                  name: currentUser.name
                } : undefined,
                originalArticle.author ? {
                  id: originalArticle.author.id,
                  name: originalArticle.author.name
                } : undefined
              );
              toast.success('Report submitted successfully');
            } catch (error: any) {
              console.error('Failed to submit report:', error);
              
              // FIX #3: Error handling specificity based on HTTP status
              // Provides better UX by differentiating error types
              let errorMessage: string;
              const status = error?.response?.status;
              
              if (status === 400) {
                errorMessage = 'Invalid report data. Please check your input.';
              } else if (status === 429) {
                errorMessage = 'Too many reports. Please wait a moment before trying again.';
              } else if (status === 403) {
                errorMessage = 'You do not have permission to submit this report.';
              } else if (status >= 500) {
                errorMessage = 'Server error. Please try again later.';
              } else {
                errorMessage = 'Failed to submit report. Please try again.';
              }
              
              toast.error(errorMessage);
              throw error; // Re-throw so ReportModal can handle it
            }
          }}
          articleId={originalArticle.id}
        />
        {modals.showFullModal && (
          <ArticleModal
            isOpen={modals.showFullModal}
            onClose={() => modals.setShowFullModal(false)}
            article={originalArticle}
          />
        )}
        <ImageLightbox
          isOpen={modals.showLightbox}
          onClose={(e) => {
            // Stop event bubbling from image tiles so closing the carousel
            // does not trigger the masonry tile drawer click handler.
            e?.stopPropagation?.();
            modals.setShowLightbox(false);
          }}
          images={originalArticle.images || []}
          initialIndex={modals.lightboxInitialIndex || 0}
          sidebarContent={
            modals.showLightbox ? (
              <ArticleDetail
                article={originalArticle}
                isModal={false}
              />
            ) : undefined
          }
        />
        <CreateNuggetModal
          isOpen={modals.showEditModal}
          onClose={() => modals.setShowEditModal(false)}
          mode="edit"
          initialData={originalArticle}
        />
      </>
    );
  }
);

NewsCard.displayName = 'NewsCard';
