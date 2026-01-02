import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Flag, AlertTriangle, Info, ShieldAlert, FileWarning, HelpCircle } from 'lucide-react';

export type ReportReasonCode = 'spam' | 'misleading' | 'abusive' | 'copyright' | 'other';

export interface ReportPayload {
  articleId: string;
  reason: ReportReasonCode;
  comment?: string;
}

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: ReportPayload) => Promise<void>;
  articleId: string;
}

const REASONS: { code: ReportReasonCode; label: string; icon: React.ReactNode }[] = [
  { code: 'spam', label: 'Spam or promotional', icon: <AlertTriangle size={16} /> },
  { code: 'misleading', label: 'Misleading or false information', icon: <FileWarning size={16} /> },
  { code: 'abusive', label: 'Inappropriate or abusive content', icon: <ShieldAlert size={16} /> },
  { code: 'copyright', label: 'Copyright or ownership issue', icon: <Info size={16} /> },
  { code: 'other', label: 'Other', icon: <HelpCircle size={16} /> },
];

export const ReportModal: React.FC<ReportModalProps> = ({ isOpen, onClose, onSubmit, articleId }) => {
  const [selectedReason, setSelectedReason] = useState<ReportReasonCode | null>(null);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setSelectedReason(null);
      setComment('');
      setError(null);
      setIsSubmitting(false);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = async () => {
    if (!selectedReason) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        articleId,
        reason: selectedReason,
        comment: comment.trim()
      });
      onClose();
    } catch (err) {
      setError("Something went wrong. Please try again.");
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
          e.stopPropagation();
          onClose();
      }}
    >
      <div 
        ref={modalRef}
        className="
          w-full max-w-[380px] bg-white/90 dark:bg-slate-900/90 backdrop-blur-md 
          rounded-2xl shadow-2xl border border-white/60 dark:border-slate-800 
          overflow-hidden animate-in zoom-in-95 duration-200
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-500">
            <Flag size={20} fill="currentColor" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Report nugget</h2>
          </div>
          <button 
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            type="button"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Help us keep the community safe. Why are you reporting this?
          </p>

          {/* Reasons List */}
          <div className="space-y-2 mb-4">
            {REASONS.map((r) => (
              <label 
                key={r.code}
                className={`
                  flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border
                  ${selectedReason === r.code 
                    ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' 
                    : 'bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-800'
                  }
                `}
              >
                <input 
                  type="radio" 
                  name="reportReason" 
                  value={r.code}
                  checked={selectedReason === r.code}
                  onChange={() => setSelectedReason(r.code)}
                  className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                />
                <div className={`text-sm font-medium ${selectedReason === r.code ? 'text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-300'}`}>
                  {r.label}
                </div>
              </label>
            ))}
          </div>

          {/* Optional Comment */}
          <div className="space-y-1.5 mb-4">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Optional comment</label>
            <textarea 
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add specific details..."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-black/20 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 min-h-[80px] resize-none dark:text-white placeholder:text-slate-400"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Privacy Hint */}
          <div className="flex gap-2 items-start text-[11px] text-slate-400 dark:text-slate-500 mb-1">
            <Info size={14} className="shrink-0 mt-0.5" />
            <p>Reports are confidential. Your identity is not shown to the author.</p>
          </div>

          {/* Error Message */}
          {error && (
            <p className="text-xs text-red-500 font-medium mt-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
          <button 
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors"
            type="button"
          >
            Cancel
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); handleSubmit(); }}
            disabled={!selectedReason || isSubmitting}
            className="
              px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-xl shadow-sm hover:bg-blue-700 
              disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95
            "
            type="button"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Report'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};


