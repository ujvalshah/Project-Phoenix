import React, { useLayoutEffect, useMemo, useRef } from 'react';
import type { Article } from '@/types';
import { NewsCard } from '@/components/NewsCard';
import { CardSkeleton } from '@/components/card/CardSkeleton';
import { prepareArticleForNewsCard } from '@/utils/errorHandler';
import { getPriorityThumbnailCount } from '@/constants/aboveFoldPriority';
import { HOME_PHASE_SHARED_GRID_CLASS } from '@/pages/homePhaseLayoutContract';

const PHASE_A_CARD_LIMIT = 4;

export interface HomeCriticalAboveFoldPhaseAProps {
  articles: Article[];
  isLoading: boolean;
  currentUserId?: string;
  onArticleClick: (article: Article) => void;
  onCategoryClick: (category: string) => void;
  onTagClick?: (tag: string) => void;
  onCardsMounted: (payload: {
    firstImageUrl: string | null;
    renderedCount: number;
    shellHeightPx: number | null;
  }) => void;
}

/**
 * Minimal above-the-fold home surface used by critical-path slimming experiment.
 * Renders a small fixed card set and reports first image URL after mount.
 */
export const HomeCriticalAboveFoldPhaseA: React.FC<HomeCriticalAboveFoldPhaseAProps> = ({
  articles,
  isLoading,
  currentUserId,
  onArticleClick,
  onCategoryClick,
  onTagClick,
  onCardsMounted,
}) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const mountedReportedRef = useRef(false);
  const priorityCount = getPriorityThumbnailCount(4);

  const phaseAArticles = useMemo(() => {
    const prepared: Article[] = [];
    for (const article of articles) {
      const normalized = prepareArticleForNewsCard(article);
      if (!normalized) continue;
      prepared.push(normalized);
      if (prepared.length >= PHASE_A_CARD_LIMIT) break;
    }
    return prepared;
  }, [articles]);

  useLayoutEffect(() => {
    if (mountedReportedRef.current) return;
    if (phaseAArticles.length === 0) return;
    mountedReportedRef.current = true;
    requestAnimationFrame(() => {
      const firstImage = rootRef.current?.querySelector('img');
      const firstImageUrl =
        firstImage?.getAttribute('src') ??
        (firstImage instanceof HTMLImageElement ? firstImage.currentSrc : null);
      onCardsMounted({
        firstImageUrl: firstImageUrl ?? null,
        renderedCount: phaseAArticles.length,
        shellHeightPx: rootRef.current
          ? Math.round(rootRef.current.getBoundingClientRect().height)
          : null,
      });
    });
  }, [onCardsMounted, phaseAArticles.length]);

  if (isLoading && phaseAArticles.length === 0) {
    return (
      <div className={HOME_PHASE_SHARED_GRID_CLASS}>
        {[1, 2, 3, 4].map((i) => (
          <CardSkeleton key={i} variant="grid" />
        ))}
      </div>
    );
  }

  if (phaseAArticles.length === 0) {
    return null;
  }

  return (
    <div ref={rootRef} className={HOME_PHASE_SHARED_GRID_CLASS}>
      {phaseAArticles.map((article, idx) => (
        <div key={article.id} data-home-phase-a-card-index={idx}>
          <NewsCard
            article={article}
            skipArticlePrepare
            viewMode="grid"
            onCategoryClick={onCategoryClick}
            onTagClick={onTagClick}
            onClick={onArticleClick}
            currentUserId={currentUserId}
            disableInlineExpansion
            priorityThumbnail={idx < priorityCount}
          />
        </div>
      ))}
    </div>
  );
};

