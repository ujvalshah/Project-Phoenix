import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface ImageLightboxProps {
  isOpen: boolean;
  onClose: (e?: React.MouseEvent) => void;
  images: string[];
  initialIndex?: number;
  sidebarContent?: React.ReactNode;
}

export const ImageLightbox: React.FC<ImageLightboxProps> = ({ 
  isOpen, 
  onClose, 
  images, 
  initialIndex = 0,
  sidebarContent
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, initialIndex]);

  const handlePrev = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentIndex(prev => (prev === 0 ? images.length - 1 : prev - 1));
  }, [images.length]);

  const handleNext = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentIndex(prev => (prev === images.length - 1 ? 0 : prev + 1));
  }, [images.length]);

  // handleClose must be declared before use — avoid circular reference.
  // Stop event bubbling from image tiles so closing the carousel
  // does not trigger the masonry tile drawer click handler.
  const handleClose = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation?.();
    onClose(e);
  }, [onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        // Stop event bubbling from image tiles so closing the carousel
        // does not trigger the masonry tile drawer click handler.
        handleClose();
      }
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose, handlePrev, handleNext]);

  if (!isOpen) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex animate-in fade-in duration-200"
      onClick={handleClose}
    >
      {/* Image Area */}
      <div className="flex-1 relative flex items-center justify-center h-full overflow-hidden w-full">
          {/* Close Button */}
          <button 
            onClick={handleClose}
            className={`absolute top-4 ${sidebarContent ? 'left-4' : 'right-4'} p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors z-50`}
          >
            <X size={24} />
          </button>

          {/* Image Counter */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/70 font-medium z-50 bg-black/30 px-3 py-1 rounded-full backdrop-blur-md">
            {currentIndex + 1} / {images.length}
          </div>

          {/* Navigation Buttons */}
          {images.length > 1 && (
            <>
              <button 
                onClick={handlePrev}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors z-50"
              >
                <ChevronLeft size={32} />
              </button>
              <button 
                onClick={handleNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors z-50"
              >
                <ChevronRight size={32} />
              </button>
            </>
          )}

          {/* Main Image Container */}
          <div 
            className="w-full h-full flex items-center justify-center p-4 md:p-12"
            onClick={(e) => e.stopPropagation()}
          >
            <img 
              src={images[currentIndex]} 
              alt={`View ${currentIndex + 1}`} 
              className="max-w-full max-h-full object-contain shadow-2xl animate-in zoom-in-95 duration-200"
            />
          </div>
      </div>

      {/* Sidebar Area (Visible on Large Screens) */}
      {sidebarContent && (
        <div 
          className="hidden lg:block w-[400px] h-full shrink-0 shadow-2xl z-[101] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800"
          onClick={(e) => e.stopPropagation()} 
        >
           <div className="relative h-full overflow-y-auto custom-scrollbar">
              <div className="absolute top-2 right-2 z-20">
                 <button 
                   onClick={handleClose} 
                   className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                 >
                   <X size={20} />
                 </button>
              </div>
              {sidebarContent}
           </div>
        </div>
      )}
    </div>,
    document.body
  );
};


