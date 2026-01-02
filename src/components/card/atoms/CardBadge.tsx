/* eslint-disable @typescript-eslint/no-unused-vars */
import React from 'react';
import { SourceBadge, extractDomain } from '@/components/shared/SourceBadge';
import { Article } from '@/types';

interface CardBadgeProps {
  isTextNugget: boolean;
  sourceType: string | undefined;
  /** Media object containing URL information */
  media?: Article['media'];
  /** Custom domain override (explicit prop, takes priority) */
  customDomain?: string | null;
  /** Size variant: 'sm' for icon-only, 'md' for icon+text */
  size?: 'sm' | 'md';
  /** Visual variant: 'overlay' for glassmorphic overlay on images, 'inline' for solid inline badge */
  variant?: 'overlay' | 'inline';
  className?: string;
}

/**
 * CardBadge Component
 * 
 * Wrapper around SourceBadge that extracts URL from article media.
 * Displays for link-type sources, or for text nuggets if a custom domain is set.
 * 
 * Automatically extracts customDomain from media.previewMetadata.siteName
 * if it differs from the parsed domain (indicating a custom override).
 * For text nuggets, shows badge when customDomain is provided.
 * 
 * TEMPORARILY DISABLED: Favicon display is currently hidden
 */
export const CardBadge: React.FC<CardBadgeProps> = ({
  isTextNugget: _isTextNugget,
  sourceType: _sourceType,
  media: _media,
  customDomain: _explicitCustomDomain,
  size: _size = 'sm',
  variant: _variant = 'overlay',
  className: _className,
}) => {
  // TEMPORARILY DISABLED: Hide favicon on nuggets
  return null;

  /* COMMENTED OUT - TEMPORARILY DISABLED
  // Extract URL from media object
  const url = media?.previewMetadata?.url || media?.url || null;

  // Extract customDomain: explicit prop > siteName (if different from parsed) > null
  let customDomain = explicitCustomDomain;
  if (!customDomain && media?.previewMetadata?.siteName) {
    const parsedDomain = url ? extractDomain(url) : null;
    const siteNameDomain = extractDomain(media.previewMetadata.siteName);
    // If siteName exists and doesn't match parsed domain, treat it as custom override
    if (siteNameDomain && parsedDomain && siteNameDomain !== parsedDomain) {
      customDomain = siteNameDomain;
    } else if (siteNameDomain && !parsedDomain) {
      // If we have siteName but can't parse URL domain, use siteName
      // This handles text nuggets with custom domain
      customDomain = siteNameDomain;
    } else if (siteNameDomain && isTextNugget) {
      // For text nuggets, if siteName exists, use it as custom domain
      customDomain = siteNameDomain;
    }
  }

  // Show badge for text nuggets only if customDomain is set
  // For link sources, show if we have URL or custom domain
  if (isTextNugget && !customDomain) {
    return null;
  }
  if (!isTextNugget && !url && !customDomain && sourceType !== 'link') {
    return null;
  }

  return (
    <SourceBadge
      url={url || undefined}
      customDomain={customDomain || undefined}
      size={size}
      variant={variant}
      className={className}
    />
  );
  */
};

