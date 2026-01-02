/**
 * DocumentPreview Component
 * 
 * Displays document cards with icon, metadata, and click-to-open behavior.
 * Follows global UX best practices for document handling.
 * 
 * Philosophy: Documents are decision surfaces, not consumption surfaces.
 * - No iframe embedding
 * - Click opens original URL (external)
 * - Icon-based preview (fast, reliable)
 * - Optional thumbnail for PDFs (future enhancement)
 */

import React from 'react';
import { FileText, File, Download, ExternalLink } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

export type DocumentType = 'pdf' | 'doc' | 'docx' | 'xls' | 'xlsx' | 'ppt' | 'pptx' | 'txt' | 'zip';

interface DocumentPreviewProps {
  url: string;
  filename: string;
  fileSize?: string;
  fileType: DocumentType;
  thumbnailUrl?: string; // Optional: first page thumbnail for PDFs
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  showDownloadButton?: boolean;
}

// Icon background colors by document type (light backgrounds with colored icons)
const getIconBackgroundClass = (type: DocumentType): string => {
  const backgrounds: Record<DocumentType, string> = {
    pdf: 'bg-red-100 dark:bg-red-900/30',      // Red theme for PDF
    doc: 'bg-blue-100 dark:bg-blue-900/30',    // Blue theme for Word
    docx: 'bg-blue-100 dark:bg-blue-900/30',
    xls: 'bg-green-100 dark:bg-green-900/30', // Green theme for Excel
    xlsx: 'bg-green-100 dark:bg-green-900/30',
    ppt: 'bg-orange-100 dark:bg-orange-900/30', // Orange theme for PowerPoint
    pptx: 'bg-orange-100 dark:bg-orange-900/30',
    txt: 'bg-slate-100 dark:bg-slate-800',     // Gray theme for text
    zip: 'bg-purple-100 dark:bg-purple-900/30', // Purple theme for archives
  };
  return backgrounds[type] || 'bg-slate-100 dark:bg-slate-800';
};

const getIconColorClass = (type: DocumentType): string => {
  const colors: Record<DocumentType, string> = {
    pdf: 'text-red-600 dark:text-red-400',
    doc: 'text-blue-600 dark:text-blue-400',
    docx: 'text-blue-600 dark:text-blue-400',
    xls: 'text-green-600 dark:text-green-400',
    xlsx: 'text-green-600 dark:text-green-400',
    ppt: 'text-orange-600 dark:text-orange-400',
    pptx: 'text-orange-600 dark:text-orange-400',
    txt: 'text-slate-600 dark:text-slate-400',
    zip: 'text-purple-600 dark:text-purple-400',
  };
  return colors[type] || 'text-slate-600 dark:text-slate-400';
};

// Icon components by document type
const getDocumentIcon = (type: DocumentType, size: number = 48, useColoredIcon: boolean = false) => {
  // For compact horizontal layout, use colored icons on light backgrounds
  // For larger icons (thumbnails), use colored icons
  const iconColorClass = useColoredIcon ? getIconColorClass(type) : '';
  
  // Use FileText for most types, File for archives
  if (type === 'zip') {
    return <File size={size} className={iconColorClass} />;
  }
  
  return <FileText size={size} className={iconColorClass} />;
};

