import React from 'react';
import { X, Check, Star } from 'lucide-react';
import { Image } from '@/components/Image';
import { EmbeddedMedia } from '@/components/embeds/EmbeddedMedia';
import type { MediaType } from '@/types';

/**
 * Media item representation for the MediaSection
 */
export interface MediaSectionItem {
  id: string;
  url: string;
  type: MediaType;
  thumbnail?: string;
  isDisplayImage: boolean;    // Radio: selected as card thumbnail
  showInMasonry: boolean;     // Checkbox: show in masonry layout
  showInGrid: boolean;        // Checkbox: show in grid layout
  showInUtility: boolean;     // Checkbox: show in utility layout
  masonryTitle?: string;
  isUploading?: boolean;
  uploadError?: string;
  previewMetadata?: Record<string, unknown>;
}

interface MediaSectionProps {
  items: MediaSectionItem[];
  onDelete: (itemId: string) => void;
  onSetDisplayImage: (itemId: string) => void;
  onToggleMasonry: (itemId: string, showInMasonry: boolean) => void;
  onToggleGrid: (itemId: string, showInGrid: boolean) => void;
  onToggleUtility: (itemId: string, showInUtility: boolean) => void;
  onMasonryTitleChange: (itemId: string, title: string) => void;
  onAddMedia: () => void;
  disabled?: boolean;
}

const MASONRY_TITLE_MAX_LENGTH = 80;

/**
 * Normalize masonry title input
 */
const normalizeMasonryTitle = (input: string): string => {
  return input
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, MASONRY_TITLE_MAX_LENGTH);
};

/**
 * MediaSection: Unified media management with display image selection
 *
 * Features:
 * - Single view of all media (no duplicates)
 * - Radio buttons for "Display on Card" (mutually exclusive)
 * - Checkboxes for "Show in Masonry" (multiple selection)
 * - Delete buttons for each item
 * - Masonry tile title inputs for selected items
 *
 * This replaces the previous "Existing Images" + "Include in Masonry View" pattern
 */
