import React, { useEffect, useState, useRef } from 'react';
import { useToastContext, Toast as ToastType } from '@/context/ToastContext';
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from 'lucide-react';

const ToastItem: React.FC<{ toast: ToastType; onRemove: (id: string) => void }> = ({ toast, onRemove }) => {
  const [isPaused, setIsPaused] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  
  // Default durations: 2.5s for success/info, 5s for error/warning
  const duration = toast.duration || (toast.type === 'error' || toast.type === 'warning' ? 5000 : 2500);
  
  const timeRef = useRef(duration);
  const timerRef = useRef<number | undefined>(undefined);
  const lastStartRef = useRef<number>(0);

  // Trigger entrance animation
  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));
  }, []);

  // Timer Logic with Pause/Resume
  useEffect(() => {
    if (isPaused) {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      return;
    }

    lastStartRef.current = Date.now();
    
    timerRef.current = window.setTimeout(() => {
      setIsVisible(false); // Trigger exit animation
      setTimeout(() => onRemove(toast.id), 300); // Wait for animation
    }, timeRef.current);

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [isPaused, toast.id, onRemove]);

  const handleMouseEnter = () => {
    setIsPaused(true);
    const elapsed = Date.now() - lastStartRef.current;
    timeRef.current = Math.max(0, timeRef.current - elapsed);
  };

  const handleMouseLeave = () => {
    setIsPaused(false);
  };

  const handleAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (toast.onAction) toast.onAction();
    setIsVisible(false);
    setTimeout(() => onRemove(toast.id), 300);
  };

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`
        pointer-events-auto 
        w-full max-w-[360px] 
        flex items-center gap-3 
        p-3.5 
        bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl
        border border-slate-200/50 dark:border-slate-700/50
        rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-black/50
        transition-all duration-500 ease-out
        ${isVisible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-4 opacity-0 scale-95'}
      `}
      role="alert"
    >
      {/* Icon */}
      <div className="shrink-0 flex items-center">
        {toast.type === 'success' && <CheckCircle2 size={20} className="text-green-600 dark:text-green-400" />}
        {toast.type === 'error' && <AlertCircle size={20} className="text-red-600 dark:text-red-400" />}
        {toast.type === 'warning' && <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400" />}
        {toast.type === 'info' && <Info size={20} className="text-blue-600 dark:text-blue-400" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
          {toast.title}
        </h4>
        {toast.description && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight line-clamp-1">
            {toast.description}
          </p>
        )}
      </div>

      {/* Action Button - High Contrast Style */}
      {toast.actionLabel && (
        <button
          onClick={handleAction}
          className="shrink-0 text-xs font-bold text-white dark:text-slate-900 bg-slate-900 dark:bg-white border border-transparent px-3 py-1.5 rounded-lg hover:opacity-90 transition-all shadow-sm whitespace-nowrap active:scale-95"
        >
          {toast.actionLabel}
        </button>
      )}

      {/* Close Button */}
      <button 
        onClick={() => {
            setIsVisible(false);
            setTimeout(() => onRemove(toast.id), 300);
        }}
        className="shrink-0 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  );
};

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastContext();

  return (
    <div className="fixed z-[100] inset-x-0 bottom-0 p-4 pointer-events-none flex flex-col items-center sm:items-end gap-3 sm:bottom-6 sm:right-6">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  );
};


