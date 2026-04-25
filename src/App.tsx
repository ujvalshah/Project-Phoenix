
import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useNavigate, useParams, useLocation } from 'react-router-dom';
import { Header } from '@/components/Header';
import { BackToTopButton } from '@/components/UI/BackToTopButton';
import { ToastContainer } from '@/components/UI/Toast';
import { ToastProvider } from '@/context/ToastContext';
import { AuthProvider } from '@/context/AuthContext';
import { FeedScrollStateProvider } from '@/context/FeedScrollStateContext';
import { VideoPlayerProvider } from '@/context/VideoPlayerContext';
import { MainLayout } from '@/components/layouts/MainLayout';
import { FilterStateProvider } from '@/context/FilterStateContext';
import { CreateNuggetModal } from '@/components/CreateNuggetModal';
import { useAuthSelector } from '@/context/AuthContext';
import { consumePendingNavigation, recordRouteStartMark } from '@/utils/routeProfiling';
import { AuthModal } from '@/components/auth/AuthModal';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AdminRoute } from '@/components/auth/AdminRoute';
import { ErrorBoundary } from '@/components/UI/ErrorBoundary';
import { PersistentVideoPlayer } from '@/components/PersistentVideoPlayer';
import { NotificationPrompt } from '@/components/NotificationPrompt';
import { LegalFooter } from '@/components/legal/LegalFooter';
import { AppChromeScrollProvider } from '@/context/AppChromeScrollContext';
import { FilterResultsProvider } from '@/context/FilterResultsContext';
import { DesktopFilterSidebarProvider } from '@/context/DesktopFilterSidebarContext';
import { MobileBottomNav } from '@/components/navigation/MobileBottomNav';

// Legacy hash URL redirect handler
// Redirects old /#/path URLs to clean /path URLs for backwards compatibility
const HashRedirect: React.FC = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    if (window.location.hash.startsWith('#/')) {
      const cleanPath = window.location.hash.slice(1); // Remove the '#'
      navigate(cleanPath, { replace: true });
    }
  }, [navigate]);
  
  return null;
};

// Redirect /article/:id → /?openArticle=:id (opens modal on homepage)
const ArticleRedirect: React.FC = () => {
  const { articleId } = useParams<{ articleId: string }>();
  return <Navigate to={`/?openArticle=${articleId}`} replace />;
};

// Lazy Load Pages
const HomePage = lazy(() => import('@/pages/HomePage').then(module => ({ default: module.HomePage })));
const CollectionsPage = lazy(() => import('@/pages/CollectionsPage').then(module => ({ default: module.CollectionsPage })));
const CollectionDetailPage = lazy(() => import('@/pages/CollectionDetailPage').then(module => ({ default: module.CollectionDetailPage })));
const MySpacePage = lazy(() => import('@/pages/MySpacePage').then(module => ({ default: module.MySpacePage })));
const AccountSettingsPage = lazy(() => import('@/pages/AccountSettingsPage').then(module => ({ default: module.AccountSettingsPage })));
const AdminPanelPage = lazy(() => 
  import('@/pages/AdminPanelPage').then(module => ({
    default: module.default || module.AdminPanelPage
  })).catch(error => {
    console.error('Failed to load AdminPanelPage:', error);
    // Return a fallback component
    return {
      default: () => (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <p className="text-red-500 mb-4">Failed to load admin panel. Please refresh the page.</p>
            <button 
              onClick={() => window.location.reload()} 
              className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
            >
              Refresh Page
            </button>
          </div>
        </div>
      )
    };
  })
);
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage').then(module => ({ default: module.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage').then(module => ({ default: module.ResetPasswordPage })));
const SavedPage = lazy(() => import('@/pages/SavedPage').then(module => ({ default: module.SavedPage })));

const LegalPage = lazy(() => import('@/pages/LegalPage').then(module => ({ default: module.LegalPage })));
const ContactPage = lazy(() => import('@/pages/ContactPage').then(module => ({ default: module.ContactPage })));
const NotificationsPage = lazy(() => import('@/pages/NotificationsPage').then(module => ({ default: module.NotificationsPage })));

