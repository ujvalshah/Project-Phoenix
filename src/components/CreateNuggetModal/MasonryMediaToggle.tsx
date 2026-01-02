import React from 'react';
import { Check } from 'lucide-react';
import { MasonryMediaItem } from '@/utils/masonryMediaHelper';
import { Image } from '@/components/Image';
import { EmbeddedMedia } from '@/components/embeds/EmbeddedMedia';

interface MasonryMediaToggleProps {
  items: MasonryMediaItem[];
  onToggle: (itemId: string, showInMasonry: boolean) => void;
  onTitleChange: (itemId: string, title: string) => void;
}

/**
 * MasonryMediaToggle: Toggle controls for selecting which media items appear in Masonry layout
 * 
 * CREATE MODE DEFAULT BEHAVIOR:
 * - Primary media: Selected by default (showInMasonry: true), but NOT locked (can be unselected)
 * - Supporting media: Opt-in (showInMasonry: false)
 * - If user unselects primary media, nugget won't appear in Masonry (no fallback)
 * 
 * EDIT MODE BEHAVIOR:
 * - Respects whatever values are stored in the DB
 * - Does not override existing showInMasonry values
 * 
 * Features:
 * - Small, unobtrusive toggle badge in corner of each media item
 * - Tooltip only (no visible label)
 * - All media items can be toggled (no locked items)
 * - Minimal UI that blends with current style
 */
/**
 * PART D: Character limit and quality rules
 * - Storage limit: 80 characters (hard cap)
 * - Display: Desktop 40 chars, Mobile 28 chars (truncated with ellipsis)
 * - Single-line only, no newlines, trim whitespace, collapse duplicate spaces
 */
const MASONRY_TITLE_MAX_LENGTH = 80;
const MASONRY_TITLE_DISPLAY_DESKTOP = 40;
const MASONRY_TITLE_DISPLAY_MOBILE = 28;

/**
 * Normalize masonry title input
 * - Trim whitespace
 * - Collapse duplicate spaces
 * - Remove newlines
 * - Enforce single-line
 */
const normalizeMasonryTitle = (input: string): string => {
  return input
    .replace(/\n/g, ' ') // Remove newlines
    .replace(/\s+/g, ' ') // Collapse duplicate spaces
    .trim()
    .substring(0, MASONRY_TITLE_MAX_LENGTH); // Hard cap at 80 chars
};

export const MasonryMediaToggle: React.FC<MasonryMediaToggleProps> = ({
  items,
  onToggle,
  onTitleChange,
}) => {
  if (items.length === 0) return null;

  const handleTitleChange = (itemId: string, value: string) => {
    const normalized = normalizeMasonryTitle(value);
    onTitleChange(itemId, normalized);
  };

  // Check if primary media exists and is selected by default
  const primaryItem = items.find(item => item.source === 'primary');
  const isPrimarySelected = primaryItem?.showInMasonry === true;

  return (
    <div className="space-y-3">
      <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
        Include in Masonry View
      </div>
      {isPrimarySelected && primaryItem && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 italic">
          Primary media is selected by default. You may unselect it if you don't want this nugget to appear in the Masonry layout.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="relative group rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
          >
            {/* Media Preview */}
            <div className="w-full aspect-video overflow-hidden">
              {item.type === 'image' ? (
                <Image
                  src={item.url}
                  alt={item.title || `Media ${item.id}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-900">
                  <EmbeddedMedia
                    media={{
                      type: item.type,
                      url: item.url,
                      thumbnail_url: item.thumbnail,
                      previewMetadata: item.previewMetadata,
                    }}
                    onClick={() => {}}
                  />
                </div>
              )}
            </div>

            {/* Toggle Badge - Corner badge with checkmark */}
            {/* MASONRY PARTICIPATION IS NOW USER-CONTROLLED: All media can be toggled (no locked items) */}
            <button
              onClick={() => {
                onToggle(item.id, !item.showInMasonry);
              }}
              className={`
                absolute top-2 right-2 w-6 h-6 rounded-full border-2 flex items-center justify-center
                transition-all duration-150
                cursor-pointer hover:scale-110 hover:shadow-md
                ${
                  item.showInMasonry
                    ? 'bg-primary-500 border-primary-500 text-white'
                    : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-400'
                }
              `}
              title={
                item.showInMasonry
                  ? 'Click to exclude from Masonry view'
                  : 'Click to include in Masonry view'
              }
              aria-label={
                item.showInMasonry
                  ? 'Included in Masonry view - click to exclude'
                  : 'Not included in Masonry view - click to include'
              }
            >
              {item.showInMasonry && <Check size={14} strokeWidth={3} />}
            </button>

            {/* Media Type Badge (optional, for clarity) */}
            <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/60 text-white text-[10px] rounded backdrop-blur-sm">
              {item.type === 'image' ? 'Image' : item.type === 'youtube' ? 'YouTube' : item.type}
            </div>
          </div>
        ))}
      </div>
      
      {/* PART B: Masonry Tile Title inputs (positioned above toggle section) */}
      <div className="space-y-2 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
        <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
          Masonry Tile Titles (Optional)
        </div>
        <div className="space-y-2">
          {items.map((item) => (
            <div key={`title-${item.id}`} className="space-y-1">
              <label className="block text-xs text-slate-500 dark:text-slate-400">
                {item.type === 'image' ? 'Image' : item.type === 'youtube' ? 'YouTube' : item.type} Tile
              </label>
              <input
                type="text"
                value={item.masonryTitle || ''}
                onChange={(e) => handleTitleChange(item.id, e.target.value)}
                placeholder="Optional — shown on hover in masonry view"
                maxLength={MASONRY_TITLE_MAX_LENGTH}
                className="w-full px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              {item.masonryTitle && (
                <p className="text-[10px] text-slate-400 dark:text-slate-500">
                  {item.masonryTitle.length}/{MASONRY_TITLE_MAX_LENGTH} characters
                  {item.masonryTitle.length > MASONRY_TITLE_DISPLAY_DESKTOP && (
                    <span className="ml-1">(will truncate to {MASONRY_TITLE_DISPLAY_DESKTOP} on desktop)</span>
                  )}
                </p>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
          Titles appear as subtle captions at the bottom of tiles on hover. Max {MASONRY_TITLE_MAX_LENGTH} characters, single-line only.
        </p>
      </div>
      
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
        Selected media will appear as individual tiles in the Masonry layout. If no media is selected, this nugget will not appear in Masonry view.
      </p>
    </div>
  );
};

