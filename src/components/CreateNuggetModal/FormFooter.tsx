import React, { useCallback } from 'react';
import { Paperclip, Layers, Check, Loader2 } from 'lucide-react';

interface FormFooterProps {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBulkCreate: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  canSubmit: boolean;
}

export const FormFooter = React.memo(function FormFooter({
  fileInputRef,
  onFileSelect,
  onBulkCreate,
  onSubmit,
  isSubmitting,
  canSubmit,
}: FormFooterProps) {
  const handleAttachClick = useCallback(() => {
    fileInputRef.current?.click();
  }, [fileInputRef]);

  return (
    <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 z-20 shrink-0">
      <div className="flex items-center gap-3">
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          multiple
          accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          onChange={onFileSelect}
        />
        <button
          onClick={handleAttachClick}
          className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-colors text-xs font-bold border border-slate-200 dark:border-slate-700"
          title="Attach files"
        >
          <Paperclip size={16} />
          Attach
        </button>
        <span className="text-[10px] text-slate-400 hidden sm:inline-block font-medium">
          Max 1MB
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onBulkCreate}
          className="text-slate-500 hover:text-slate-900 dark:hover:text-white text-xs font-bold flex items-center gap-1.5 mr-2"
          title="Bulk Import"
        >
          <Layers size={14} />
          <span>Bulk Create</span>
        </button>

        <button
          onClick={onSubmit}
          disabled={isSubmitting || !canSubmit}
          className={`px-6 py-2 rounded-lg text-xs font-bold text-slate-900 transition-all shadow-sm flex items-center gap-2 ${
            isSubmitting || !canSubmit
              ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
              : 'bg-primary-500 hover:bg-primary-400 active:scale-95 text-slate-900'
          }`}
        >
          {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} strokeWidth={3} />}
          Post Nugget
        </button>
      </div>
    </div>
  );
});

