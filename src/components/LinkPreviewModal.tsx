import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ExternalLink, Globe, Lock, AlertCircle } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

interface LinkPreviewModalProps {
  isOpen: boolean;
  onClose: (e?: React.MouseEvent) => void;
  url: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  domain?: string;
}

/**
 * LinkPreviewModal: Progressive disclosure for external links
 * 
 * Shows a preview modal with link metadata before opening external URL.
 * Provides "Open Link" and "Open in New Tab" options.
 * 
 * Mobile-optimized with swipe-down to dismiss.
 */
export const LinkPreviewModal: React.FC<LinkPreviewModalProps> = ({
  isOpen,
  onClose,
  url,
  title,
  description,
  imageUrl,
  domain,
}) => {
  const [isClosing, setIsClosing] = useState(false);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  // Extract domain from URL if not provided
  const displayDomain = domain || (url ? new URL(url).hostname.replace('www.', '') : '');
  
  // Check if URL is secure (HTTPS)
  const isSecure = url.startsWith('https://');

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setIsClosing(false);
      setDragOffset(0);
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Keyboard handler
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleClose = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsClosing(true);
    setTimeout(() => {
      onClose(e);
      setIsClosing(false);
    }, 200);
  };

  const handleOpenLink = (e: React.MouseEvent, newTab = false) => {
    e.stopPropagation();
    if (newTab) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      window.location.href = url;
    }
    handleClose(e);
  };

  // Swipe down to dismiss (mobile)
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartY(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY === null) return;
    
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartY;
    
    // Only allow downward swipe
    if (deltaY > 0) {
      setDragOffset(deltaY);
    }
  };

  const handleTouchEnd = () => {
    if (dragOffset > 100) {
      // Swipe down threshold met - close modal
      handleClose();
    }
    setTouchStartY(null);
    setDragOffset(0);
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className={twMerge(
        'fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center',
        'animate-in fade-in duration-200',
        isClosing && 'animate-out fade-out duration-200'
      )}
      onClick={handleClose}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className={twMerge(
          'bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-2xl',
          'w-full sm:max-w-md max-h-[90vh] overflow-hidden',
          'flex flex-col',
          'transform transition-transform duration-200',
          dragOffset > 0 && `translate-y-[${dragOffset}px]`
        )}
        style={{
          transform: dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              External Link
            </span>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close preview"
          >
            <X size={20} className="text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Preview Image */}
          {imageUrl && (
            <div className="mb-4 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800">
              <img
                src={imageUrl}
                alt={title || 'Link preview'}
                className="w-full h-48 object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}

          {/* Title */}
          {title && (
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
              {title}
            </h3>
          )}

          {/* Description */}
          {description && (
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 line-clamp-3">
              {description}
            </p>
          )}

          {/* Domain & Security Info */}
          <div className="flex items-center gap-2 mb-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
            {isSecure ? (
              <Lock className="w-4 h-4 text-green-600 dark:text-green-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            )}
            <span className="text-xs text-slate-600 dark:text-slate-400">
              {isSecure ? 'Secure connection' : 'Not secure'}
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500">•</span>
            <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
              {displayDomain}
            </span>
          </div>

          {/* URL Preview */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg mb-4">
            <p className="text-xs text-slate-500 dark:text-slate-400 break-all">
              {url}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row gap-2">
          <button
            onClick={(e) => handleOpenLink(e, true)}
            className="flex-1 px-4 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 min-h-[44px] flex items-center justify-center gap-2"
          >
            <ExternalLink size={18} />
            <span>Open in New Tab</span>
          </button>
          <button
            onClick={(e) => handleOpenLink(e, false)}
            className="flex-1 px-4 py-3 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-slate-100 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 min-h-[44px]"
          >
            Open Link
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
