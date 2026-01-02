import React from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { RichTextEditor } from '../RichTextEditor';
import { isImageFile } from '@/utils/imageOptimizer';

interface ContentEditorProps {
  value: string;
  onChange: (value: string) => void;
  isAiLoading: boolean;
  onAiSummarize: () => void;
  onImagePaste?: (file: File) => void;
  error?: string | null;
  warning?: string | null;
  onTouchedChange?: (touched: boolean) => void;
  onErrorChange?: (error: string | null) => void;
}

export function ContentEditor({
  value,
  onChange,
  isAiLoading,
  onAiSummarize,
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
      <div className="flex justify-end mb-2">
        <button
          onClick={onAiSummarize}
          disabled={isAiLoading || !value}
          className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all
            ${isAiLoading
              ? 'bg-slate-100 text-slate-400 dark:bg-slate-800'
              : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white shadow-md hover:shadow-lg hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100'
            }
          `}
        >
          {isAiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} fill="currentColor" />}
          {isAiLoading ? 'Analyzing...' : 'AI Summarize'}
        </button>
      </div>

      <RichTextEditor
        value={value}
        onChange={handleChange}
        placeholder="Share an insight, observation, or paste a long article to summarize... (You can also paste images directly here)"
        className={`min-h-[120px] transition-opacity duration-300 ${isAiLoading ? 'opacity-50 pointer-events-none' : ''}`}
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












