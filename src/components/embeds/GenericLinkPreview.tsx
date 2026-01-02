import React from 'react';
import { ExternalLink } from 'lucide-react';
import { PreviewMetadata, MediaType } from '@/types';

interface GenericLinkPreviewProps {
  url: string;
  metadata?: PreviewMetadata;
  type?: MediaType;
}

export const GenericLinkPreview: React.FC<GenericLinkPreviewProps> = ({ 
  url, 
  metadata,
  type = 'link'
}) => {
  // CRITICAL FIX: Handle image URLs directly
  // Image URLs skip metadata fetching, so we use the URL itself as the image source
  const isImage = type === 'image';
  const imageUrl = isImage ? url : metadata?.imageUrl;
  
  // For images, render the image directly without requiring metadata
  if (isImage && imageUrl) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary-500 transition-colors overflow-hidden"
      >
        <img 
          src={imageUrl} 
          alt={metadata?.title || 'Image preview'} 
          className="w-full h-auto max-h-[400px] object-contain"
        />
        {/* Only show title if user explicitly provided one (not auto-generated) */}
        {metadata?.title && metadata.title !== url && (
          <div className="p-3 border-t border-slate-200 dark:border-slate-700">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
              {metadata.title}
            </h4>
          </div>
        )}
      </a>
    );
  }
  
  // Standard link preview (non-image)
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary-500 transition-colors"
    >
      {imageUrl && (
        <img 
          src={imageUrl} 
          alt={metadata?.title || ''} 
          className="w-full h-32 object-cover rounded-lg mb-3"
        />
      )}
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate mb-1">
            {metadata?.title || url}
          </h4>
          {metadata?.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
              {metadata.description}
            </p>
          )}
          <div className="flex items-center gap-1 mt-2 text-xs text-slate-400">
            {metadata?.siteName && <span>{metadata.siteName}</span>}
            <ExternalLink size={12} />
          </div>
        </div>
      </div>
    </a>
  );
};


