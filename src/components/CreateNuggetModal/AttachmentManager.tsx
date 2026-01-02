import React, { useCallback } from 'react';
import { X, Globe, FileText } from 'lucide-react';
import { Image } from '../Image';

export interface FileAttachment {
  file: File;
  previewUrl: string; // Temporary preview URL (URL.createObjectURL) - NOT persisted
  type: 'image' | 'document';
  embeddedUrl?: string;
  // CRITICAL: Media ID from MongoDB after upload to Cloudinary
  // This is the ONLY persistent reference. previewUrl is temporary.
  mediaId?: string;
  secureUrl?: string; // Cloudinary URL after upload
  uploadError?: string; // Error message if upload failed
  isUploading?: boolean; // Upload in progress
}

interface AttachmentManagerProps {
  attachments: FileAttachment[];
  onAttachmentsChange: (attachments: FileAttachment[]) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onError?: (error: string) => void;
}

export const AttachmentManager = React.memo(function AttachmentManager({
  attachments,
  onAttachmentsChange,
  onFileSelect,
  onError,
}: AttachmentManagerProps) {

  const removeAttachment = useCallback((index: number) => {
    onAttachmentsChange(attachments.filter((_, i) => i !== index));
  }, [attachments, onAttachmentsChange]);

  const updateAttachmentEmbeddedUrl = useCallback((index: number, url: string | undefined) => {
    onAttachmentsChange(
      attachments.map((a, i) => (i === index ? { ...a, embeddedUrl: url } : a))
    );
  }, [attachments, onAttachmentsChange]);

  const handleEmbedUrl = useCallback((index: number, currentUrl?: string) => {
    const url = prompt('Enter URL to embed on this image:', currentUrl || '');
    if (url !== null) {
      if (url.trim() === '') {
        updateAttachmentEmbeddedUrl(index, undefined);
      } else {
        try {
          new URL(url);
          updateAttachmentEmbeddedUrl(index, url.trim());
        } catch {
          if (onError) onError('Please enter a valid URL');
        }
      }
    }
  }, [updateAttachmentEmbeddedUrl, onError]);

  if (attachments.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
      {attachments.map((att, idx) => (
        <div key={idx} className="relative group shrink-0 w-20 h-20 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-800">
          {att.type === 'image' ? (
            <>
              {att.isUploading ? (
                <div className="w-full h-full flex items-center justify-center bg-slate-200 dark:bg-slate-800">
                  <div className="text-[8px] text-slate-500">Uploading...</div>
                </div>
              ) : att.uploadError ? (
                <div className="w-full h-full flex items-center justify-center bg-red-100 dark:bg-red-900/20">
                  <div className="text-[8px] text-red-600 dark:text-red-400 text-center px-1">Error</div>
                </div>
              ) : att.secureUrl ? (
                <Image src={att.secureUrl} className="w-full h-full object-cover" />
              ) : (
                <Image src={att.previewUrl} className="w-full h-full object-cover" />
              )}
              {att.embeddedUrl && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[8px] px-1 py-0.5 truncate">
                  {new URL(att.embeddedUrl).hostname}
                </div>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleEmbedUrl(idx, att.embeddedUrl);
                }}
                className="absolute top-0.5 left-0.5 bg-black/50 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                title={att.embeddedUrl ? 'Edit embedded URL' : 'Add URL to image'}
              >
                <Globe size={10} />
              </button>
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-1">
              <FileText size={20} />
              <span className="text-[8px] truncate w-full text-center mt-1">{att.file.name}</span>
            </div>
          )}
          <button
            onClick={() => removeAttachment(idx)}
            className="absolute top-0.5 right-0.5 bg-black/50 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
          >
            <X size={10} />
          </button>
        </div>
      ))}
    </div>
  );
});

