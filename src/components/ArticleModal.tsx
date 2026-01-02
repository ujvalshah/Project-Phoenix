import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Article } from '@/types';
import { ArticleDetail } from './ArticleDetail';

interface ArticleModalProps {
  isOpen: boolean;
  onClose: () => void;
  article: Article;
}

export const ArticleModal: React.FC<ArticleModalProps> = ({ 
  isOpen, 
  onClose, 
  article: initialArticle
}) => {
  const [article, setArticle] = useState(initialArticle);

  useEffect(() => {
    setArticle(initialArticle);
  }, [initialArticle]);

  // Lock body scroll when drawer is open - ensures all scrolling happens inside drawer only
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[60] flex justify-end isolation-auto"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Drawer Container - Right Aligned, Full Height
          Width: 50% on desktop with min/max constraints for optimal reading
          Mobile uses inline expansion, so drawer is tablet/desktop only */}
      <div 
        className="
          relative w-full md:w-1/2 min-w-[600px] max-w-[1000px] h-full 
          bg-white dark:bg-slate-950 shadow-2xl 
          flex flex-col border-l border-slate-200 dark:border-slate-800
          animate-in slide-in-from-right duration-300 ease-out
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* Scroll Container - Internal scroll only, body scroll locked above
            Layout: flex-1 ensures container takes available height, overflow-y-auto enables scrolling */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-950 relative h-full">
            <ArticleDetail 
              article={article} 
              isModal={true} 
              onClose={onClose}
            />
        </div>
      </div>
    </div>,
    document.body
  );
};


