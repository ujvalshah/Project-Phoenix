import React, { useState } from 'react';
import { X, Link as LinkIcon, ExternalLink as ExternalLinkIcon, Plus, Check } from 'lucide-react';
import type { ExternalLink } from '@/types';

interface ExternalLinksSectionProps {
  links: ExternalLink[];
  onAddLink: (url: string) => void;
  onRemoveLink: (linkId: string) => void;
  onSetPrimary: (linkId: string) => void;
  onUpdateLabel: (linkId: string, label: string) => void;
  disabled?: boolean;
}

/**
 * Extract domain from URL for display
 */
const extractDomain = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return url;
  }
};

/**
 * Truncate URL for display
 */
const truncateUrl = (url: string, maxLength: number = 50): string => {
  if (url.length <= maxLength) return url;
  return url.substring(0, maxLength - 3) + '...';
};

/**
 * ExternalLinksSection: Manage external links for the card's "Link" button
 *
 * Features:
 * - Add multiple external links
 * - Radio buttons to select primary link (shown on card)
 * - Optional custom labels for links
 * - Delete links
 *
 * This is SEPARATE from media URLs - these are external references,
 * not content sources.
 */
export const ExternalLinksSection: React.FC<ExternalLinksSectionProps> = ({
  links,
  onAddLink,
  onRemoveLink,
  onSetPrimary,
  onUpdateLabel,
  disabled = false,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);

  const handleAddLink = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    // Validate URL
    let finalUrl = trimmed;
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      finalUrl = `https://${trimmed}`;
    }

    try {
      new URL(finalUrl);

      // Check for duplicates
      const isDuplicate = links.some(
        link => link.url.toLowerCase() === finalUrl.toLowerCase()
      );

      if (isDuplicate) {
        setInputError('This URL is already added');
        return;
      }

      onAddLink(finalUrl);
      setInputValue('');
      setInputError(null);
    } catch {
      setInputError('Please enter a valid URL');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddLink();
    }
  };

  const primaryLink = links.find(link => link.isPrimary);

  return (
    <div className="space-y-3">
      {/* Section Header */}
      <div className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
        <LinkIcon size={14} />
        <span>External Links</span>
        <span className="text-slate-400 dark:text-slate-500 font-normal">(for card "Link" button)</span>
      </div>

      {/* Add URL Input */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="url"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setInputError(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder="https://example.com/article"
            disabled={disabled}
            className={`
              w-full px-3 py-2 text-sm border rounded-lg
              bg-white dark:bg-slate-900
              text-slate-900 dark:text-slate-100
              placeholder:text-slate-400 dark:placeholder:text-slate-500
              focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
              disabled:opacity-50 disabled:cursor-not-allowed
              ${inputError ? 'border-red-400' : 'border-slate-300 dark:border-slate-600'}
            `}
          />
          {inputError && (
            <p className="absolute -bottom-5 left-0 text-xs text-red-500">{inputError}</p>
          )}
        </div>
        <button
          type="button"
          onClick={handleAddLink}
          disabled={disabled || !inputValue.trim()}
          className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
        >
          <Plus size={16} />
          Add
        </button>
      </div>

      {/* Links List */}
      {links.length > 0 && (
        <div className="space-y-2 mt-4">
          {links.map((link) => (
            <div
              key={link.id}
              className={`
                relative flex items-center gap-3 p-3 rounded-lg border transition-all
                ${link.isPrimary
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                }
              `}
            >
              {/* Primary Radio */}
              <label className="flex items-center cursor-pointer" title="Set as primary link">
                <input
                  type="radio"
                  name="primaryLink"
                  checked={link.isPrimary}
                  onChange={() => onSetPrimary(link.id)}
                  disabled={disabled}
                  className="w-4 h-4 text-primary-500 border-slate-300 focus:ring-primary-500"
                />
              </label>

              {/* Link Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {link.favicon && (
                    <img src={link.favicon} alt="" className="w-4 h-4" />
                  )}
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                    {link.domain || extractDomain(link.url)}
                  </span>
                  {link.isPrimary && (
                    <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-primary-500 text-white rounded">
                      Primary
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {truncateUrl(link.url, 60)}
                </p>

                {/* Optional Label Input */}
                <input
                  type="text"
                  value={link.label || ''}
                  onChange={(e) => onUpdateLabel(link.id, e.target.value)}
                  placeholder="Optional label (e.g., Read on Bloomberg)"
                  disabled={disabled}
                  className="mt-2 w-full px-2 py-1 text-xs border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              {/* External Link Icon */}
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 text-slate-400 hover:text-primary-500 transition-colors"
                title="Open link"
              >
                <ExternalLinkIcon size={16} />
              </a>

              {/* Delete Button */}
              <button
                type="button"
                onClick={() => onRemoveLink(link.id)}
                disabled={disabled}
                className="p-1.5 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50"
                title="Remove link"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Helper Text */}
      <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
        {links.length === 0 && (
          <p>Add external links that will appear as the "Link" button on your card.</p>
        )}
        {primaryLink && (
          <p className="flex items-center gap-1">
            <Check size={12} className="text-green-500" />
            Primary link will show on card: <span className="font-medium">{extractDomain(primaryLink.url)}</span>
          </p>
        )}
        {links.length > 0 && !primaryLink && (
          <p className="text-amber-600 dark:text-amber-400">
            Select a primary link to show the "Link" button on your card.
          </p>
        )}
      </div>
    </div>
  );
};
