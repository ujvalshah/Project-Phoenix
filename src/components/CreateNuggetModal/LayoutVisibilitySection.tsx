import React from 'react';
import { Grid, LayoutGrid, Columns, AlertTriangle } from 'lucide-react';
import type { LayoutVisibility } from '@/types';

interface LayoutVisibilitySectionProps {
  visibility: LayoutVisibility;
  onChange: (visibility: LayoutVisibility) => void;
  hasMedia: boolean;
  hasMasonrySelectedMedia: boolean;
  disabled?: boolean;
}

/**
 * LayoutVisibilitySection: Control which layouts display this nugget
 *
 * Features:
 * - Checkbox for each layout type (Grid, Masonry, Utility)
 * - Visual icons for each layout
 * - Warning when Masonry is enabled but no media selected for it
 * - All layouts enabled by default
 *
 * This allows users to create nuggets for specific layouts only.
 */
export const LayoutVisibilitySection: React.FC<LayoutVisibilitySectionProps> = ({
  visibility,
  onChange,
  hasMedia,
  hasMasonrySelectedMedia,
  disabled = false,
}) => {
  const handleToggle = (layout: keyof LayoutVisibility) => {
    onChange({
      ...visibility,
      [layout]: !visibility[layout],
    });
  };

  // Warning conditions
  const showMasonryWarning = visibility.masonry && (!hasMedia || !hasMasonrySelectedMedia);
  const noLayoutsSelected = !visibility.grid && !visibility.masonry && !visibility.utility;

  return (
    <div className="space-y-3">
      {/* Section Header */}
      <div className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
        <LayoutGrid size={14} />
        <span>Layout Visibility</span>
      </div>

      {/* Layout Checkboxes */}
      <div className="flex flex-wrap gap-4">
        {/* Grid Layout */}
        <label className={`
          flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all
          ${visibility.grid
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary-400'}
        `}>
          <input
            type="checkbox"
            checked={visibility.grid}
            onChange={() => handleToggle('grid')}
            disabled={disabled}
            className="w-4 h-4 text-primary-500 border-slate-300 rounded focus:ring-primary-500"
          />
          <Grid size={16} className={visibility.grid ? 'text-primary-500' : 'text-slate-400'} />
          <span className={`text-sm ${visibility.grid ? 'text-slate-700 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400'}`}>
            Grid
          </span>
        </label>

        {/* Masonry Layout */}
        <label className={`
          flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all
          ${visibility.masonry
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary-400'}
        `}>
          <input
            type="checkbox"
            checked={visibility.masonry}
            onChange={() => handleToggle('masonry')}
            disabled={disabled}
            className="w-4 h-4 text-primary-500 border-slate-300 rounded focus:ring-primary-500"
          />
          <Columns size={16} className={visibility.masonry ? 'text-primary-500' : 'text-slate-400'} />
          <span className={`text-sm ${visibility.masonry ? 'text-slate-700 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400'}`}>
            Masonry
          </span>
        </label>

        {/* Utility Layout */}
        <label className={`
          flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all
          ${visibility.utility
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary-400'}
        `}>
          <input
            type="checkbox"
            checked={visibility.utility}
            onChange={() => handleToggle('utility')}
            disabled={disabled}
            className="w-4 h-4 text-primary-500 border-slate-300 rounded focus:ring-primary-500"
          />
          <LayoutGrid size={16} className={visibility.utility ? 'text-primary-500' : 'text-slate-400'} />
          <span className={`text-sm ${visibility.utility ? 'text-slate-700 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400'}`}>
            Utility
          </span>
        </label>
      </div>

      {/* Warnings */}
      {showMasonryWarning && (
        <div className="flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <AlertTriangle size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            {!hasMedia
              ? 'Masonry layout requires media. Add images or videos to appear in Masonry view.'
              : 'No media items selected for Masonry. Enable "Masonry View" on at least one media item above.'
            }
          </p>
        </div>
      )}

      {noLayoutsSelected && (
        <div className="flex items-start gap-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertTriangle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-red-700 dark:text-red-400">
            No layouts selected. This nugget won't be visible anywhere. Select at least one layout.
          </p>
        </div>
      )}

      {/* Helper Text */}
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Choose which layouts this nugget should appear in. Uncheck layouts to hide this nugget from specific views.
      </p>
    </div>
  );
};
