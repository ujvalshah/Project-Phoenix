import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  LayoutGrid,
  Columns,
  Mail,
  User as UserIcon,
  BookOpen,
  Settings,
  Shield,
  LogOut,
  LogIn,
  Loader2,
  X,
  MessageSquare,
  Send,
  CheckCircle2,
} from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { getOverlayHost } from '@/utils/overlayHosts';
import {
  HEADER_PERF_SURFACES,
  headerPerfSurfaceReady,
  markNavDrawerInteractive,
} from '@/dev/perfMarks';

export interface NavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  isAuthenticated: boolean;
  currentUser: { id?: string; name?: string; email?: string; avatarUrl?: string } | null | undefined;
  isAdmin: boolean;
  logout: () => Promise<void> | void;
  isLoggingOut: boolean;
  openAuthModal: () => void;
  viewMode: 'grid' | 'masonry';
  setViewMode: (mode: 'grid' | 'masonry') => void;
}

interface DrawerFeedbackFormProps {
  isAuthenticated: boolean;
  currentUser?: { id?: string; name?: string; email?: string; avatarUrl?: string } | null;
}

const DrawerFeedbackForm: React.FC<DrawerFeedbackFormProps> = ({ isAuthenticated, currentUser }) => {
  const [feedback, setFeedback] = useState('');
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);
  const toast = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!feedback.trim()) return;

    setIsSending(true);
    try {
      const feedbackUser =
        currentUser?.id && currentUser?.name
          ? {
              id: currentUser.id,
              name: currentUser.name,
              email: currentUser.email,
              avatarUrl: currentUser.avatarUrl,
            }
          : undefined;

      const { adminFeedbackService } = await import('@/admin/services/adminFeedbackService');
      await adminFeedbackService.submitFeedback(
        feedback.trim(),
        'general',
        feedbackUser,
        !feedbackUser ? email : undefined,
      );

      setSent(true);
      toast.success('Feedback sent!');

      setTimeout(() => {
        setSent(false);
        setFeedback('');
        setEmail('');
      }, 3000);
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      toast.error('Failed to send feedback. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  if (sent) {
    return (
      <div className="mx-3 my-2 flex h-32 items-center justify-center gap-2 rounded-xl border border-green-100 bg-green-50 p-4 text-center text-xs font-bold text-green-600 animate-in fade-in dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
        <CheckCircle2 size={24} />
        <div>
          Thanks for your thoughts! <br /> We read every message.
        </div>
      </div>
    );
  }

  return (
    <div
      className="mx-3 my-4 rounded-xl border border-yellow-100/50 bg-yellow-50/40 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/25"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-yellow-700 dark:text-amber-200/90">
        <MessageSquare size={12} className="text-yellow-500 dark:text-amber-400" /> Feedback
      </p>
      <p className="mb-3 text-xs leading-relaxed text-gray-500 dark:text-slate-400">
        Have an idea? Send suggestions directly to us.
      </p>
      <form onSubmit={handleSubmit} className="space-y-2">
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="I wish this app had..."
          className="h-24 w-full cursor-text resize-none rounded-xl border border-yellow-100 bg-white p-3 text-xs text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-amber-500/40"
          onKeyDown={(e) => e.stopPropagation()}
        />
        {!isAuthenticated && (
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Your email (optional)"
            className="w-full rounded-xl border border-yellow-100 bg-white p-2.5 text-xs text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-amber-500/40"
            onKeyDown={(e) => e.stopPropagation()}
          />
        )}
        <button
          type="submit"
          disabled={!feedback.trim() || isSending}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-yellow-200 bg-yellow-100 py-2 text-xs font-bold text-yellow-900 shadow-sm transition-all hover:bg-yellow-200 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-800/60 dark:bg-amber-900/35 dark:text-amber-100 dark:hover:bg-amber-900/55"
          onClick={(e) => e.stopPropagation()}
        >
          {isSending ? 'Sending...' : (
            <>
              <Send size={12} /> Send
            </>
          )}
        </button>
      </form>
    </div>
  );
};

