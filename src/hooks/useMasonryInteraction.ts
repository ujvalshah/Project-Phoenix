import { useState, useCallback } from 'react';
import { Article } from '@/types';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/hooks/useAuth';
import { storageService } from '@/services/storageService';
import { useQueryClient } from '@tanstack/react-query';

interface UseMasonryInteractionProps {
  article: Article;
  onArticleClick: (article: Article) => void;
  currentUserId?: string;
}

/**
 * useMasonryInteraction: Handles all interaction logic for Masonry items
 * 
 * Responsibilities:
 * - Click handling (opens detail page)
 * - Action handling (bookmark, collection, report, etc.)
 * - Modal state management
 * - Event propagation control
 */
export const useMasonryInteraction = ({
  article,
  onArticleClick,
  currentUserId,
}: UseMasonryInteractionProps) => {
  const toast = useToast();
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();

  const [showCollectionPopover, setShowCollectionPopover] = useState(false);
  const [collectionAnchor, setCollectionAnchor] = useState<DOMRect | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const handleClick = useCallback(() => {
    onArticleClick(article);
  }, [article, onArticleClick]);

  const handleActionClick = useCallback(
    (e: React.MouseEvent, action: () => void) => {
      e.stopPropagation();
      action();
    },
    []
  );

  const handleAddToCollection = useCallback(
    (e: React.MouseEvent) => {
      handleActionClick(e, () => {
        if (e.currentTarget) {
          setCollectionAnchor(e.currentTarget.getBoundingClientRect());
          setShowCollectionPopover(true);
        }
      });
    },
    [handleActionClick]
  );

  const handleReport = useCallback(async () => {
    // Report logic can be added here
    setShowReportModal(true);
  }, []);

  const handleEdit = useCallback(() => {
    setShowEditModal(true);
  }, []);

  const handleDelete = useCallback(async () => {
    if (window.confirm('Delete this nugget permanently?')) {
      try {
        await storageService.deleteArticle(article.id);
        await queryClient.invalidateQueries({ queryKey: ['articles'] });
        toast.success('Nugget deleted');
      } catch (error) {
        toast.error('Failed to delete nugget');
      }
    }
  }, [article.id, queryClient, toast]);

  const handleToggleVisibility = useCallback(async () => {
    try {
      const newVisibility = article.visibility === 'private' ? 'public' : 'private';
      await storageService.updateArticle(article.id, {
        visibility: newVisibility,
      });
      await queryClient.invalidateQueries({ queryKey: ['articles'] });
      toast.success(`Made ${newVisibility}`);
    } catch (error) {
      toast.error('Failed to update visibility');
    }
  }, [article.id, article.visibility, queryClient, toast]);

  return {
    handleClick,
    handleActionClick,
    handleAddToCollection,
    handleReport,
    handleEdit,
    handleDelete,
    handleToggleVisibility,
    showCollectionPopover,
    setShowCollectionPopover,
    collectionAnchor,
    setCollectionAnchor,
    showReportModal,
    setShowReportModal,
    showEditModal,
    setShowEditModal,
  };
};