const RouteTransitionProfiler: React.FC = () => {
  const location = useLocation();
  const lastPathRef = React.useRef<string | null>(null);

  useEffect(() => {
    const path = location.pathname;
    if (lastPathRef.current === path) return;
    const fromPath = lastPathRef.current;
    lastPathRef.current = path;
    if (fromPath === null) return; // Initial mount — covered by app:boot:* marks.

    const nav = consumePendingNavigation();
    // Double rAF: the first callback runs before paint; the second runs on
    // the next frame, which is the earliest we can honestly call "painted."
    let innerRaf = 0;
    const outerRaf = requestAnimationFrame(() => {
      innerRaf = requestAnimationFrame(() => {
        const paintedAt = performance.now();
        const label = path;
        if (nav) {
          try {
            performance.measure(`route:transition:${nav.fromPath}->${path}`, {
              start: nav.start,
              end: paintedAt,
            });
          } catch {
            // ignore
          }
          // Seed a start mark so pages can close the window with
          // markRouteContentReady(label) when their data lands.
          recordRouteStartMark(label, nav.start);
        }
      });
    });

    return () => {
      cancelAnimationFrame(outerRaf);
      if (innerRaf) cancelAnimationFrame(innerRaf);
    };
  }, [location.pathname]);

  return null;
};

// Neutral shimmer: a view-mode-agnostic placeholder that does not pre-commit
// to a grid/feed/masonry shape. Pages render their own shape-matched skeleton
// once their chunk loads, so this fallback only needs to prove "something is
// happening" without flashing a conflicting layout.
const RouteFallbackSkeleton: React.FC = () => (
  <div className="mx-auto w-full max-w-[1800px] px-4 lg:px-6 pt-20 lg:pt-24 pb-12">
    <div className="mb-5 h-10 w-64 rounded-xl bg-slate-200/80 dark:bg-slate-800/70 animate-pulse" />
    <div className="flex flex-col gap-4">
      <div className="h-24 rounded-2xl bg-slate-200/70 dark:bg-slate-800/60 animate-pulse" />
      <div className="h-24 rounded-2xl bg-slate-200/60 dark:bg-slate-800/50 animate-pulse" />
      <div className="h-24 rounded-2xl bg-slate-200/50 dark:bg-slate-800/40 animate-pulse" />
    </div>
  </div>
);

