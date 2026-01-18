/**
 * Pre-Save Validation Module
 *
 * Validates article data before saving to ensure data integrity.
 * This module provides a safety layer to prevent accidental data loss.
 *
 * Validation Categories:
 * - Errors: Block save (e.g., missing required fields)
 * - Warnings: Allow save with confirmation (e.g., images being removed)
 * - Integrity Checks: Audit trail for data changes
 */

import type { Article, ExternalLink } from '@/types';
import { normalizeImageUrl } from './imageDedup';

/**
 * Validation error that blocks save
 */
export interface ValidationError {
  field: string;
  code: string;
  message: string;
}

/**
 * Validation warning that requires user confirmation
 */
export interface ValidationWarning {
  field: string;
  code: string;
  message: string;
}

/**
 * Data integrity check result
 */
export interface DataIntegrityCheck {
  name: string;
  passed: boolean;
  details?: string;
}

/**
 * Complete validation result
 */
export interface PreSaveValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  integrityChecks: DataIntegrityCheck[];
}

/**
 * Input for validation - matches what's being saved
 */
export interface ValidationInput {
  title?: string;
  content?: string;
  tags?: string[];
  media?: { url?: string; type?: string } | null;
  primaryMedia?: { url?: string } | null;
  supportingMedia?: Array<{ url?: string }>;
  images?: string[];
  externalLinks?: ExternalLink[];
  displayImageIndex?: number;
}

/**
 * Validate article data before save
 *
 * @param originalArticle - Original article (for edit mode comparison)
 * @param input - Data being saved
 * @param mode - 'create' or 'edit'
 * @returns Validation result with errors, warnings, and integrity checks
 */
