/**
 * ============================================================================
 * DETAIL HEADER: Sticky Top Header for Detail View
 * ============================================================================
 * 
 * FEATURES:
 * - Sticky positioning
 * - Close button
 * - Zoom controls
 * - Backdrop blur polish
 * 
 * ============================================================================
 */

import React from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

export interface DetailHeaderProps {
  /** Article title */
  title: string;
  /** Close handler */
  onClose: () => void;
  /** Current zoom level */
  zoom: number;
  /** Zoom in handler */
  onZoomIn: () => void;
  /** Zoom out handler */
  onZoomOut: () => void;
  /** Reset zoom handler */
  onReset: () => void;
}

export const DetailHeader: React.FC<DetailHeaderProps> = ({
  title,
  onClose,
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
}) => {
  return (
    <div
      className={twMerge(
        'sticky top-0 z-20',
        'flex items-center justify-between',
        'px-4 py-3',
        'bg-white/80 dark:bg-slate-950/80',
        'backdrop-blur-lg',
        'border-b border-slate-200 dark:border-slate-800'
      )}
    >
      {/* Title */}
      <h2
        id="detail-view-title"
        className={twMerge(
          'text-base font-semibold',
          'text-slate-900 dark:text-white',
          'truncate flex-1 mr-4'
        )}
      >
        {title}
      </h2>
      
      {/* Zoom Controls */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onZoomOut}
          disabled={zoom <= 1}
          className={twMerge(
            'p-2 rounded-lg',
            'text-slate-600 dark:text-slate-400',
            'hover:bg-slate-100 dark:hover:bg-slate-800',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-colors'
          )}
          aria-label="Zoom out"
        >
          <ZoomOut size={20} />
        </button>
        
        <span className="text-sm font-medium text-slate-600 dark:text-slate-400 min-w-[3rem] text-center">
          {Math.round(zoom * 100)}%
        </span>
        
        <button
          onClick={onZoomIn}
          disabled={zoom >= 4}
          className={twMerge(
            'p-2 rounded-lg',
            'text-slate-600 dark:text-slate-400',
            'hover:bg-slate-100 dark:hover:bg-slate-800',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-colors'
          )}
          aria-label="Zoom in"
        >
          <ZoomIn size={20} />
        </button>
        
        {zoom > 1 && (
          <button
            onClick={onReset}
            className={twMerge(
              'p-2 rounded-lg',
              'text-slate-600 dark:text-slate-400',
              'hover:bg-slate-100 dark:hover:bg-slate-800',
              'transition-colors'
            )}
            aria-label="Reset zoom"
          >
            <RotateCcw size={20} />
          </button>
        )}
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className={twMerge(
            'p-2 rounded-lg',
            'text-slate-600 dark:text-slate-400',
            'hover:bg-slate-100 dark:hover:bg-slate-800',
            'transition-colors',
            'ml-2'
          )}
          aria-label="Close detail view"
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
};




