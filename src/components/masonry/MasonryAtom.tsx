import React, { memo, useState, useRef } from 'react';
import { Article } from '@/types';
import { MediaBlock } from './MediaBlock';
import { TextBlock } from './TextBlock';
import { ActionHUD } from './ActionHUD';
import { useMasonryInteraction } from '@/hooks/useMasonryInteraction';
import { CollectionPopover } from '@/components/CollectionPopover';
import { ReportModal, ReportPayload } from '@/components/ReportModal';
import { CreateNuggetModalLoadable } from '@/components/CreateNuggetModalLoadable';
import { shallowEqualAuth, useAuthSelector } from '@/context/AuthContext';
import { useToast } from '@/hooks/useToast';
import { adminModerationService } from '@/admin/services/adminModerationService';
import { storageService } from '@/services/storageService';
import { useQueryClient } from '@tanstack/react-query';
import {
  getMasonryVisibleMedia,
  resolveMasonrySourceLink,
  type MasonryMediaItem,
} from '@/utils/masonryMediaHelper';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { articleKeys, invalidateArticleListCaches } from '@/services/queryKeys/articleKeys';

interface MasonryAtomProps {
  article: Article;
  mediaItemId?: string; // If specified, render only this media item
  /** From MasonryGrid — avoids getMasonryVisibleMedia per tile. */
  tileMediaItem?: MasonryMediaItem;
  /** From MasonryGrid — passed to MediaBlock for lightbox without re-collecting. */
  prefetchedAllMasonryItems?: MasonryMediaItem[];
  onArticleClick: (article: Article) => void;
  onCategoryClick?: (category: string) => void;
  currentUserId?: string;
  /** First-viewport masonry image: eager + fetch priority */
  priorityImageLoading?: boolean;
}

/**
 * Avoid full-tree re-renders when MasonryGrid’s parent re-renders with the same tile props
 * (e.g. fetch status, unrelated layout state). Prefer referential equality on `article` from
 * the query cache; when the server/cache updates articles, refs change and tiles correctly refresh.
 */
function masonryAtomPropsAreEqual(
  prev: MasonryAtomProps,
  next: MasonryAtomProps,
): boolean {
  return (
    prev.article === next.article &&
    prev.mediaItemId === next.mediaItemId &&
    prev.tileMediaItem === next.tileMediaItem &&
    prev.prefetchedAllMasonryItems === next.prefetchedAllMasonryItems &&
    prev.priorityImageLoading === next.priorityImageLoading &&
    prev.currentUserId === next.currentUserId &&
    prev.onArticleClick === next.onArticleClick &&
    prev.onCategoryClick === next.onCategoryClick
  );
}

/**
 * MasonryAtom: Lightweight content-first renderer for Masonry view
 * 
 * Rules:
 * - No card styling (no backgrounds, borders, shadows)
 * - Content-first rendering
 * - Transparent hit-box container
 * - Hover-triggered action HUD
 */
