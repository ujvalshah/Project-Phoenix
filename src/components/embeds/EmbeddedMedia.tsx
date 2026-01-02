import React from 'react';
import { NuggetMedia } from '@/types';
import { Image } from '@/components/Image';
import { DocumentPreview, DocumentType } from './DocumentPreview';
import { ExternalLink, Linkedin, Twitter } from 'lucide-react';

interface EmbeddedMediaProps {
  media: NuggetMedia;
  onClick?: (e: React.MouseEvent) => void;
}

// Map MediaType to DocumentType
function mapToDocumentType(type: string, filename?: string): DocumentType | null {
  const mapping: Record<string, DocumentType> = {
    'pdf': 'pdf',
    'doc': 'doc',
    'docx': 'docx',
    'xls': 'xls',
    'xlsx': 'xlsx',
    'ppt': 'ppt',
    'pptx': 'pptx',
    'txt': 'txt',
    'zip': 'zip',
  };
  
  // If type is directly mapped, return it
  const directMapping = mapping[type.toLowerCase()];
  if (directMapping) return directMapping;
  
  // If type is generic 'document', extract from filename
  if (type.toLowerCase() === 'document' && filename) {
    const extension = filename.split('.').pop()?.toLowerCase();
    if (extension && mapping[extension]) {
      return mapping[extension];
    }
    // Default to PDF for Google Drive documents if extension not found
    if (filename.toLowerCase().includes('.pdf') || filename.toLowerCase().endsWith('pdf')) {
      return 'pdf';
    }
  }
  
  return null;
}

// Extract filename from URL
function extractFilename(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split('/').pop() || 'Document';
    return decodeURIComponent(filename);
  } catch {
    // If URL parsing fails, try to extract from string
    const parts = url.split('/');
    return parts[parts.length - 1] || 'Document';
  }
}

