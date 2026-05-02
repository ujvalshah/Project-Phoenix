
import React, { lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AdminLayout } from '../admin/layout/AdminLayout';
import { RequireAdmin } from '../admin/components/RequireAdmin';
import { ErrorBoundary } from '../components/UI/ErrorBoundary';

const AdminDashboardPage = lazy(() =>
  import('../admin/pages/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })),
);
const AdminUsersPage = lazy(() =>
  import('../admin/pages/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage })),
);
const AdminNuggetsPage = lazy(() =>
  import('../admin/pages/AdminNuggetsPage').then((m) => ({ default: m.AdminNuggetsPage })),
);
const AdminCollectionsPage = lazy(() =>
  import('../admin/pages/AdminCollectionsPage').then((m) => ({ default: m.AdminCollectionsPage })),
);
const AdminTagsPage = lazy(() =>
  import('../admin/pages/AdminTagsPage').then((m) => ({ default: m.AdminTagsPage })),
);
const AdminConfigPage = lazy(() =>
  import('../admin/pages/AdminConfigPage').then((m) => ({ default: m.AdminConfigPage })),
);
const AdminModerationPage = lazy(() =>
  import('../admin/pages/AdminModerationPage').then((m) => ({ default: m.AdminModerationPage })),
);
const AdminFeedbackPage = lazy(() =>
  import('../admin/pages/AdminFeedbackPage').then((m) => ({ default: m.AdminFeedbackPage })),
);
const AdminDownloadsPage = lazy(() =>
  import('../admin/pages/AdminDownloadsPage').then((m) => ({ default: m.AdminDownloadsPage })),
);
const AdminTaggingPage = lazy(() =>
  import('../admin/pages/AdminTaggingPage').then((m) => ({ default: m.AdminTaggingPage })),
);
const AdminLegalPagesPage = lazy(() =>
  import('../admin/pages/AdminLegalPagesPage').then((m) => ({ default: m.AdminLegalPagesPage })),
);
const AdminContactPage = lazy(() =>
  import('../admin/pages/AdminContactPage').then((m) => ({ default: m.AdminContactPage })),
);

export const AdminPanelPage: React.FC = () => {
  return (
    <RequireAdmin>
      <ErrorBoundary>
        <Routes>
          <Route element={<AdminLayout />}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="dashboard" element={<Navigate to="/admin" replace />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="nuggets" element={<AdminNuggetsPage />} />
            <Route path="collections" element={<AdminCollectionsPage />} />
            <Route path="tags" element={<AdminTagsPage />} />
            <Route path="moderation" element={<AdminModerationPage />} />
            <Route path="config" element={<AdminConfigPage />} />
            <Route path="feedback" element={<AdminFeedbackPage />} />
            <Route path="downloads" element={<AdminDownloadsPage />} />
            <Route path="tagging" element={<AdminTaggingPage />} />
            <Route path="legal" element={<AdminLegalPagesPage />} />
            <Route path="contact" element={<AdminContactPage />} />
          </Route>
        </Routes>
      </ErrorBoundary>
    </RequireAdmin>
  );
};

export default AdminPanelPage;