// Format file size
function formatFileSize(bytes?: string | number): string {
  if (!bytes) return '';
  
  const numBytes = typeof bytes === 'string' ? parseFloat(bytes) : bytes;
  if (isNaN(numBytes)) return '';
  
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = numBytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

// Get file type label
function getFileTypeLabel(type: DocumentType): string {
  const labels: Record<DocumentType, string> = {
    pdf: 'PDF',
    doc: 'DOC',
    docx: 'DOCX',
    xls: 'XLS',
    xlsx: 'XLSX',
    ppt: 'PPT',
    pptx: 'PPTX',
    txt: 'TXT',
    zip: 'ZIP',
  };
  
  return labels[type] || type.toUpperCase();
}

// Truncate filename if too long
function truncateFilename(filename: string, maxLength: number = 30): string {
  if (filename.length <= maxLength) return filename;
  const extension = filename.split('.').pop();
  const nameWithoutExt = filename.slice(0, filename.lastIndexOf('.'));
  const truncated = nameWithoutExt.slice(0, maxLength - extension!.length - 4);
  return `${truncated}...${extension}`;
}

export const DocumentPreview: React.FC<DocumentPreviewProps> = ({
  url,
  filename,
  fileSize,
  fileType,
  thumbnailUrl,
  className,
  onClick,
  showDownloadButton = false,
}) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClick) {
      onClick(e);
    } else {
      // Default: open URL in new tab
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const displayFilename = truncateFilename(filename);
  const displaySize = formatFileSize(fileSize);
  const typeLabel = getFileTypeLabel(fileType);

  return (
    <div
      className={twMerge(
        'w-full rounded-xl overflow-hidden',
        // For documents without thumbnails, use fixed height instead of h-full to prevent stretching
        thumbnailUrl ? 'h-full' : 'h-16', // 64px fixed height for compact layout
        'bg-slate-50 dark:bg-slate-900/50',
        'border border-slate-200 dark:border-slate-700',
        'relative group cursor-pointer',
        'transition-all duration-200',
        'hover:bg-slate-100 dark:hover:bg-slate-800',
        'hover:border-slate-300 dark:hover:border-slate-600',
        className
      )}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={`${typeLabel} document: ${filename}. Click to open.`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick(e as any);
        }
      }}
    >
      {/* Priority 1: Thumbnail when available (show prominently) */}
      {thumbnailUrl ? (
        <>
          {/* Thumbnail as primary visual */}
          <div className="absolute inset-0">
            <img
              src={thumbnailUrl}
              alt={displayFilename}
              className="w-full h-full object-cover"
              aria-hidden="false"
            />
          </div>
          
          {/* Overlay gradient for readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          
          {/* File type badge overlay (top-right) */}
          <div className="absolute top-3 right-3 px-2 py-1 rounded-lg bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm flex items-center gap-1.5 shadow-sm">
            {getDocumentIcon(fileType, 16)}
            <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">{typeLabel}</span>
          </div>
          
          {/* Filename and metadata overlay (bottom) */}
          <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
            <p className="text-sm font-semibold line-clamp-2 break-words mb-1">
              {displayFilename}
            </p>
            {displaySize && (
              <p className="text-xs text-white/80">
                {displaySize}
              </p>
            )}
          </div>
          
          {/* Hover indicator */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-1 text-xs text-white font-medium bg-black/60 px-2 py-1 rounded-lg backdrop-blur-sm">
              <ExternalLink size={12} />
              <span>Open</span>
            </div>
          </div>
        </>
      ) : (
        /* Priority 2: Compact horizontal icon-based fallback */
        <div className="relative h-full flex items-center gap-3 p-3">
          {/* Document Icon - Small, on left */}
          <div className="flex-shrink-0">
            <div className={twMerge(
              'w-10 h-10 rounded-lg flex items-center justify-center',
              getIconBackgroundClass(fileType)
            )}>
              {getDocumentIcon(fileType, 20, true)}
            </div>
          </div>

          {/* Filename and metadata - Center, flex-1 */}
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold text-slate-900 dark:text-slate-200 truncate group-hover:text-primary-500 dark:group-hover:text-primary-400 transition-colors">
              {displayFilename}
            </p>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {displaySize && (
                <>
                  <span>{displaySize}</span>
                  <span>·</span>
                </>
              )}
              <span className="font-medium uppercase">{typeLabel}</span>
            </div>
          </div>

          {/* Download icon - Right (always visible in compact layout) */}
          <button
            onClick={handleDownload}
            className="flex-shrink-0 p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            aria-label={`Download ${filename}`}
            title="Download"
          >
            <Download size={18} className="text-slate-400 group-hover:text-primary-500 dark:group-hover:text-primary-400 transition-colors" />
          </button>
        </div>
      )}

      {/* Optional download button */}
      {showDownloadButton && (
        <button
          onClick={handleDownload}
          className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white dark:hover:bg-slate-800"
          aria-label={`Download ${filename}`}
          title="Download"
        >
          <Download size={14} className="text-slate-600 dark:text-slate-400" />
        </button>
      )}
    </div>
  );
};

