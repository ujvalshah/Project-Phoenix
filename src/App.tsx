
import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { BackToTopButton } from '@/components/UI/BackToTopButton';
import { ToastContainer } from '@/components/UI/Toast';
import { ToastProvider } from '@/context/ToastContext';
import { AuthProvider } from '@/context/AuthContext';
import { FeedScrollStateProvider } from '@/context/FeedScrollStateContext';
import { MainLayout } from '@/components/layouts/MainLayout';
import { SortOrder } from '@/types';
import { Loader2 } from 'lucide-react';
import { CreateNuggetModal } from '@/components/CreateNuggetModal';
import { useAuth } from '@/hooks/useAuth';
import { AuthModal } from '@/components/auth/AuthModal';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { LegalPageRenderer } from '@/pages/LegalPageRenderer';
import { ErrorBoundary } from '@/components/UI/ErrorBoundary';

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

// Lazy Load Pages
const HomePage = lazy(() => import('@/pages/HomePage').then(module => ({ default: module.HomePage })));
const FeedLayoutPage = lazy(() => import('@/pages/FeedLayoutPage').then(module => ({ default: module.default || module.FeedLayoutPage })));
const ArticleDetailPage = lazy(() => import('@/pages/ArticleDetail').then(module => ({ default: module.ArticleDetailPage })));
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
const VerifyEmailPage = lazy(() => import('@/pages/VerifyEmailPage').then(module => ({ default: module.VerifyEmailPage })));
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage').then(module => ({ default: module.ResetPasswordPage })));
const BulkCreateNuggetsPage = lazy(() => import('@/pages/BulkCreateNuggetsPage').then(module => ({ default: module.BulkCreateNuggetsPage })));
const BulkYouTubeAnalysisPage = lazy(() => import('@/pages/BulkYouTubeAnalysisPage').then(module => ({ default: module.BulkYouTubeAnalysisPage })));

const AppContent: React.FC = () => {
  const [isDark, setIsDark] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'feed' | 'masonry' | 'utility'>('grid');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('latest');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Use Auth hook for user context
  const { currentUserId } = useAuth();

  useEffect(() => {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) setIsDark(true);
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    if (isDark) html.classList.add('dark');
    else html.classList.remove('dark');
  }, [isDark]);

  return (
    <>
      {/* Handle legacy hash URLs (e.g., /#/collections → /collections) */}
      <HashRedirect />
      
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
        
        Header height: h-14 (56px) mobile, h-16 (64px) desktop
        HeaderSpacer MUST be used in PageStack to reserve this space.
      */}
      <Header 
        isDark={isDark} 
        toggleTheme={() => setIsDark(!isDark)} 
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        viewMode={viewMode}
        setViewMode={setViewMode}
        selectedCategories={selectedCategories}
        setSelectedCategories={setSelectedCategories}
        selectedTag={selectedTag}
        setSelectedTag={setSelectedTag}
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
        onCreateNugget={() => setIsCreateOpen(true)}
        currentUserId={currentUserId}
      />

      <MainLayout>
        {/* 
          Suspense fallback must NOT use min-h-screen to prevent layout shifts.
          It should only provide visual feedback without affecting layout structure.
        */}
        <Suspense fallback={<div className="flex items-center justify-center py-32"><Loader2 className="animate-spin w-8 h-8 text-primary-500" /></div>}>
          <Routes>
          {/* Feed/Content Areas - Wrapped in Error Boundaries */}
          <Route path="/" element={
            <ErrorBoundary>
              <HomePage searchQuery={searchQuery} viewMode={viewMode} setViewMode={setViewMode} selectedCategories={selectedCategories} setSelectedCategories={setSelectedCategories} selectedTag={selectedTag} setSelectedTag={setSelectedTag} sortOrder={sortOrder} />
            </ErrorBoundary>
          } />
          
          {/* Feed Routes - Grid Layout with Nested Routing */}
          {/* /feed renders FeedLayoutPage, /feed/:articleId renders detail via Outlet */}
          <Route path="/feed" element={
            <ErrorBoundary>
              <FeedLayoutPage />
            </ErrorBoundary>
          }>
            <Route path=":articleId" element={<ArticleDetailPage />} />
          </Route>
          
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

          <Route path="/bulk-create" element={
            <ProtectedRoute>
              <BulkCreateNuggetsPage />
            </ProtectedRoute>
          } />

          <Route path="/youtube-analysis" element={
            <ProtectedRoute>
              <BulkYouTubeAnalysisPage />
            </ProtectedRoute>
          } />

          {/* Legal Pages - Dynamic Routing */}
          <Route path="/about" element={<LegalPageRenderer />} />
          <Route path="/terms" element={<LegalPageRenderer />} />
          <Route path="/privacy" element={<LegalPageRenderer />} />
          <Route path="/contact" element={<LegalPageRenderer />} />
          <Route path="/guidelines" element={<LegalPageRenderer />} />
          <Route path="/disclaimer" element={<LegalPageRenderer />} />
          <Route path="/cookie-policy" element={<LegalPageRenderer />} />

          {/* Auth Routes - Wrapped in Error Boundary */}
          <Route path="/verify-email" element={
            <ErrorBoundary>
              <VerifyEmailPage />
            </ErrorBoundary>
          } />
          <Route path="/reset-password" element={
            <ErrorBoundary>
              <ResetPasswordPage />
            </ErrorBoundary>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        
        <BackToTopButton />
        <ToastContainer />
        
        <CreateNuggetModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
        <AuthModal />
      </MainLayout>
    </>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <FeedScrollStateProvider>
            <AppContent />
          </FeedScrollStateProvider>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
};

export default App;