const MasonryAtomInner: React.FC<MasonryAtomProps> = ({
  article,
  mediaItemId,
  tileMediaItem,
  prefetchedAllMasonryItems,
  onArticleClick,
  onCategoryClick,
  currentUserId,
  priorityImageLoading = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const { currentUser } = useAuthSelector(
    (a) => ({ currentUser: a.user }),
    shallowEqualAuth,
  );
  const queryClient = useQueryClient();
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  const {
    handleClick,
    showCollectionPopover,
    setShowCollectionPopover,
    collectionAnchor,
    setCollectionAnchor,
    showReportModal,
    setShowReportModal,
    showEditModal,
    setShowEditModal,
  } = useMasonryInteraction({
    article,
    onArticleClick,
    currentUserId,
  });

  const shouldRenderMedia =
    mediaItemId !== undefined &&
    (tileMediaItem != null ||
      getMasonryVisibleMedia(article).some((i) => i.id === mediaItemId));

  const isOwner = currentUserId && article.author ? currentUserId === article.author.id : false;
  const isAdmin = currentUser?.role === 'admin';

  const sourceLink = tileMediaItem
    ? resolveMasonrySourceLink(article, tileMediaItem)
    : resolveMasonrySourceLink(
        article,
        mediaItemId
          ? getMasonryVisibleMedia(article).find((i) => i.id === mediaItemId)
          : undefined,
      );

  const handleReport = async (payload: ReportPayload) => {
    try {
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
        article.author && article.author.id ? {
          id: article.author.id,
          name: article.author.name || 'Unknown'
        } : undefined
      );
      toast.success('Report submitted successfully');
      setShowReportModal(false);
    } catch (error: any) {
      console.error('Failed to submit report:', error);
      const status = error?.response?.status;
      let errorMessage: string;
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
      throw error;
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Delete this nugget permanently?')) {
      try {
        await storageService.deleteArticle(article.id);
        await invalidateArticleListCaches(queryClient);
        await queryClient.invalidateQueries({ queryKey: articleKeys.detail(article.id), exact: true });
        toast.success('Nugget deleted');
      } catch (error) {
        toast.error('Failed to delete nugget');
      }
    }
  };

  return (
    <>
      <div
        className="group relative break-inside-avoid mb-4"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
        }}
        onFocusCapture={() => {
          // Show Action HUD when any tile content receives focus (keyboard + tap-to-focus behavior).
          setIsHovered(true);
        }}
        onBlurCapture={(e) => {
          const relatedTarget = e.relatedTarget as Node | null;
          const currentTarget = e.currentTarget as HTMLElement;
          const movedFocusToPortaledMenu =
            relatedTarget instanceof HTMLElement &&
            !!relatedTarget.closest('[data-masonry-more-menu="true"]');
          // Only hide when focus actually leaves the entire masonry tile subtree.
          // Portaled menu items are outside the tile subtree; keep HUD/menu alive when focus
          // moves there so keyboard and pointer activation remain reliable.
          if (movedFocusToPortaledMenu) {
            return;
          }
          if (relatedTarget && currentTarget.contains(relatedTarget)) {
            return;
          }
          setIsHovered(false);
          setShowMoreMenu(false);
        }}
      >
        {/* Transparent hit-box container */}
        <div
          className="relative cursor-pointer transition-colors duration-150"
          onClick={handleClick}
          style={{
            backgroundColor: isHovered ? 'rgba(0, 0, 0, 0.01)' : 'transparent',
          }}
        >
          {/* Content: Media or Text */}
          {shouldRenderMedia ? (
            <MediaBlock
              article={article}
              mediaItemId={mediaItemId}
              prefetchedAllMasonryItems={prefetchedAllMasonryItems}
              onCategoryClick={onCategoryClick}
              onArticleClick={onArticleClick}
              priorityImageLoading={priorityImageLoading}
            />
          ) : (
            <TextBlock
              article={article}
              onCategoryClick={onCategoryClick}
            />
          )}

          {/* Hover-triggered Action HUD (desktop) + Always-visible Source (mobile/tablet) */}
          {(!!sourceLink && (isHovered || showMoreMenu || !isDesktop)) && (
            <ActionHUD
              article={article}
              onAddToCollection={
                isAdmin
                  ? (e) => {
                      e.stopPropagation();
                      if (e.currentTarget) {
                        setCollectionAnchor(e.currentTarget.getBoundingClientRect());
                        setShowCollectionPopover(true);
                      }
                    }
                  : undefined
              }
              onMore={(e) => {
                e.stopPropagation();
                setShowMoreMenu(!showMoreMenu);
              }}
              sourceLink={sourceLink}
              // On mobile/tablet we keep BOTH controls visible to avoid UI "breaking"
              // when the user first taps Source (focus/hover state changes).
              showMenuButton={true}
              showMoreMenu={showMoreMenu}
              moreMenuRef={moreMenuRef}
              onMenuClose={() => setShowMoreMenu(false)}
              isOwner={isOwner}
              isAdmin={isAdmin}
              onReport={() => setShowReportModal(true)}
              onEdit={() => setShowEditModal(true)}
              onDuplicate={() => {
                toast.info(`Duplicating "${article.title?.trim() || 'Untitled'}"`);
                setShowDuplicateModal(true);
              }}
              onDelete={handleDelete}
            />
          )}
        </div>
      </div>

      {/* Mount only when open — avoids N× popover/modal subtrees on long masonry feeds */}
      {showCollectionPopover && (
        <CollectionPopover
          isOpen
          onClose={() => setShowCollectionPopover(false)}
          articleId={article.id}
          mode="private"
          anchorRect={collectionAnchor}
        />
      )}
      {showReportModal && (
        <ReportModal
          isOpen
          onClose={() => setShowReportModal(false)}
          onSubmit={handleReport}
          articleId={article.id}
        />
      )}
      {showEditModal && (
        <CreateNuggetModalLoadable
          isOpen
          onClose={() => setShowEditModal(false)}
          mode="edit"
          initialData={article}
        />
      )}
      {showDuplicateModal && (
        <CreateNuggetModalLoadable
          isOpen
          onClose={() => setShowDuplicateModal(false)}
          mode="create"
          prefillData={article}
        />
      )}
    </>
  );
};

export const MasonryAtom = memo(MasonryAtomInner, masonryAtomPropsAreEqual);

MasonryAtom.displayName = 'MasonryAtom';