const NavigationDrawer: React.FC<NavigationDrawerProps> = ({
  isOpen,
  onClose,
  isAuthenticated,
  currentUser,
  isAdmin,
  logout,
  isLoggingOut,
  openAuthModal,
  viewMode,
  setViewMode,
}) => {
  const [isMounted, setIsMounted] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);
  const drawerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Single rAF batches mount + visible so the drawer enters one frame earlier than nested rAF
      // (same CSS transition; less idle time before headerPerfSurfaceReady).
      const outerRaf = requestAnimationFrame(() => {
        setIsMounted(true);
        setIsVisible(true);
      });
      return () => {
        cancelAnimationFrame(outerRaf);
      };
    }
    const rafHide = requestAnimationFrame(() => setIsVisible(false));
    const t = window.setTimeout(() => setIsMounted(false), 250);
    return () => {
      cancelAnimationFrame(rafHide);
      window.clearTimeout(t);
    };
  }, [isOpen]);

  const handleTransitionEnd = (event: React.TransitionEvent<HTMLDivElement>) => {
    if (event.target !== drawerRef.current) return;
    if (event.propertyName !== 'transform') return;
    if (!isOpen) setIsMounted(false);
  };

  const drawerVisualOpen = Boolean(isMounted && isVisible && isOpen);
  const navDrawerPerfOnceRef = useRef(false);
  useLayoutEffect(() => {
    if (!drawerVisualOpen || typeof document === 'undefined') return;
    if (navDrawerPerfOnceRef.current) return;
    navDrawerPerfOnceRef.current = true;
    headerPerfSurfaceReady(HEADER_PERF_SURFACES.NAV_DRAWER, {
      phase: 'mounted-visible-open',
    });
  }, [drawerVisualOpen]);

  useEffect(() => {
    if (!drawerVisualOpen) return;
    let cancelled = false;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled) return;
        markNavDrawerInteractive();
      });
    });
    return () => {
      cancelled = true;
    };
  }, [drawerVisualOpen]);

  if (!isMounted) return null;
  if (typeof document === 'undefined') return null;

  const state = isVisible && isOpen ? 'open' : 'closed';

  return createPortal(
    <div
      className={`fixed inset-0 ${state === 'open' ? 'pointer-events-auto' : 'pointer-events-none'}`}
      data-state={state}
    >
      <div
        data-state={state}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none data-[state=closed]:pointer-events-none data-[state=closed]:opacity-0 data-[state=open]:pointer-events-auto data-[state=open]:opacity-100"
        onClick={onClose}
      />
      <div
        ref={drawerRef}
        data-state={state}
        onTransitionEnd={handleTransitionEnd}
        role="dialog"
        aria-modal="true"
        className="absolute bottom-0 left-0 top-0 flex w-[280px] flex-col border-r border-gray-200 bg-white shadow-2xl transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform motion-reduce:transition-none data-[state=closed]:pointer-events-none data-[state=closed]:-translate-x-full data-[state=closed]:opacity-0 data-[state=open]:pointer-events-auto data-[state=open]:translate-x-0 data-[state=open]:opacity-100 dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 p-5 dark:border-slate-800 dark:bg-slate-900/95">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-400 text-sm font-bold text-gray-900 shadow-sm">
              N
            </div>
            <span className="truncate text-lg font-bold text-gray-900 dark:text-slate-100">Nuggets</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <div className="hide-scrollbar-mobile flex-1 space-y-1 overflow-y-auto px-3 py-4">
          <p className="px-4 pb-2 pt-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
            Feed layout
          </p>
          <div className="grid grid-cols-3 gap-2 px-3">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-bold transition-colors ${
                viewMode === 'grid'
                  ? 'border-primary-300 bg-primary-50 text-gray-900 dark:border-primary-700 dark:bg-primary-900/20 dark:text-white'
                  : 'border-gray-100 bg-white text-gray-600 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              <LayoutGrid size={18} />
              Grid
            </button>
            <button
              type="button"
              onClick={() => setViewMode('masonry')}
              className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-bold transition-colors ${
                viewMode === 'masonry'
                  ? 'border-primary-300 bg-primary-50 text-gray-900 dark:border-primary-700 dark:bg-primary-900/20 dark:text-white'
                  : 'border-gray-100 bg-white text-gray-600 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              <Columns size={18} />
              Masonry
            </button>
          </div>

          {!isAuthenticated && (
            <>
              <div className="mx-4 my-2 h-px bg-gray-100 dark:bg-slate-800" />
              <Link
                to="/contact"
                onClick={onClose}
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-100 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Mail size={18} /> Contact Us
              </Link>
            </>
          )}

          {isAuthenticated && (
            <>
              <div className="mx-4 my-2 h-px bg-gray-100 dark:bg-slate-800" />
              <p className="px-4 pb-2 pt-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                Personal
              </p>
              <Link
                to={`/profile/${currentUser?.id || ''}`}
                onClick={onClose}
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-100 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <UserIcon size={18} /> Workspace
              </Link>
              <Link
                to="/bookmarks"
                onClick={onClose}
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-100 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <BookOpen size={18} /> Bookmarks
              </Link>
              <Link
                to="/account"
                onClick={onClose}
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-100 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Settings size={18} /> Settings
              </Link>
              <Link
                to="/contact"
                onClick={onClose}
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-100 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Mail size={18} /> Contact Us
              </Link>
            </>
          )}

          {isAdmin && (
            <>
              <div className="mx-4 my-2 h-px bg-gray-100 dark:bg-slate-800" />
              <p className="px-4 pb-2 pt-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                Admin
              </p>
              <Link
                to="/admin"
                onClick={onClose}
                className="mb-1 flex items-center gap-3 rounded-xl bg-gray-900 px-4 py-3 text-sm font-bold text-white shadow-md ring-1 ring-black/5 dark:bg-slate-950 dark:text-white dark:ring-slate-600"
              >
                <Shield size={18} /> Admin Panel
              </Link>
            </>
          )}

          <div className="mx-4 my-4 h-px bg-gray-100 dark:bg-slate-800" />

          <DrawerFeedbackForm isAuthenticated={isAuthenticated} currentUser={currentUser} />
        </div>

        <div className="border-t border-gray-100 bg-gray-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/95">
          {isAuthenticated ? (
            <button
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
                await logout();
              }}
              disabled={isLoggingOut}
              aria-busy={isLoggingOut}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-red-600 shadow-sm transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-red-400 dark:hover:bg-red-950/35"
            >
              {isLoggingOut ? <Loader2 size={18} className="animate-spin" /> : <LogOut size={18} />}
              {isLoggingOut ? 'Signing out…' : 'Sign Out'}
            </button>
          ) : (
            <button
              onClick={() => {
                openAuthModal();
                onClose();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 px-4 py-3 text-sm font-bold text-gray-900 shadow-lg shadow-yellow-400/20 transition-transform hover:scale-[1.02] dark:bg-primary-400 dark:text-gray-900 dark:shadow-primary-900/30"
            >
              <LogIn size={18} /> Sign In
            </button>
          )}
        </div>
      </div>
    </div>,
    getOverlayHost('drawer'),
  );
};

export { NavigationDrawer };
export default NavigationDrawer;