export const MediaSection: React.FC<MediaSectionProps> = ({
  items,
  onDelete,
  onSetDisplayImage,
  onToggleMasonry,
  onToggleGrid,
  onToggleUtility,
  onMasonryTitleChange,
  onAddMedia,
  disabled = false,
}) => {
  if (items.length === 0) {
    return (
      <div className="space-y-3">
        <div className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
          <span>Media Attachments</span>
        </div>
        <button
          type="button"
          onClick={onAddMedia}
          disabled={disabled}
          className="w-full py-8 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-slate-500 dark:text-slate-400 hover:border-primary-400 hover:text-primary-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Click to add media
        </button>
      </div>
    );
  }

  const handleTitleChange = (itemId: string, value: string) => {
    const normalized = normalizeMasonryTitle(value);
    onMasonryTitleChange(itemId, normalized);
  };

  // Find currently selected display image
  const displayImageItem = items.find(item => item.isDisplayImage);
  // Filter masonry items - exclude 'link' type (URLs should not appear as masonry tiles)
  const masonryEnabledItems = items.filter(item => item.showInMasonry && item.type !== 'link');

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center justify-between">
        <span>Media Attachments ({items.length})</span>
        <button
          type="button"
          onClick={onAddMedia}
          disabled={disabled}
          className="text-primary-500 hover:text-primary-600 text-xs font-medium disabled:opacity-50"
        >
          + Add More
        </button>
      </div>

      {/* Media Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {items.map((item) => (
          <div
            key={item.id}
            className={`
              relative group rounded-lg overflow-hidden border-2 transition-all
              ${item.isDisplayImage
                ? 'border-primary-500 ring-2 ring-primary-200 dark:ring-primary-800'
                : 'border-slate-200 dark:border-slate-700'
              }
              ${item.isUploading ? 'opacity-60' : ''}
              bg-slate-50 dark:bg-slate-800
            `}
          >
            {/* Media Preview */}
            <div className="aspect-video overflow-hidden relative">
              {item.type === 'image' ? (
                <Image
                  src={item.thumbnail || item.url}
                  alt={`Media ${item.id}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-900">
                  <EmbeddedMedia
                    media={{
                      type: item.type,
                      url: item.url,
                      thumbnail_url: item.thumbnail,
                      previewMetadata: item.previewMetadata as Record<string, unknown>,
                    }}
                    onClick={() => {}}
                  />
                </div>
              )}

              {/* Upload Progress Indicator */}
              {item.isUploading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="animate-spin h-6 w-6 border-2 border-white border-t-transparent rounded-full" />
                </div>
              )}

              {/* Upload Error Badge */}
              {item.uploadError && (
                <div className="absolute bottom-0 inset-x-0 bg-red-500 text-white text-xs px-2 py-1 text-center">
                  Upload failed
                </div>
              )}

              {/* Display Image Badge (Star) */}
              {item.isDisplayImage && (
                <div className="absolute top-2 left-2 bg-primary-500 text-white p-1 rounded-full shadow-lg" title="Display image for card">
                  <Star size={12} fill="currentColor" />
                </div>
              )}
            </div>

            {/* Controls Row */}
            <div className="p-2 space-y-2 bg-white dark:bg-slate-850">
              {/* Radio: Display on Card */}
              <label className="flex items-center gap-2 cursor-pointer text-xs">
                <input
                  type="radio"
                  name="displayImage"
                  checked={item.isDisplayImage}
                  onChange={() => onSetDisplayImage(item.id)}
                  disabled={disabled || item.isUploading}
                  className="w-3.5 h-3.5 text-primary-500 border-slate-300 focus:ring-primary-500"
                />
                <span className="text-slate-600 dark:text-slate-400">Card Thumbnail</span>
              </label>

              {/* Checkboxes: Layout Visibility */}
              <div className="space-y-1.5 pl-1 pt-1 border-t border-slate-100 dark:border-slate-700">
                <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Show in:</p>

                {/* Checkbox: Grid */}
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={item.showInGrid}
                    onChange={(e) => onToggleGrid(item.id, e.target.checked)}
                    disabled={disabled || item.isUploading}
                    className="w-3.5 h-3.5 text-primary-500 border-slate-300 rounded focus:ring-primary-500"
                  />
                  <span className="text-slate-600 dark:text-slate-400">Grid</span>
                </label>

                {/* Checkbox: Masonry */}
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={item.showInMasonry}
                    onChange={(e) => onToggleMasonry(item.id, e.target.checked)}
                    disabled={disabled || item.isUploading}
                    className="w-3.5 h-3.5 text-primary-500 border-slate-300 rounded focus:ring-primary-500"
                  />
                  <span className="text-slate-600 dark:text-slate-400">Masonry</span>
                </label>

                {/* Checkbox: Utility */}
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={item.showInUtility}
                    onChange={(e) => onToggleUtility(item.id, e.target.checked)}
                    disabled={disabled || item.isUploading}
                    className="w-3.5 h-3.5 text-primary-500 border-slate-300 rounded focus:ring-primary-500"
                  />
                  <span className="text-slate-600 dark:text-slate-400">Utility</span>
                </label>
              </div>

              {/* Delete Button */}
              <button
                type="button"
                onClick={() => onDelete(item.id)}
                disabled={disabled || item.isUploading}
                className="absolute top-2 right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-md transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                title="Delete media"
              >
                <X size={14} />
              </button>

              {/* Media Type Badge */}
              <div className="absolute bottom-14 left-2 px-2 py-0.5 bg-black/60 text-white text-[10px] rounded backdrop-blur-sm">
                {item.type === 'image' ? 'Image' : item.type === 'youtube' ? 'YouTube' : item.type}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Masonry Title Inputs (for items with showInMasonry enabled) */}
      {masonryEnabledItems.length > 0 && (
        <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-700">
          <div className="text-xs font-medium text-slate-600 dark:text-slate-400">
            Masonry Tile Titles (Optional)
          </div>
          <div className="space-y-2">
            {masonryEnabledItems.map((item, index) => (
              <div key={`title-${item.id}`} className="space-y-1">
                <label className="block text-xs text-slate-500 dark:text-slate-400">
                  {item.type === 'image' ? 'Image' : item.type === 'youtube' ? 'YouTube' : item.type} #{index + 1}
                </label>
                <input
                  type="text"
                  value={item.masonryTitle || ''}
                  onChange={(e) => handleTitleChange(item.id, e.target.value)}
                  placeholder="Optional hover caption"
                  maxLength={MASONRY_TITLE_MAX_LENGTH}
                  disabled={disabled}
                  className="w-full px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
                />
                {item.masonryTitle && (
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">
                    {item.masonryTitle.length}/{MASONRY_TITLE_MAX_LENGTH}
                  </p>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Titles appear as captions on hover in Masonry view.
          </p>
        </div>
      )}

      {/* Summary Info */}
      <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
        {displayImageItem && (
          <p>Card thumbnail: {displayImageItem.type === 'image' ? 'Image' : displayImageItem.type}</p>
        )}
        {masonryEnabledItems.length > 0 && (
          <p>{masonryEnabledItems.length} item{masonryEnabledItems.length > 1 ? 's' : ''} will appear in Masonry view</p>
        )}
        {masonryEnabledItems.length === 0 && (
          <p className="text-amber-600 dark:text-amber-400">No items selected for Masonry - nugget won't appear in Masonry layout</p>
        )}
      </div>
    </div>
  );
};
