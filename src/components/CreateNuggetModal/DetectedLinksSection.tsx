import React from 'react';
import { ExternalLink as ExternalLinkIcon, ArrowRight, Info } from 'lucide-react';
import { extractDomain } from '@/components/shared/SourceBadge';

interface DetectedLink {
  url: string;
  source: 'media.url' | 'media.previewMetadata.url';
  sourceLabel: string;
}

interface DetectedLinksSectionProps {
  links: DetectedLink[];
  onPromoteToExternal: (url: string) => void;
  disabled?: boolean;
}

/**
 * Truncate URL for display
 */
const truncateUrl = (url: string, maxLength: number = 50): string => {
  if (url.length <= maxLength) return url;
  return url.substring(0, maxLength - 3) + '...';
};

/**
 * DetectedLinksSection: Display legacy URLs detected from media
 * 
 * Features:
 * - Read-only display of URLs from media.url and media.previewMetadata.url
 * - Source indication (where URL came from)
 * - Explicit "Add to External Links" button for promotion
 * - Clickable URLs (open in new tab)
 * 
 * This is a DIAGNOSTIC component - helps editors see what would be migrated
 * in Phase 2. URLs are NOT automatically promoted - user must click button.
 */
export const DetectedLinksSection: React.FC<DetectedLinksSectionProps> = ({
  links,
  onPromoteToExternal,
  disabled = false,
}) => {
  // Don't render if no detected links
  if (links.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Section Header */}
      <div className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
        <Info size={14} />
        <span>Detected Links</span>
        <span className="text-slate-400 dark:text-slate-500 font-normal">
          (from content/media - not yet in External Links)
        </span>
      </div>

      {/* Detected Links List */}
      <div className="space-y-2">
        {links.map((link, index) => {
          const domain = extractDomain(link.url) || 'Unknown';
          
          return (
            <div
              key={`${link.url}-${index}`}
              className="
                relative flex items-center gap-3 p-3 rounded-lg border
                border-slate-200 dark:border-slate-700
                bg-slate-50 dark:bg-slate-800/50
                transition-all
              "
            >
              {/* Link Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                    {domain}
                  </span>
                  <span className="
                    inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium
                    bg-slate-200 dark:bg-slate-700
                    text-slate-600 dark:text-slate-400 rounded
                  ">
                    {link.sourceLabel}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {truncateUrl(link.url, 60)}
                </p>
              </div>

              {/* External Link Icon (Open in new tab) */}
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 text-slate-400 hover:text-primary-500 transition-colors"
                title="Open link in new tab"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLinkIcon size={16} />
              </a>

              {/* Promote Button */}
              <button
                type="button"
                onClick={() => onPromoteToExternal(link.url)}
                disabled={disabled}
                className="
                  px-3 py-1.5 text-xs font-medium rounded-lg
                  bg-primary-500 hover:bg-primary-600
                  text-white
                  transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed
                  flex items-center gap-1.5
                "
                title="Add to External Links"
              >
                <ArrowRight size={12} />
                Add to External Links
              </button>
            </div>
          );
        })}
      </div>

      {/* Helper Text */}
      <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
        <p>
          These URLs were detected from your article's media. Click "Add to External Links"
          to make them appear as the "Link" button on your card.
        </p>
        <p className="text-amber-600 dark:text-amber-400">
          💡 Tip: After adding, you can set one as primary in the External Links section above.
        </p>
      </div>
    </div>
  );
};