export const EmbeddedMedia: React.FC<EmbeddedMediaProps> = ({ media, onClick }) => {
  const { url, type } = media;
  
  // Extract filename from URL or use title (needed for type detection)
  // For Google Drive, the title usually contains the filename with extension
  const filename = media.previewMetadata?.title || extractFilename(url);
  
  // Debug logging (remove in production)
  // Wrapped in try-catch to prevent browser extension message channel errors
  if (process.env.NODE_ENV === 'development') {
    try {
      console.log('[EmbeddedMedia]', { 
        type, 
        filename, 
        url: url.substring(0, 80), 
        hasPreviewMetadata: !!media.previewMetadata,
        previewTitle: media.previewMetadata?.title,
        previewImageUrl: media.previewMetadata?.imageUrl
      });
    } catch (error) {
      // Silently ignore console.log errors (can happen with browser extensions)
      // This prevents "message channel closed" errors from breaking the app
    }
  }
  
  // AGGRESSIVE DOCUMENT DETECTION: Check multiple signals
  const urlIsGoogleDrive = url.toLowerCase().includes('drive.google.com') || url.toLowerCase().includes('docs.google.com');
  const filenameHasExtension = filename.toLowerCase().match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|zip)$/i);
  const filenameContainsExtension = filename.toLowerCase().includes('.pdf') || 
                                     filename.toLowerCase().includes('.doc') || 
                                     filename.toLowerCase().includes('.xls') || 
                                     filename.toLowerCase().includes('.ppt');
  
  // If it's Google Drive OR filename suggests document, treat as document
  const shouldTreatAsDocument = urlIsGoogleDrive || filenameHasExtension || filenameContainsExtension || type === 'document';
  
  if (shouldTreatAsDocument) {
    // Try to get document type from existing mapping first
    let documentType = mapToDocumentType(type, filename);
    
    // If still no type, extract from filename
    if (!documentType) {
      const extension = filename.split('.').pop()?.toLowerCase();
      const extensionMapping: Record<string, DocumentType> = {
        'pdf': 'pdf',
        'doc': 'doc',
        'docx': 'docx',
        'xls': 'xls',
        'xlsx': 'xlsx',
        'ppt': 'ppt',
        'pptx': 'pptx',
        'txt': 'txt',
        'zip': 'zip',
      };
      documentType = extension ? (extensionMapping[extension] || 'pdf') : 'pdf';
    }
    
    // Default to PDF if we still can't determine (common for Google Drive)
    const finalDocumentType = documentType || 'pdf';
    
    const fileSize = media.previewMetadata?.description?.match(/(\d+\.?\d*\s*(KB|MB|GB))/i)?.[0];
    
    if (process.env.NODE_ENV === 'development') {
      try {
        console.log('[EmbeddedMedia] Rendering DocumentPreview', { finalDocumentType, filename, fileSize });
      } catch (error) {
        // Silently ignore console.log errors
      }
    }
    
    return (
      <DocumentPreview
        url={url}
        filename={filename}
        fileSize={fileSize}
        fileType={finalDocumentType}
        thumbnailUrl={media.previewMetadata?.imageUrl} // Optional PDF thumbnail
        onClick={onClick}
        showDownloadButton={true}
      />
    );
  }
  
  // Check if this is a LinkedIn or social media link (compact bar layout)
  const isLinkedIn = url.toLowerCase().includes('linkedin.com') || type === 'linkedin';
  const isTwitter = url.toLowerCase().includes('twitter.com') || url.toLowerCase().includes('x.com') || type === 'twitter';
  const isSocialMedia = isLinkedIn || isTwitter;
  
  // For social media links, ALWAYS render as compact horizontal bar (ignore images)
  if (isSocialMedia) {
    const platformName = isLinkedIn ? 'LinkedIn' : 'Twitter';
    const platformColor = isLinkedIn ? 'bg-blue-600' : 'bg-slate-900';
    const platformIcon = isLinkedIn ? (
      <Linkedin size={20} className="text-white" />
    ) : (
      <Twitter size={20} className="text-white" />
    );
    
    return (
      <div 
        className="w-full h-full flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer group"
        onClick={onClick}
      >
        {/* Platform Icon - Small, on left */}
        <div className="flex-shrink-0">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${platformColor}`}>
            {platformIcon}
          </div>
        </div>

        {/* Title and metadata - Center, flex-1 */}
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold text-slate-900 dark:text-slate-200 truncate group-hover:text-primary-500 dark:group-hover:text-primary-400 transition-colors">
            {media.previewMetadata?.title || 'Posted on ' + platformName}
          </p>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            <span className="font-medium uppercase">{platformName}</span>
          </div>
        </div>

        {/* External link icon - Right */}
        <div className="flex-shrink-0">
          <ExternalLink size={18} className="text-slate-400 group-hover:text-primary-500 dark:group-hover:text-primary-400 transition-colors" />
        </div>
      </div>
    );
  }

  // Use preview image if available, otherwise fall back to URL
  const imageUrl = media.previewMetadata?.imageUrl || (type === 'image' ? url : null);

  // If we have an image URL, render it
  if (imageUrl) {
    // For YouTube videos, use object-cover to fill container and remove background
    // For other media types, use object-cover for better visual presentation
    const objectFit = type === 'youtube' ? 'object-cover' : 'object-cover';
    const backgroundClass = type === 'youtube' 
      ? 'bg-transparent' 
      : 'bg-slate-100 dark:bg-slate-900';
    
    const isYouTube = type === 'youtube';
    // Use metadata title if available, otherwise fallback to "YouTube Video"
    const videoTitle = media.previewMetadata?.title?.trim() || 'YouTube Video';
    
    return (
      <div className={`w-full h-full relative overflow-hidden ${backgroundClass} rounded-xl`} onClick={onClick}>
        <Image 
          src={imageUrl} 
          alt={media.previewMetadata?.title || 'Preview'} 
          className={`w-full h-full ${objectFit} transition-transform duration-500 hover:scale-105 cursor-pointer`}
        />
        
        {/* YouTube logo and title overlay - always show for YouTube videos */}
        {isYouTube && (
          <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
            <div className="flex items-center gap-2">
              <img 
                src="https://www.youtube.com/favicon.ico" 
                alt="YouTube" 
                className="w-4 h-4 flex-shrink-0"
                onError={(e) => {
                  // Fallback if favicon fails to load
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <span className="text-xs font-medium text-white truncate">
                {videoTitle}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Default: render as link preview (no image)
  return (
    <div className="w-full h-full relative overflow-hidden bg-slate-100 dark:bg-slate-900 rounded-xl">
      <a 
        href={url} 
        target="_blank" 
        rel="noopener noreferrer"
        className="block w-full h-full p-4 text-slate-600 dark:text-slate-300 hover:text-primary-500"
      >
        {media.previewMetadata?.title || url}
      </a>
    </div>
  );
};