export function validateBeforeSave(
  originalArticle: Article | undefined | null,
  input: ValidationInput,
  mode: 'create' | 'edit'
): PreSaveValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const integrityChecks: DataIntegrityCheck[] = [];

  // ============================================================================
  // REQUIRED FIELD VALIDATIONS (Errors - block save)
  // ============================================================================

  // 1. Tags validation - at least one tag required
  const hasValidTags =
    input.tags &&
    Array.isArray(input.tags) &&
    input.tags.length > 0 &&
    input.tags.some((tag) => typeof tag === 'string' && tag.trim().length > 0);

  if (!hasValidTags) {
    errors.push({
      field: 'tags',
      code: 'TAGS_REQUIRED',
      message: 'At least one tag is required',
    });
  }
  integrityChecks.push({
    name: 'hasAtLeastOneTag',
    passed: !!hasValidTags,
  });

  // 2. Content validation - must have content OR media OR images
  const hasContent = !!(input.content && input.content.trim().length > 0);
  const hasMedia = !!(input.media?.url || input.primaryMedia?.url);
  const hasImages = !!(input.images && input.images.length > 0);
  const hasSupportingMedia = !!(input.supportingMedia && input.supportingMedia.length > 0);

  const hasAnyContent = hasContent || hasMedia || hasImages || hasSupportingMedia;

  if (!hasAnyContent) {
    errors.push({
      field: 'content',
      code: 'CONTENT_REQUIRED',
      message: 'Please provide content, a URL, or images',
    });
  }
  integrityChecks.push({
    name: 'hasContent',
    passed: hasAnyContent,
    details: `content=${hasContent}, media=${hasMedia}, images=${hasImages}, supporting=${hasSupportingMedia}`,
  });

  // ============================================================================
  // EXTERNAL LINKS VALIDATIONS
  // ============================================================================

  if (input.externalLinks && input.externalLinks.length > 0) {
    // 3. Check for multiple primary links
    const primaryLinks = input.externalLinks.filter((link) => link.isPrimary);
    if (primaryLinks.length > 1) {
      errors.push({
        field: 'externalLinks',
        code: 'MULTIPLE_PRIMARY_LINKS',
        message: 'Only one external link can be marked as primary',
      });
    }

    // 4. Warn if no primary link is set
    if (primaryLinks.length === 0) {
      warnings.push({
        field: 'externalLinks',
        code: 'NO_PRIMARY_LINK',
        message: 'Consider setting a primary link for the card "Link" button',
      });
    }

    // 5. Validate external link URLs
    for (const link of input.externalLinks) {
      if (link.url) {
        try {
          new URL(link.url);
        } catch {
          errors.push({
            field: 'externalLinks',
            code: 'INVALID_URL',
            message: `Invalid URL: ${link.url}`,
          });
        }
      }
    }
  }

  // ============================================================================
  // DISPLAY IMAGE INDEX VALIDATION
  // ============================================================================

  if (input.displayImageIndex !== undefined && input.displayImageIndex !== null) {
    // Calculate total media count
    const totalMediaCount =
      (input.images?.length ?? 0) +
      (input.supportingMedia?.length ?? 0) +
      (input.primaryMedia?.url ? 1 : 0) +
      (input.media?.url ? 1 : 0);

    if (input.displayImageIndex < 0 || input.displayImageIndex >= totalMediaCount) {
      errors.push({
        field: 'displayImageIndex',
        code: 'INVALID_DISPLAY_INDEX',
        message: `Display image index ${input.displayImageIndex} is out of bounds (total media: ${totalMediaCount})`,
      });
    }
  }

  // ============================================================================
  // EDIT MODE VALIDATIONS (Warnings - require confirmation)
  // ============================================================================

  if (mode === 'edit' && originalArticle) {
    // 6. Check if images are being removed
    const originalImageCount = countAllImages(originalArticle);

    // BUGFIX: In EDIT mode, null/undefined means "don't change", not "remove"
    // Only count fields that are explicitly being set in the input
    // For fields set to null/undefined, use the original article's count
    const newImageCount =
      // images array: use input if defined, else preserve original count
      (input.images !== undefined ? (input.images?.length ?? 0) : (originalArticle.images?.length ?? 0)) +
      // supportingMedia: use input if defined, else preserve original count
      (input.supportingMedia !== undefined ? (input.supportingMedia?.length ?? 0) : (originalArticle.supportingMedia?.length ?? 0)) +
      // primaryMedia: null means "don't change", so use original if input is null
      (input.primaryMedia === null ? (originalArticle.primaryMedia?.url ? 1 : 0) : (input.primaryMedia?.url ? 1 : 0)) +
      // media: use input if defined, else preserve original count
      (input.media !== undefined
        ? (input.media?.type === 'image' && input.media?.url ? 1 : 0)
        : (originalArticle.media?.type === 'image' && originalArticle.media?.url ? 1 : 0));

    if (originalImageCount > 0 && newImageCount < originalImageCount) {
      const reduction = originalImageCount - newImageCount;
      warnings.push({
        field: 'images',
        code: 'IMAGES_REDUCED',
        message: `${reduction} image${reduction > 1 ? 's' : ''} will be removed. This cannot be undone.`,
      });
    }

    integrityChecks.push({
      name: 'imagesPreserved',
      passed: newImageCount >= originalImageCount,
      details: `Original: ${originalImageCount}, New: ${newImageCount}`,
    });

    // 7. Check if external links are being removed
    const originalExternalLinkCount = originalArticle.externalLinks?.length ?? 0;
    const newExternalLinkCount = input.externalLinks?.length ?? 0;

    if (originalExternalLinkCount > 0 && newExternalLinkCount < originalExternalLinkCount) {
      const reduction = originalExternalLinkCount - newExternalLinkCount;
      warnings.push({
        field: 'externalLinks',
        code: 'EXTERNAL_LINKS_REDUCED',
        message: `${reduction} external link${reduction > 1 ? 's' : ''} will be removed.`,
      });
    }

    // 8. Check for URL changes that might indicate data loss
    const originalUrls = getAllUrls(originalArticle);
    const newUrls = getAllUrlsFromInput(input);

    const removedUrls = originalUrls.filter(
      (url) => !newUrls.some((newUrl) => normalizeImageUrl(newUrl) === normalizeImageUrl(url))
    );

    if (removedUrls.length > 0) {
      integrityChecks.push({
        name: 'urlsPreserved',
        passed: false,
        details: `Removed URLs: ${removedUrls.join(', ')}`,
      });
    } else {
      integrityChecks.push({
        name: 'urlsPreserved',
        passed: true,
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    integrityChecks,
  };
}

/**
 * Count all images in an article
 */
function countAllImages(article: Article): number {
  let count = 0;

  if (article.primaryMedia?.url) count++;
  if (article.supportingMedia) count += article.supportingMedia.length;
  if (article.media?.type === 'image' && article.media.url) count++;
  if (article.images) count += article.images.length;

  return count;
}

/**
 * Get all URLs from an article
 */
function getAllUrls(article: Article): string[] {
  const urls: string[] = [];

  if (article.primaryMedia?.url) urls.push(article.primaryMedia.url);
  if (article.supportingMedia) {
    article.supportingMedia.forEach((m) => {
      if (m.url) urls.push(m.url);
    });
  }
  if (article.media?.url) urls.push(article.media.url);
  if (article.images) urls.push(...article.images);

  return urls;
}

/**
 * Get all URLs from validation input
 */
function getAllUrlsFromInput(input: ValidationInput): string[] {
  const urls: string[] = [];

  if (input.primaryMedia?.url) urls.push(input.primaryMedia.url);
  if (input.supportingMedia) {
    input.supportingMedia.forEach((m) => {
      if (m.url) urls.push(m.url);
    });
  }
  if (input.media?.url) urls.push(input.media.url);
  if (input.images) urls.push(...input.images);

  return urls;
}

/**
 * Format validation result for display
 */
export function formatValidationResult(result: PreSaveValidationResult): string {
  const lines: string[] = [];

  if (result.errors.length > 0) {
    lines.push('Errors:');
    result.errors.forEach((e) => lines.push(`  - ${e.message}`));
  }

  if (result.warnings.length > 0) {
    lines.push('Warnings:');
    result.warnings.forEach((w) => lines.push(`  - ${w.message}`));
  }

  return lines.join('\n');
}