const AppContent: React.FC = () => {
  const [isDark, setIsDark] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'masonry'>('grid');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Use Auth hook for user context
  const currentUserId = useAuthSelector((a) => a.user?.id || '');

  useEffect(() => {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) setIsDark(true);
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    if (isDark) html.classList.add('dark');
    else html.classList.remove('dark');
  }, [isDark]);

  useEffect(() => {
    const openCreate = () => setIsCreateOpen(true);
    window.addEventListener('nuggets:open-create-modal', openCreate);
    return () => window.removeEventListener('nuggets:open-create-modal', openCreate);
  }, []);

  return (
    <>
      {/* Handle legacy hash URLs (e.g., /#/collections → /collections) */}
      <HashRedirect />
      <RouteTransitionProfiler />
      
      {/* 
        LAYOUT INVARIANT:
        Fixed headers do not reserve space.
        All fixed/sticky elements require explicit spacers.
        
        Global invariant:
        Header is rendered exactly once here.
        Do NOT render Header in layouts or pages.
        
        ARCHITECTURAL INVARIANT: Header Rendering
        Header MUST be rendered OUTSIDE MainLayout to prevent layout instability.
        Header is fixed positioned and must NOT be a child of flex/grid containers.
        This ensures Header position is never affected by:
        - Content loading states
        - Empty states
        - Filter changes
        - Route transitions
        - Flex/grid recalculations
        
        Header height: h-14 (56px) mobile, h-16 (64px) desktop.
        On narrow viewports, scroll &gt; 50px hides the header bar; category rail pins to top (PageStack).
        HeaderSpacer MUST be used in PageStack to reserve this space.
      */}
      <FilterResultsProvider>
      <AppChromeScrollProvider>
      <Header
        isDark={isDark}
        toggleTheme={() => setIsDark(!isDark)}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        viewMode={viewMode}
        setViewMode={setViewMode}
        onCreateNugget={() => setIsCreateOpen(true)}
      />

      <MainLayout>
        {/* 
          Suspense fallback must NOT use min-h-screen to prevent layout shifts.
          It should only provide visual feedback without affecting layout structure.
        */}
        <Suspense fallback={<RouteFallbackSkeleton />}>
          <Routes>
          {/* Feed/Content Areas - Wrapped in Error Boundaries */}
          <Route path="/" element={
            <ErrorBoundary>
              <HomePage viewMode={viewMode} />
            </ErrorBoundary>
          } />
          
          {/* Feed Routes - Redirected to home (feed layout feature removed) */}
          <Route path="/feed" element={<Navigate to="/" replace />} />
          <Route path="/feed/:articleId" element={<Navigate to="/" replace />} />
          
          <Route path="/collections" element={
            <ErrorBoundary>
              <CollectionsPage />
            </ErrorBoundary>
          } />
          <Route path="/collections/:collectionId" element={
            <ErrorBoundary>
              <CollectionDetailPage />
            </ErrorBoundary>
          } />

          {/* Bookmarks - Protected */}
          <Route path="/bookmarks" element={
            <ProtectedRoute>
              <SavedPage />
            </ProtectedRoute>
          } />

          {/* My Space (Current User) - Protected */}
          <Route path="/myspace" element={
            <ProtectedRoute>
              <Navigate to={`/profile/${currentUserId}`} replace />
            </ProtectedRoute>
          } />
          
          {/* Profile Page (Handles both My Space and Public Profiles) */}
          <Route path="/profile/:userId" element={<MySpacePage currentUserId={currentUserId} />} />
          
          <Route path="/account" element={
            <ProtectedRoute>
              <AccountSettingsPage userId={currentUserId} />
            </ProtectedRoute>
          } />

          {/* Admin Route with Wildcard for nested routing */}
          <Route path="/admin/*" element={
            <ProtectedRoute>
              <AdminPanelPage />
            </ProtectedRoute>
          } />

          {/* Redirect old batch import route to home (backwards compatible) */}
          <Route path="/bulk-create" element={<Navigate to="/" replace />} />

          {/* Redirect old YT Analysis route to home */}
          <Route path="/youtube-analysis" element={<Navigate to="/" replace />} />

          {/* Auth Routes - Wrapped in Error Boundary */}
          <Route path="/verify-email" element={<Navigate to="/" replace />} />
          <Route path="/forgot-password" element={
            <ErrorBoundary>
              <ForgotPasswordPage />
            </ErrorBoundary>
          } />
          <Route path="/reset-password" element={
            <ErrorBoundary>
              <ResetPasswordPage />
            </ErrorBoundary>
          } />

          {/* Notifications page — full notification history */}
          <Route path="/notifications" element={
            <ProtectedRoute>
              <ErrorBoundary>
                <NotificationsPage />
              </ErrorBoundary>
            </ProtectedRoute>
          } />

          {/* Article detail — redirect to home with modal overlay */}
          <Route path="/article/:articleId" element={<ArticleRedirect />} />

          {/* Legal pages — /legal/privacy, /legal/terms, etc. */}
          <Route path="/legal/:slug" element={
            <ErrorBoundary>
              <LegalPage />
            </ErrorBoundary>
          } />

          {/* Contact page */}
          <Route path="/contact" element={
            <ErrorBoundary>
              <ContactPage />
            </ErrorBoundary>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        
        <BackToTopButton />
        <ToastContainer />
        <PersistentVideoPlayer />
        <NotificationPrompt />
        
        <CreateNuggetModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
        <AuthModal />
      </MainLayout>
      <MobileBottomNav />
      <LegalFooter />
      </AppChromeScrollProvider>
      </FilterResultsProvider>
    </>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <VideoPlayerProvider>
            <FeedScrollStateProvider>
              <FilterStateProvider>
                <DesktopFilterSidebarProvider>
                  <AppContent />
                </DesktopFilterSidebarProvider>
              </FilterStateProvider>
            </FeedScrollStateProvider>
          </VideoPlayerProvider>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
};

export default App;
