import React, { useState, useEffect } from 'react';
import { Pencil, Check, X } from 'lucide-react';
import { SourceBadge, extractDomain } from './SourceBadge';
import { twMerge } from 'tailwind-merge';

interface SourceSelectorProps {
  /** The current URL from which to extract domain */
  currentUrl: string | null;
  /** Callback when domain is changed */
  onDomainChange: (domain: string | null) => void;
  /** Initial custom domain value (optional) */
  initialDomain?: string | null;
  /** Additional CSS classes */
  className?: string;
}

/**
 * SourceSelector Component
 * 
 * Smart form component that allows users to view and edit the source domain.
 * Shows SourceBadge in view mode, with ability to override the detected domain.
 * 
 * @example
 * ```tsx
 * <SourceSelector
 *   currentUrl="https://twitter.com/user/status/123"
 *   onDomainChange={(domain) => setCustomDomain(domain)}
 *   initialDomain="nytimes.com"
 * />
 * ```
 */
export const SourceSelector: React.FC<SourceSelectorProps> = ({
  currentUrl,
  onDomainChange,
  initialDomain,
  className,
}) => {
  // Extract domain from URL
  const parsedDomain = currentUrl ? extractDomain(currentUrl) : null;

  // Determine which domain to display (custom > parsed > null)
  const displayDomain = initialDomain || parsedDomain;

  // Initialize editing state: start in edit mode if no domain is set
  const [isEditing, setIsEditing] = useState(!displayDomain);
  const [customInput, setCustomInput] = useState<string>(initialDomain || parsedDomain || '');

  // Initialize custom input when entering edit mode or when domain changes
  useEffect(() => {
    if (isEditing || !displayDomain) {
      setCustomInput(initialDomain || parsedDomain || '');
    }
  }, [isEditing, initialDomain, parsedDomain, displayDomain]);

  const handleSave = () => {
    const trimmed = customInput.trim();
    // If empty, clear the override (use parsed domain)
    const newDomain = trimmed === '' ? null : trimmed;
    onDomainChange(newDomain);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setCustomInput(initialDomain || parsedDomain || '');
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  // Determine label based on whether we have a detected URL
  const labelText = currentUrl && parsedDomain ? 'Detected Source' : 'Source';

  // Show edit mode if explicitly editing, or if no domain is set (allows manual entry)
  const showEditMode = isEditing || !displayDomain;

  return (
    <div className={twMerge('flex flex-col gap-2', className)}>
      {/* Label */}
      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {labelText}
      </label>

      {/* View Mode - Show when we have a domain and not editing */}
      {!showEditMode ? (
        <div className="flex items-center gap-2">
          <SourceBadge
            url={currentUrl || undefined}
            customDomain={initialDomain || undefined}
            size="md"
          />
          <button
            onClick={() => setIsEditing(true)}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
            title="Edit source domain"
            aria-label="Edit source domain"
          >
            <Pencil size={14} />
          </button>
        </div>
      ) : (
        /* Edit Mode - Show when editing or when no domain is set */
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Source domain (e.g. ft.com)"
              autoFocus={showEditMode}
              className="w-full h-8 px-3 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-slate-900 dark:text-white placeholder-slate-400"
            />
          </div>
          <button
            onClick={handleSave}
            className="p-1.5 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-md transition-colors"
            title="Save"
            aria-label="Save domain"
          >
            <Check size={16} />
          </button>
          {displayDomain && (
            <button
              onClick={handleCancel}
              className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
              title="Cancel"
              aria-label="Cancel editing"
            >
              <X size={16} />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

