/**
 * BatchPreviewCard Component
 * 
 * Renders a preview card for a batch upload item using the existing NewsCard architecture.
 * This ensures consistency with the feed and respects all existing card rendering logic.
 * 
 * Philosophy: Every card is a decision surface, not a consumption surface.
 * Uses NewsCard directly - no special batch-only cards.
 */

import React from 'react';
import { BatchRow } from '@/types/batch';
import { NewsCard } from '@/components/NewsCard';
import { Article } from '@/types';
import { X, RefreshCw, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

import { LayoutMode } from '@/components/admin/LayoutPreviewToggle';

interface BatchPreviewCardProps {
  row: BatchRow;
  layoutMode?: LayoutMode;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  onUpdate: (id: string, updates: Partial<BatchRow>) => void;
}

/**
 * Create a fallback Article from BatchRow for preview
 * Used when metadata fetch hasn't completed or failed
 */
function createFallbackArticle(row: BatchRow, currentUserId: string, authorName: string): Article {
  const content = row.content || row.url;
  const excerpt = content.substring(0, 150) + (content.length > 150 ? '...' : '');
  const wordCount = content.trim().split(/\s+/).length;
  const readTime = Math.max(1, Math.ceil(wordCount / 200));
  
  let siteName = 'unknown';
  try {
    siteName = new URL(row.url).hostname.replace('www.', '');
  } catch {
    // URL parsing failed
  }
  
  return {
    id: row.id,
    title: row.title || undefined,
    excerpt,
    content,
    author: {
      id: currentUserId,
      name: authorName,
    },
    publishedAt: new Date().toISOString(),
    categories: row.categories,
    tags: row.categories.filter((cat): cat is string => typeof cat === 'string' && cat.trim().length > 0),
    readTime,
    visibility: row.visibility,
    source_type: 'link',
    media: {
      type: 'link',
      url: row.url,
      previewMetadata: {
        url: row.url,
        title: row.title || 'Content Preview',
        siteName,
      },
    },
  };
}

export const BatchPreviewCard: React.FC<BatchPreviewCardProps> = ({
  row,
  layoutMode = 'grid',
  onRemove,
  onRetry,
  onUpdate,
}) => {
  const { currentUserId, currentUser } = useAuth();
  const authorName = currentUser?.name || 'User';
  
  // Use preview article if available, otherwise create fallback
  const previewArticle: Article = row.previewArticle || createFallbackArticle(
    row,
    currentUserId || 'temp',
    authorName
  );
  
  // Handle card click - open URL in new tab
  const handleCardClick = () => {
    window.open(row.url, '_blank', 'noopener,noreferrer');
  };
  
  // Handle category/tag click (no-op for batch preview)
  const handleCategoryClick = () => {};
  const handleTagClick = () => {};
  
  return (
    <div className="relative group">
      {/* Status overlay */}
      {row.status === 'fetching' && (
        <div className="absolute top-2 right-2 z-10 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-lg p-2 shadow-lg">
          <Loader2 size={16} className="text-blue-500 animate-spin" />
        </div>
      )}
      
      {row.status === 'error' && (
        <div className="absolute top-2 right-2 z-10 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-lg p-2 shadow-lg flex items-center gap-2">
          <AlertCircle size={16} className="text-red-500" />
          {row.errorMessage && (
            <span className="text-xs text-red-600 dark:text-red-400 max-w-[200px] truncate">
              {row.errorMessage}
            </span>
          )}
        </div>
      )}
      
      {row.status === 'success' && (
        <div className="absolute top-2 right-2 z-10 bg-green-500/90 backdrop-blur-sm rounded-lg px-2 py-1 shadow-lg">
          <span className="text-xs font-bold text-white">Saved</span>
        </div>
      )}
      
      {/* Card wrapper with controls */}
      <div className="relative">
        {/* Selection checkbox */}
        <div className="absolute top-2 left-2 z-10">
          <input
            type="checkbox"
            checked={row.selected}
            onChange={(e) => onUpdate(row.id, { selected: e.target.checked })}
            disabled={row.status === 'success'}
            className="w-5 h-5 rounded border-slate-300 dark:border-slate-600 focus:ring-primary-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
        
        {/* Action buttons */}
        <div className="absolute top-2 right-2 z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {row.status === 'error' && (
            <button
              onClick={() => onRetry(row.id)}
              className="p-1.5 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-lg shadow-lg hover:bg-white dark:hover:bg-slate-800 transition-colors"
              title="Retry metadata fetch"
            >
              <RefreshCw size={14} className="text-blue-500" />
            </button>
          )}
          <button
            onClick={() => onRemove(row.id)}
            className="p-1.5 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-lg shadow-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            title="Remove from batch"
          >
            <X size={14} className="text-red-500" />
          </button>
        </div>
        
        {/* Render NewsCard with layoutMode-based styling */}
        <div 
          className={`
            ${row.selected ? '' : 'opacity-50'}
            ${
              layoutMode === 'utility'
                ? 'min-h-[400px]'
                : layoutMode === 'feed'
                ? 'max-w-2xl mx-auto'
                : ''
            }
          `}
        >
          <NewsCard
            article={previewArticle}
            viewMode={layoutMode}
            onCategoryClick={handleCategoryClick}
            onClick={handleCardClick}
            currentUserId={currentUserId}
            onTagClick={handleTagClick}
            isPreview={true}
          />
        </div>
      </div>
    </div>
  );
};
