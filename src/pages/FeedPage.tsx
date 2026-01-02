// Archived experimental layout variant — not used in routing

/**
 * ============================================================================
 * FEED PAGE: Modal-Route Feed with Scroll Persistence
 * ============================================================================
 * 
 * ARCHITECTURE:
 * - Route: /feed (list view) and /feed/:id (detail modal)
 * - FeedContainer remains mounted during route transitions
 * - DetailViewBottomSheet renders conditionally based on route
 * - Scroll state persists via FeedScrollStateContext
 * 
 * ROUTING PATTERN:
 * - /feed → FeedContainer only
 * - /feed/:id → FeedContainer + DetailViewBottomSheet (modal overlay)
 * - Both routes render FeedContainer (no unmount)
 * 
 * ============================================================================
 */

import React, { useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useInfiniteArticles } from '@/hooks/useInfiniteArticles';
import { FeedContainer } from '@/components/feed/FeedContainer';
import { DetailViewBottomSheet } from '@/components/feed/DetailViewBottomSheet';
import { useQuery } from '@tanstack/react-query';
import { articleService } from '@/services/articleService';
import { Article } from '@/types';
import { PageStack } from '@/components/layouts/PageStack';

export const FeedPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Determine if we came from feed (for back navigation)
  const fromFeed = (location.state as { fromFeed?: boolean })?.fromFeed ?? false;
  
  // Fetch articles using infinite query
  const {
    articles,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteArticles({
    searchQuery: '',
    activeCategory: 'All',
    sortOrder: 'latest',
    limit: 25,
  });
  
  // Fetch single article if detail route is active
  const { data: detailArticle } = useQuery<Article | undefined>({
    queryKey: ['article', id],
    queryFn: async () => {
      if (!id) return undefined;
      return articleService.getArticleById(id);
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
  
  // Handle detail view close
  const handleDetailClose = useCallback(() => {
    if (fromFeed) {
      // Navigate back if we came from feed
      navigate(-1);
    } else {
      // Navigate to feed if direct-linked
      navigate('/feed');
    }
  }, [navigate, fromFeed]);
  
  // Handle article actions (like, bookmark, share)
  const handleLike = useCallback((article: Article) => {
    // TODO: Implement like functionality
    console.log('Like article:', article.id);
  }, []);
  
  const handleBookmark = useCallback((article: Article) => {
    // TODO: Implement bookmark functionality
    console.log('Bookmark article:', article.id);
  }, []);
  
  const handleShare = useCallback((article: Article) => {
    // TODO: Implement share functionality
    console.log('Share article:', article.id);
  }, []);
  
  const isDetailOpen = !!id && !!detailArticle && detailArticle !== undefined;
  
  return (
    <PageStack>
      {/* Feed Container - Always rendered (remains mounted) */}
      <FeedContainer
        articles={articles}
        isLoading={isLoading}
        gap={16}
        overscan={3}
        onLike={handleLike}
        onBookmark={handleBookmark}
        onShare={handleShare}
      />
      
      {/* Detail View Bottom Sheet - Rendered conditionally based on route */}
      {isDetailOpen && detailArticle && (
        <DetailViewBottomSheet
          article={detailArticle}
          isOpen={isDetailOpen}
          onClose={handleDetailClose}
          onLike={handleLike}
          onBookmark={handleBookmark}
          onShare={handleShare}
        />
      )}
    </PageStack>
  );
};

