import React from 'react';
import { Article } from '@/types';
import { EmbeddedMedia } from '@/components/embeds/EmbeddedMedia';
import { Image } from '@/components/Image';
import { ExternalLink, Lock } from 'lucide-react';

interface NewsCardMediaProps {
  article: Article;
  onClick: (e: React.MouseEvent) => void;
}

export const NewsCardMedia: React.FC<NewsCardMediaProps> = ({ article, onClick }) => {
  return (
    <div 
        className="w-full aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 relative shrink-0 cursor-pointer group/media"
        onClick={onClick}
    >
        {article.media ? (
            <EmbeddedMedia media={article.media} onClick={onClick} />
        ) : (
            article.images && article.images.length > 0 && (
                <Image src={article.images[0]} className="w-full h-full object-cover transition-transform duration-500 group-hover/media:scale-105" />
            )
        )}
        
        <div className="absolute top-2 left-2 flex gap-1">
            {article.source_type === 'link' && (
                <div className="bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wide flex items-center gap-1 transition-transform group-hover/media:scale-105">
                    <ExternalLink size={8} /> Link
                </div>
            )}
            {article.visibility === 'private' && (
                <div className="bg-black/60 backdrop-blur-sm text-white p-1 rounded-full">
                    <Lock size={10} />
                </div>
            )}
        </div>
    </div>
  );
};


