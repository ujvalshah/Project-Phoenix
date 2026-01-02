/**
 * ============================================================================
 * ARTICLE DETAIL PAGE: Route-Driven Article Detail View
 * ============================================================================
 * 
 * This page component reads the articleId from React Router params,
 * fetches the article, and renders ArticleDetail with proper loading
 * and error states.
 * 
 * ============================================================================
 */

import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { articleService } from '@/services/articleService';
import { ArticleDetail } from '@/components/ArticleDetail';
import { Loader2 } from 'lucide-react';

export const ArticleDetailPage: React.FC = () => {
  const { articleId } = useParams<{ articleId: string }>();
  const navigate = useNavigate();

  // Fetch article by ID
  const { data: article, isLoading, isError } = useQuery({
    queryKey: ['article', articleId],
    queryFn: async () => {
      if (!articleId) return undefined;
      return articleService.getArticleById(articleId);
    },
    enabled: !!articleId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Handle close - navigate back to feed
  const handleClose = () => {
    navigate('/feed', { replace: true });
  };

  // If articleId is missing, show fallback
  if (!articleId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 dark:text-slate-400 mb-4">Article ID is missing</p>
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            Back to Feed
          </button>
        </div>
      </div>
    );
  }

  // Show loading state
  // Note: No HeaderSpacer needed - parent ResponsiveLayoutShell handles header offset
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px]">
        <div className="text-center">
          <Loader2 className="animate-spin w-8 h-8 text-primary-500 mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400">Loading article...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (isError || !article) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px]">
        <div className="text-center">
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            {isError ? 'Failed to load article' : 'Article not found'}
          </p>
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            Back to Feed
          </button>
        </div>
      </div>
    );
  }

  // Render article detail (no HeaderSpacer - layout handles spacing)
  return (
    <ArticleDetail
      article={article}
      onClose={handleClose}
      isModal={false}
      constrainWidth={true}
    />
  );
};

