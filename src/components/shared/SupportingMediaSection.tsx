/**
 * ============================================================================
 * SUPPORTING MEDIA SECTION: Drawer-Only Media Rendering
 * ============================================================================
 * 
 * PURPOSE:
 * - Render supporting media in the article detail drawer
 * - Display images visually in a responsive grid
 * - Display videos and documents as a clean list
 * - NEVER render in cards or inline expansion
 * 
 * RENDERING RULES:
 * - Images: Visual grid (1 col, 2 col, or 2x2 depending on count)
 * - Videos: List with thumbnail, title, and click to open
 * - Documents: List with icon, filename, and click to open
 * 
 * LAYOUT:
 * - Section title: "Sources & Attachments"
 * - Images grid first
 * - Videos/Documents list below
 * 
 * ============================================================================
 */

import React, { useState } from 'react';
import { SupportingMediaItem, MediaType } from '@/types';
import { Image } from '@/components/Image';
import { FileText, Film, ExternalLink, Youtube } from 'lucide-react';
import { ImageCarouselModal } from './ImageCarouselModal';

interface SupportingMediaSectionProps {
  supportingMedia: SupportingMediaItem[];
  className?: string;
}

/**
 * Get icon for media type
 */
function getMediaIcon(type: MediaType) {
  switch (type) {
    case 'youtube':
    case 'video':
      return <Youtube size={16} className="text-red-500" />;
    case 'document':
    case 'pdf':
      return <FileText size={16} className="text-blue-500" />;
    default:
      return <ExternalLink size={16} className="text-slate-400" />;
  }
}

/**
 * Get display name for media item
 */
function getMediaDisplayName(item: SupportingMediaItem): string {
  if (item.title) return item.title;
  if (item.filename) return item.filename;
  
  // Extract filename from URL
  try {
    const url = new URL(item.url);
    const pathname = url.pathname;
    const parts = pathname.split('/');
    const filename = parts[parts.length - 1];
    if (filename) return decodeURIComponent(filename);
  } catch {
    // Ignore
  }
  
  // Fallback to type name
  return item.type.charAt(0).toUpperCase() + item.type.slice(1);
}

/**
 * Supporting Media Section Component
 */
export const SupportingMediaSection: React.FC<SupportingMediaSectionProps> = ({
  supportingMedia,
  className = '',
}) => {
  // Modal state for image carousel
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalImageIndex, setModalImageIndex] = useState(0);
  
  if (!supportingMedia || supportingMedia.length === 0) {
    return null;
  }
  
  // Separate images from other media types
  const images = supportingMedia.filter(item => item.type === 'image');
  const nonImages = supportingMedia.filter(item => item.type !== 'image');
  
  // Extract image URLs for carousel
  const imageUrls = images.map(img => img.url);
  
  // Handle image click - open carousel modal instead of new tab
  const handleImageClick = (index: number) => {
    setModalImageIndex(index);
    setIsModalOpen(true);
  };
  
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Section Header */}
      <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
        <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wide mb-3">
          Sources & Attachments
          <span className="ml-2 text-slate-400 dark:text-slate-500 font-normal">
            ({supportingMedia.length})
          </span>
        </h3>
      </div>
      
      {/* Images Grid */}
      {images.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Images ({images.length})
          </div>
          
          {/* Responsive Grid Layout
              - 1 image: single column (full width)
              - 2 images: 2-column grid
              - 3-4 images: 2x2 grid
              - >4 images: 2x2 grid + "View all" indicator
              
              IMAGE RENDERING CHANGES:
              - Changed from <a> to <button> (no new tab opening)
              - Changed from object-cover to object-contain (no cropping)
              - Added neutral background (bg-slate-100) for aspect ratio gaps
              - Click opens in-app carousel modal instead of new tab */}
          <div 
            className={`
              grid gap-2 
              ${images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}
            `}
          >
            {images.slice(0, 4).map((item, index) => (
              <button
                key={index}
                onClick={() => handleImageClick(index)}
                className="relative aspect-video bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden group cursor-pointer border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-all"
              >
                {/* Image with object-contain to preserve full visibility (no cropping) */}
                <div className="w-full h-full flex items-center justify-center">
                  <Image
                    src={item.url}
                    alt={item.title || `Supporting image ${index + 1}`}
                    className="max-w-full max-h-full w-auto h-auto object-contain transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                {/* Hover overlay - removed external link icon, replaced with zoom hint */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200 flex items-center justify-center">
                  <div className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 drop-shadow-lg text-xs font-medium bg-black/70 px-3 py-1.5 rounded-full backdrop-blur-sm">
                    Click to view
                  </div>
                </div>
              </button>
            ))}
            
            {/* "View all" indicator for >4 images */}
            {images.length > 4 && (
              <div className="aspect-video bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center border border-slate-200 dark:border-slate-700">
                <div className="text-center">
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    +{images.length - 4}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                    more images
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Videos & Documents List */}
      {nonImages.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Links & Documents ({nonImages.length})
          </div>
          
          <div className="space-y-2">
            {nonImages.map((item, index) => (
              <a
                key={index}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 transition-all group cursor-pointer"
              >
                {/* Icon */}
                <div className="flex-shrink-0">
                  {getMediaIcon(item.type)}
                </div>
                
                {/* Thumbnail (for videos) */}
                {item.thumbnail && (item.type === 'youtube' || item.type === 'video') && (
                  <div className="flex-shrink-0 w-16 h-12 bg-slate-100 dark:bg-slate-700 rounded overflow-hidden">
                    <Image
                      src={item.thumbnail}
                      alt={getMediaDisplayName(item)}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                
                {/* Title/Filename */}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-slate-900 dark:text-white truncate">
                    {getMediaDisplayName(item)}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {item.type === 'youtube' ? 'YouTube Video' : 
                     item.type === 'video' ? 'Video' :
                     item.type === 'document' ? 'Document' : 'Link'}
                  </div>
                </div>
                
                {/* External link icon */}
                <div className="flex-shrink-0">
                  <ExternalLink 
                    size={14} 
                    className="text-slate-400 group-hover:text-primary-500 transition-colors" 
                  />
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
      
      {/* Image Carousel Modal - replaces new-tab opening */}
      <ImageCarouselModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        images={imageUrls}
        initialIndex={modalImageIndex}
        titles={images.map(img => img.title || img.filename)}
      />
    </div>
  );
};

