
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface ConfirmActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title: string;
  description: string;
  confirmString?: string; // If provided, user must type this
  actionLabel?: string;
  isDestructive?: boolean;
}

export const ConfirmActionModal: React.FC<ConfirmActionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmString,
  actionLabel = 'Confirm',
  isDestructive = false,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const isConfirmDisabled = confirmString ? inputValue !== confirmString : false;

  const handleConfirm = async () => {
    if (isConfirmDisabled) return;
    setIsProcessing(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={() => !isProcessing && onClose()}
      />
      
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 animate-in zoom-in-95 duration-200">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${isDestructive ? 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400' : 'bg-slate-100 text-slate-600'}`}>
          <AlertTriangle size={24} />
        </div>

        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{title}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
          {description}
        </p>

        {confirmString && (
          <div className="mb-6">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
              Type <span className="text-slate-900 dark:text-white select-all">"{confirmString}"</span> to confirm
            </label>
            <input 
              className="w-full px-4 py-2 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-red-500 transition-colors font-mono text-sm"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={confirmString}
            />
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button 
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleConfirm}
            disabled={isConfirmDisabled || isProcessing}
            className={`
              flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold text-white shadow-sm transition-all
              ${isDestructive 
                ? 'bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed' 
                : 'bg-primary-500 hover:bg-primary-600 disabled:opacity-50'
              }
            `}
          >
            {isProcessing && <Loader2 size={16} className="animate-spin" />}
            {actionLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
