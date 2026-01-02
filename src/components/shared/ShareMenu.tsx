import React from 'react';
import { Share2 } from 'lucide-react';

interface ShareItemData {
  type: 'nugget' | 'collection';
  id: string;
  title?: string;
  shareUrl: string;
}

interface ShareMenuProps {
  data: ShareItemData;
  meta?: { text?: string; author?: string };
  className?: string;
  iconSize?: number;
}

export const ShareMenu: React.FC<ShareMenuProps> = ({ 
  data, 
  className = '',
  iconSize = 14
}) => {
  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Perform share action only - never open drawer
    if (navigator.share) {
      try {
        await navigator.share({
          title: data.title || '',
          url: data.shareUrl
        });
      } catch (e) {
        // User cancelled
      }
    } else {
      navigator.clipboard.writeText(data.shareUrl);
    }
  };

  return (
    <button 
      onClick={handleShare} 
      className={`w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-all hover:scale-105 active:scale-95 ${className}`}
      title="Share"
    >
      <Share2 size={iconSize || 18} strokeWidth={1.5} />
    </button>
  );
};


