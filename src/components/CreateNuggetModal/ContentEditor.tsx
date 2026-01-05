import React from 'react';
import { RichTextEditor } from '../RichTextEditor';
import { isImageFile } from '@/utils/imageOptimizer';

interface ContentEditorProps {
  value: string;
  onChange: (value: string) => void;
  isAiLoading: boolean; // Kept for backward compatibility but unused
  onAiSummarize: () => void; // Kept for backward compatibility but unused
  onImagePaste?: (file: File) => void;
  error?: string | null;
  warning?: string | null;
  onTouchedChange?: (touched: boolean) => void;
  onErrorChange?: (error: string | null) => void;
}

export function ContentEditor({
  value,
  onChange,
  isAiLoading: _isAiLoading, // Unused - kept for backward compatibility
  onAiSummarize: _onAiSummarize, // Unused - kept for backward compatibility
  onImagePaste,
  error,
  warning,
  onTouchedChange,
  onErrorChange,
}: ContentEditorProps) {
  const handleChange = (newContent: string) => {
    onChange(newContent);
    if (onTouchedChange) onTouchedChange(true);
    if (onErrorChange && error) {
      // Clear error when user types
      onErrorChange(null);
    }
  };

  return (
    <div className="relative group/editor">
      {/* AI Summarize button removed - AI creation system has been fully removed */}

      <RichTextEditor
        value={value}
        onChange={handleChange}
        placeholder="Share an insight, observation, or paste content... (You can also paste images directly here)"
        className="min-h-[120px]"
        onImagePaste={(file) => {
          if (isImageFile(file) && onImagePaste) {
            onImagePaste(file);
          }
        }}
      />
      {error && (
        <div className="text-[10px] text-red-700 dark:text-red-400 font-medium mt-1">
          {error}
        </div>
      )}
      {warning && (
        <div className="text-[10px] text-amber-600 dark:text-amber-400 italic mt-1">
          {warning}
        </div>
      )}
    </div>
  );
}












