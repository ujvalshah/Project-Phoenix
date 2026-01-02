/**
 * ============================================================================
 * FEED LAYOUT PAGE: Workspace Layout with Nested Routing
 * ============================================================================
 * 
 * This page component wraps the feed and detail views in ResponsiveLayoutShell.
 * It manages nested routing so feed stays mounted while detail opens.
 * 
 * ============================================================================
 */

import React, { useMemo } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { ResponsiveLayoutShell } from '@/components/layouts/ResponsiveLayoutShell';
import { Feed } from '@/components/Feed';
import { useAuth } from '@/hooks/useAuth';

interface FeedLayoutPageProps {
  searchQuery?: string;
  sortOrder?: 'latest' | 'oldest' | 'title';
  selectedTag?: string | null;
  activeCategory?: string;
  onCategoryClick?: (category: string) => void;
  onTagClick?: (tag: string) => void;
}

export const FeedLayoutPage: React.FC<FeedLayoutPageProps> = ({
  searchQuery = '',
  sortOrder = 'latest',
  selectedTag = null,
  activeCategory = 'All',
  onCategoryClick,
  onTagClick,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUserId } = useAuth();

  // Log feed layout mount for debugging
  React.useEffect(() => {
    // eslint-disable-next-line no-console
    console.info('[FeedLayoutPage] Mounted, location:', location.pathname);
  }, [location.pathname]);

  // Check if we're on a detail route by checking the pathname
  const isDetailActive = location.pathname.startsWith('/feed/') && location.pathname !== '/feed';

  // Render sidebar content (empty for now, can be populated later)
  const sidebarContent = useMemo(() => {
    return null; // Sidebar can be added here if needed
  }, []);

  // Render feed content - always mounted
  const feedContent = useMemo(() => {
    return (
      <Feed
        activeCategory={activeCategory}
        searchQuery={searchQuery}
        sortOrder={sortOrder}
        selectedTag={selectedTag}
        onCategoryClick={onCategoryClick}
        onTagClick={onTagClick}
        currentUserId={currentUserId}
        onArticleClick={(article) => {
          navigate(`/feed/${article.id}`);
        }}
      />
    );
  }, [activeCategory, searchQuery, sortOrder, selectedTag, onCategoryClick, onTagClick, currentUserId, navigate]);

  // Render detail content via Outlet (only renders on desktop in right panel)
  // On tablet/mobile, detail opens as overlay (handled separately if needed)
  const detailContent = isDetailActive ? <Outlet /> : null;

  return (
    <ResponsiveLayoutShell
      sidebar={sidebarContent}
      feed={feedContent}
      detail={detailContent}
    />
  );
};

// Export both named and default for compatibility
export default FeedLayoutPage;
