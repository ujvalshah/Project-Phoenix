import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MessageSquare, X, Send, Loader2, Check } from 'lucide-react';
import { adminFeedbackService } from '@/admin/services/adminFeedbackService';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [email, setEmail] = useState('');
  const { currentUser } = useAuth();
  const toast = useToast();

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim()) return;
    
    setIsSubmitting(true);
    try {
      await adminFeedbackService.submitFeedback(
        feedback.trim(),
        'general',
        currentUser ? {
          id: currentUser.id,
          name: currentUser.name,
          email: currentUser.email,
          avatarUrl: currentUser.avatarUrl
        } : undefined,
        !currentUser ? email : undefined
      );
      
      setIsSent(true);
      toast.success('Feedback submitted successfully!');
      
      // Close after success message
      setTimeout(() => {
          onClose();
          // Reset form after close animation
          setTimeout(() => {
              setIsSent(false);
              setFeedback('');
              setEmail('');
          }, 300);
      }, 2000);
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      toast.error('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[105] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px] animate-in fade-in duration-300" 
        onClick={onClose}
      />

      {/* Glassy Modal */}
      <div className="relative w-full max-w-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-2xl rounded-2xl p-6 animate-in zoom-in-95 slide-in-from-bottom-2 duration-300">
        
        {/* Close Button */}
        <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
        >
            <X size={18} />
        </button>

        {isSent ? (
            <div className="flex flex-col items-center justify-center py-8 text-center animate-in fade-in slide-in-from-bottom-2">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mb-4 shadow-sm">
                    <Check size={24} strokeWidth={3} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Thanks for sharing!</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm">Your feedback helps us make Nuggets better.</p>
            </div>
        ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <MessageSquare size={20} className="text-primary-500" />
                        Share Feedback
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Spot a bug? Have a suggestion? Let us know.
                    </p>
                </div>

                <div className="space-y-3">
                    <textarea 
                        autoFocus
                        className="w-full h-32 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all resize-none placeholder:text-slate-400 dark:text-white"
                        placeholder="I think it would be cool if..."
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                    />
                    
                    {!currentUser && (
                        <input 
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all dark:text-white"
                            placeholder="Email (optional)"
                        />
                    )}
                </div>

                <div className="flex gap-3 pt-2">
                    <button 
                        type="button" 
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        type="submit"
                        disabled={!feedback.trim() || isSubmitting}
                        className="flex-[2] px-4 py-2.5 rounded-xl text-sm font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition-all shadow-lg shadow-primary-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <>Submit <Send size={16} /></>}
                    </button>
                </div>
            </form>
        )}
      </div>
    </div>,
    document.body
  );
};

export const FeedbackButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="
            fixed right-0 top-1/2 -translate-y-1/2 z-[90] 
            group flex items-center gap-2 
            pl-3 pr-4 py-3 
            bg-white/80 dark:bg-slate-900/80 backdrop-blur-md 
            border-l border-t border-b border-slate-200/60 dark:border-slate-700/60
            rounded-l-2xl shadow-lg hover:shadow-xl
            transition-all duration-300 ease-out
            translate-x-[calc(100%-48px)] hover:translate-x-0
        "
        aria-label="Share Feedback"
      >
        <MessageSquare size={20} className="text-slate-600 dark:text-slate-300 shrink-0" />
        <span className="text-xs font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-75">
            Feedback
        </span>
        
        {/* Subtle indicator strip */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 bg-primary-500 rounded-r-full opacity-50 group-hover:opacity-100 transition-opacity" />
      </button>

      <FeedbackModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
};


