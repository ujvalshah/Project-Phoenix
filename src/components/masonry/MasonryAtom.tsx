import React, { useState, useRef } from 'react';
import { Article } from '@/types';
import { MediaBlock } from './MediaBlock';
import { TextBlock } from './TextBlock';
import { ActionHUD } from './ActionHUD';
import { useMasonryInteraction } from '@/hooks/useMasonryInteraction';
import { CollectionPopover } from '@/components/CollectionPopover';
import { ReportModal, ReportPayload } from '@/components/ReportModal';
import { CreateNuggetModal } from '@/components/CreateNuggetModal';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { adminModerationService } from '@/admin/services/adminModerationService';
import { storageService } from '@/services/storageService';
import { useQueryClient } from '@tanstack/react-query';

interface MasonryAtomProps {
  article: Article;
  onArticleClick: (article: Article) => void;
  onCategoryClick?: (category: string) => void;
  currentUserId?: string;
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
export const MasonryAtom: React.FC<MasonryAtomProps> = ({
  article,
  onArticleClick,
  onCategoryClick,
  currentUserId,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();

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

  const hasMedia = !!(article.media || (article.images && article.images.length > 0));
  const isOwner = currentUserId && article.author ? currentUserId === article.author.id : false;
  const isAdmin = currentUser?.role === 'admin';

  // Handle more menu click outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    if (showMoreMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMoreMenu]);

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
        await queryClient.invalidateQueries({ queryKey: ['articles'] });
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
          {hasMedia ? (
            <MediaBlock
              article={article}
              onCategoryClick={onCategoryClick}
              onArticleClick={onArticleClick}
            />
          ) : (
            <TextBlock
              article={article}
              onCategoryClick={onCategoryClick}
            />
          )}

          {/* Hover-triggered Action HUD */}
          {isHovered && (
            <ActionHUD
              article={article}
              onAddToCollection={(e) => {
                e.stopPropagation();
                if (e.currentTarget) {
                  setCollectionAnchor(e.currentTarget.getBoundingClientRect());
                  setShowCollectionPopover(true);
                }
              }}
              onMore={(e) => {
                e.stopPropagation();
                setShowMoreMenu(!showMoreMenu);
              }}
              showMoreMenu={showMoreMenu}
              moreMenuRef={moreMenuRef}
              isOwner={isOwner}
              isAdmin={isAdmin}
              onReport={() => setShowReportModal(true)}
              onEdit={() => setShowEditModal(true)}
              onDelete={handleDelete}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      <CollectionPopover
        isOpen={showCollectionPopover}
        onClose={() => setShowCollectionPopover(false)}
        articleId={article.id}
        mode="private"
        anchorRect={collectionAnchor}
      />
      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        onSubmit={handleReport}
        articleId={article.id}
      />
      {showEditModal && (
        <CreateNuggetModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          mode="edit"
          initialData={article}
        />
      )}
    </>
  );
};

