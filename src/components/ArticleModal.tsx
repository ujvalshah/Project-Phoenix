import React, { useEffect, useState } from 'react';
import { Article } from '@/types';
import { ArticleDetail } from './ArticleDetail';
import { ModalShell } from '@/components/UI/ModalShell';

interface ArticleModalProps {
  isOpen: boolean;
  onClose: () => void;
  article: Article;
  onYouTubeTimestampClick?: (videoId: string, timestamp: number, originalUrl: string) => void;
}

export const ArticleModal: React.FC<ArticleModalProps> = ({ 
  isOpen, 
  onClose, 
  article: initialArticle,
  onYouTubeTimestampClick,
}) => {
  const [article, setArticle] = useState(initialArticle);

  useEffect(() => {
    setArticle(initialArticle);
  }, [initialArticle]);

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} align="end">
      {/* Drawer Container - Right Aligned, Full Height
          Width: Full width on mobile, 50% on desktop with max constraint for optimal reading */}
      <div
        role="dialog"
        aria-modal="true"
        className="
          relative w-full md:w-1/2 max-w-[1000px] h-full
          bg-white dark:bg-slate-950 shadow-2xl
          flex flex-col border-l border-slate-200 dark:border-slate-800
          animate-in slide-in-from-right duration-300 ease-out
        "
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-950 relative h-full">
          <ArticleDetail
            article={article}
            isModal={true}
            onClose={onClose}
            onYouTubeTimestampClick={onYouTubeTimestampClick}
          />
        </div>
      </div>
    </ModalShell>
  );
};


