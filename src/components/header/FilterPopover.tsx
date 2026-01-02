import React from 'react';
import { Star, Circle } from 'lucide-react';

export interface FilterState {
  favorites: boolean;
  unread: boolean;
  formats: string[]; // e.g. ['video', 'pdf']
  timeRange: 'all' | '24h' | '7d';
}

interface FilterPopoverProps {
  filters: FilterState;
  onChange: (newFilters: FilterState) => void;
  onClear: () => void;
}

const formatOptions = [
  { value: 'link', label: 'Links / Articles' },
  { value: 'twitter', label: 'Twitter Threads' },
  { value: 'video', label: 'Videos' },
  { value: 'document', label: 'Documents (PDF/XLS)' },
];

const timeRangeOptions = [
  { value: 'all', label: 'Any Time' },
  { value: '24h', label: 'Past 24 Hours' },
  { value: '7d', label: 'Past Week' },
];

export const FilterPopover: React.FC<FilterPopoverProps> = ({
  filters,
  onChange,
  onClear,
}) => {
  // Check if any filter is active
  const hasActiveFilters =
    filters.favorites ||
    filters.unread ||
    filters.formats.length > 0 ||
    filters.timeRange !== 'all';

  const handleToggleFavorites = () => {
    onChange({
      ...filters,
      favorites: !filters.favorites,
    });
  };

  const handleToggleUnread = () => {
    onChange({
      ...filters,
      unread: !filters.unread,
    });
  };

  const handleToggleFormat = (format: string) => {
    const newFormats = filters.formats.includes(format)
      ? filters.formats.filter((f) => f !== format)
      : [...filters.formats, format];
    onChange({
      ...filters,
      formats: newFormats,
    });
  };

  const handleTimeRangeChange = (timeRange: 'all' | '24h' | '7d') => {
    onChange({
      ...filters,
      timeRange,
    });
  };

  return (
    <div className="w-72 bg-white rounded-xl shadow-xl border border-gray-100 p-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 px-1">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
          Filters
        </h3>
        {hasActiveFilters && (
          <button
            onClick={onClear}
            className="text-xs text-red-500 hover:underline transition-colors"
            aria-label="Clear all filters"
          >
            Clear
          </button>
        )}
      </div>

      {/* Section A: View */}
      <div className="space-y-1 mb-2">
        <div
          onClick={handleToggleFavorites}
          className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleToggleFavorites();
            }
          }}
          aria-label="Toggle favorites filter"
          aria-checked={filters.favorites}
        >
          <div className="flex items-center gap-2">
            <Star
              size={14}
              className={filters.favorites ? 'text-yellow-500 fill-yellow-500' : 'text-gray-400'}
            />
            <span className="text-sm text-gray-700">Favorites Only</span>
          </div>
          <input
            type="checkbox"
            checked={filters.favorites}
            onChange={handleToggleFavorites}
            className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500 focus:ring-2 cursor-pointer"
            onClick={(e) => e.stopPropagation()}
            aria-label="Favorites Only"
          />
        </div>

        <div
          onClick={handleToggleUnread}
          className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleToggleUnread();
            }
          }}
          aria-label="Toggle unread filter"
          aria-checked={filters.unread}
        >
          <div className="flex items-center gap-2">
            <Circle
              size={14}
              className={filters.unread ? 'text-blue-500 fill-blue-500' : 'text-gray-400'}
            />
            <span className="text-sm text-gray-700">Unread Only</span>
          </div>
          <input
            type="checkbox"
            checked={filters.unread}
            onChange={handleToggleUnread}
            className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500 focus:ring-2 cursor-pointer"
            onClick={(e) => e.stopPropagation()}
            aria-label="Unread Only"
          />
        </div>
      </div>

      {/* Divider */}
      <div className="border-b border-gray-50 my-2" />

      {/* Section B: Format (Multi-select) */}
      <div className="space-y-1 mb-2">
        {formatOptions.map((option) => (
          <div
            key={option.value}
            onClick={() => handleToggleFormat(option.value)}
            className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleToggleFormat(option.value);
              }
            }}
            aria-label={`Toggle ${option.label} filter`}
            aria-checked={filters.formats.includes(option.value)}
          >
            <span className="text-sm text-gray-700">{option.label}</span>
            <input
              type="checkbox"
              checked={filters.formats.includes(option.value)}
              onChange={() => handleToggleFormat(option.value)}
              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500 focus:ring-2 cursor-pointer"
              onClick={(e) => e.stopPropagation()}
              aria-label={option.label}
            />
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className="border-b border-gray-50 my-2" />

      {/* Section C: Time (Radio - Single Select) */}
      <div className="space-y-1">
        {timeRangeOptions.map((option) => (
          <div
            key={option.value}
            onClick={() => handleTimeRangeChange(option.value as 'all' | '24h' | '7d')}
            className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleTimeRangeChange(option.value as 'all' | '24h' | '7d');
              }
            }}
            aria-label={`Select ${option.label}`}
            aria-checked={filters.timeRange === option.value}
          >
            <span className="text-sm text-gray-700">{option.label}</span>
            <input
              type="radio"
              name="timeRange"
              value={option.value}
              checked={filters.timeRange === option.value}
              onChange={() => handleTimeRangeChange(option.value as 'all' | '24h' | '7d')}
              className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500 focus:ring-2 cursor-pointer"
              onClick={(e) => e.stopPropagation()}
              aria-label={option.label}
            />
          </div>
        ))}
      </div>
    </div>
  );
};




