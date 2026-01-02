import React from 'react';
import { Grid3x3, Rss, LayoutGrid, Settings } from 'lucide-react';

export type LayoutMode = 'grid' | 'feed' | 'masonry' | 'utility';

interface LayoutPreviewToggleProps {
  currentLayout: LayoutMode;
  onLayoutChange: (layout: LayoutMode) => void;
}

export const LayoutPreviewToggle: React.FC<LayoutPreviewToggleProps> = ({
  currentLayout,
  onLayoutChange,
}) => {
  const layouts: { mode: LayoutMode; icon: React.ReactNode; label: string }[] = [
    { mode: 'grid', icon: <Grid3x3 size={18} />, label: 'Grid' },
    { mode: 'feed', icon: <Rss size={18} />, label: 'Feed' },
    { mode: 'masonry', icon: <LayoutGrid size={18} />, label: 'Masonry' },
    { mode: 'utility', icon: <Settings size={18} />, label: 'Utility' },
  ];

  return (
    <div className="flex items-center gap-2 p-1 bg-gray-100 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
      {layouts.map(({ mode, icon, label }) => (
        <button
          key={mode}
          onClick={() => onLayoutChange(mode)}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
            ${
              currentLayout === mode
                ? 'bg-yellow-400 text-gray-900 shadow-sm'
                : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-slate-700'
            }
          `}
          aria-label={`Switch to ${label} layout`}
          aria-pressed={currentLayout === mode}
        >
          {icon}
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
};







