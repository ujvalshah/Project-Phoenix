/**
 * MediaManager Component
 *
 * PHASE 4: Consolidated media management UI for CreateNuggetModal
 *
 * This component encapsulates all media-related UI and logic:
 * - Existing images display and deletion
 * - File attachments (via AttachmentManager)
 * - URL inputs (via UrlInput)
 * - Masonry options (via MasonryMediaToggle)
 * - Link previews
 *
 * INTEGRATION:
 * - Uses useImageManager hook when FEATURE_FLAGS.USE_IMAGE_MANAGER is enabled
 * - Falls back to legacy props when disabled
 */

import React, { useMemo } from 'react';
import { X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { AttachmentManager, FileAttachment } from './AttachmentManager';
import { MasonryMediaToggle } from './MasonryMediaToggle';
import { UrlInput } from './UrlInput';
import { GenericLinkPreview } from '../embeds/GenericLinkPreview';
import type { UseImageManagerReturn } from '@/hooks/useImageManager';
import type { MasonryMediaItem } from '@/utils/masonryMediaHelper';
import { isFeatureEnabled } from '@/constants/featureFlags';

/**
 * Props for MediaManager when using legacy mode (feature flag disabled)
 */
interface LegacyMediaProps {
  // Existing images
  existingImages: string[];
  onDeleteImage: (url: string) => void;

  // Masonry items
  masonryMediaItems: MasonryMediaItem[];
  onMasonryMediaToggle: (itemId: string, showInMasonry: boolean) => void;
  onMasonryTitleChange: (itemId: string, title: string) => void;

  // URL inputs
  urlInput: string;
  urls: string[];
  onUrlInputChange: (value: string) => void;
  onAddUrl: (url: string) => void;
  onRemoveUrl: (url: string) => void;
  onUrlPaste: (e: React.ClipboardEvent) => void;

  // Attachments
  attachments: FileAttachment[];
  onAddAttachments: (files: File[]) => void;
  onRemoveAttachment: (index: number) => void;

  // Link preview
  linkMetadata: any;
  isLoadingMetadata: boolean;
  detectedLink: string | null;
}

/**
 * Props for MediaManager when using useImageManager (feature flag enabled)
 */
interface ImageManagerProps {
  imageManager: UseImageManagerReturn;
  articleId?: string;

  // URL inputs (still managed by parent for now)
  urlInput: string;
  urls: string[];
  onUrlInputChange: (value: string) => void;
  onAddUrl: (url: string) => void;
  onRemoveUrl: (url: string) => void;
  onUrlPaste: (e: React.ClipboardEvent) => void;

  // Attachments (still managed by parent for now)
  attachments: FileAttachment[];
  onAddAttachments: (files: File[]) => void;
  onRemoveAttachment: (index: number) => void;

  // Link preview
  linkMetadata: any;
  isLoadingMetadata: boolean;
  detectedLink: string | null;
}

/**
 * Common props
 */
interface CommonProps {
  mode: 'create' | 'edit';
  onContentTouched: () => void;
}

type MediaManagerProps = CommonProps & (
  | ({ useImageManager: true } & ImageManagerProps)
  | ({ useImageManager: false } & LegacyMediaProps)
);

/**
 * ExistingImageCard - Individual image card with delete button
 */
interface ExistingImageCardProps {
  url: string;
  onDelete: (url: string) => void;
  isDeleting?: boolean;
}

function ExistingImageCard({ url, onDelete, isDeleting }: ExistingImageCardProps) {
  return (
    <div className="relative group aspect-square rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
      <img
        src={url}
        alt="Existing image"
        className={`w-full h-full object-cover transition-opacity ${isDeleting ? 'opacity-50' : ''}`}
        loading="lazy"
      />
      {isDeleting ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <Loader2 size={20} className="animate-spin text-white" />
        </div>
      ) : (
        <button
          onClick={() => onDelete(url)}
          className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
          title="Delete image"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

/**
 * ExistingImagesGrid - Grid of existing images
 */
interface ExistingImagesGridProps {
  images: string[];
  onDelete: (url: string) => void;
  isDeleting?: (url: string) => boolean;
}

function ExistingImagesGrid({ images, onDelete, isDeleting }: ExistingImagesGridProps) {
  if (images.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
        <ImageIcon size={14} />
        <span>Existing Images ({images.length})</span>
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
        {images.map((url, index) => (
          <ExistingImageCard
            key={`${url}-${index}`}
            url={url}
            onDelete={onDelete}
            isDeleting={isDeleting?.(url)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * MediaManager Component
 */
export function MediaManager(props: MediaManagerProps) {
  const { mode, onContentTouched } = props;

  // Determine which mode we're in
  const useNewImageManager = props.useImageManager && isFeatureEnabled('USE_IMAGE_MANAGER');

  // Get the appropriate values based on mode
  const existingImages = useNewImageManager
    ? (props as ImageManagerProps).imageManager.existingImages
    : (props as LegacyMediaProps).existingImages;

  const masonryItems = useNewImageManager
    ? (props as ImageManagerProps).imageManager.masonryItems
    : (props as LegacyMediaProps).masonryMediaItems;

  const isDeleting = useNewImageManager
    ? (props as ImageManagerProps).imageManager.isDeleting
    : undefined;

  // Handle image deletion
  const handleDeleteImage = async (url: string) => {
    if (useNewImageManager) {
      const { imageManager, articleId } = props as ImageManagerProps;
      imageManager.deleteImage(url);

      // Call API to delete image
      if (mode === 'edit' && articleId) {
        try {
          const { apiClient } = await import('@/services/apiClient');
          await (apiClient as any).request(
            `/articles/${articleId}/images`,
            {
              method: 'DELETE',
              body: JSON.stringify({ imageUrl: url }),
              headers: { 'Content-Type': 'application/json' },
            }
          );
          imageManager.confirmDeletion(url);
        } catch (error) {
          console.error('[MediaManager] Delete failed:', error);
          imageManager.rollbackDeletion(url);
        }
      } else {
        // Create mode - just confirm deletion (no API call needed)
        imageManager.confirmDeletion(url);
      }
    } else {
      (props as LegacyMediaProps).onDeleteImage(url);
    }
  };

  // Handle masonry toggle
  const handleMasonryToggle = (itemId: string, showInMasonry: boolean) => {
    if (useNewImageManager) {
      const { imageManager } = props as ImageManagerProps;
      // Find the URL from itemId
      const item = masonryItems.find(m => m.id === itemId);
      if (item) {
        imageManager.toggleMasonry(item.url, showInMasonry);
      }
    } else {
      (props as LegacyMediaProps).onMasonryMediaToggle(itemId, showInMasonry);
    }
  };

  // Handle masonry title change
  const handleMasonryTitleChange = (itemId: string, title: string) => {
    if (useNewImageManager) {
      const { imageManager } = props as ImageManagerProps;
      const item = masonryItems.find(m => m.id === itemId);
      if (item) {
        imageManager.setMasonryTitle(item.url, title);
      }
    } else {
      (props as LegacyMediaProps).onMasonryTitleChange(itemId, title);
    }
  };

  // Common props
  const {
    urlInput,
    urls,
    onUrlInputChange,
    onAddUrl,
    onRemoveUrl,
    onUrlPaste,
    attachments,
    onAddAttachments,
    onRemoveAttachment,
    linkMetadata,
    isLoadingMetadata,
    detectedLink,
  } = props.useImageManager ? (props as ImageManagerProps) : (props as LegacyMediaProps);

  return (
    <div className="space-y-4">
      {/* Existing Images (Edit Mode) */}
      {mode === 'edit' && existingImages.length > 0 && (
        <ExistingImagesGrid
          images={existingImages}
          onDelete={handleDeleteImage}
          isDeleting={isDeleting}
        />
      )}

      {/* URL Input */}
      <UrlInput
        urlInput={urlInput}
        urls={urls}
        onUrlInputChange={(value) => {
          onUrlInputChange(value);
          onContentTouched();
        }}
        onAddUrl={onAddUrl}
        onRemoveUrl={(url) => {
          onRemoveUrl(url);
          onContentTouched();
        }}
        onUrlPaste={onUrlPaste}
        onTouchedChange={onContentTouched}
        onErrorChange={() => {}}
      />

      {/* Link Preview */}
      {(linkMetadata || isLoadingMetadata) && detectedLink && (
        <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
          {isLoadingMetadata ? (
            <div className="flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-800">
              <Loader2 size={20} className="animate-spin text-slate-400" />
              <span className="ml-2 text-sm text-slate-500">Loading preview...</span>
            </div>
          ) : linkMetadata ? (
            <GenericLinkPreview
              url={detectedLink}
              metadata={linkMetadata}
              showFullPreview={true}
            />
          ) : null}
        </div>
      )}

      {/* File Attachments */}
      <AttachmentManager
        attachments={attachments}
        onAddAttachments={(files) => {
          onAddAttachments(files);
          onContentTouched();
        }}
        onRemoveAttachment={(index) => {
          onRemoveAttachment(index);
          onContentTouched();
        }}
      />

      {/* Masonry Media Options */}
      {masonryItems.length > 0 && (
        <MasonryMediaToggle
          items={masonryItems}
          onToggle={handleMasonryToggle}
          onTitleChange={handleMasonryTitleChange}
        />
      )}
    </div>
  );
}

export default MediaManager;
