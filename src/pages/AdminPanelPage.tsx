
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AdminLayout } from '../admin/layout/AdminLayout';
import { AdminDashboardPage } from '../admin/pages/AdminDashboardPage';
import { AdminUsersPage } from '../admin/pages/AdminUsersPage';
import { AdminNuggetsPage } from '../admin/pages/AdminNuggetsPage';
import { AdminCollectionsPage } from '../admin/pages/AdminCollectionsPage';
import { AdminTagsPage } from '../admin/pages/AdminTagsPage';
import { AdminConfigPage } from '../admin/pages/AdminConfigPage';
import { AdminModerationPage } from '../admin/pages/AdminModerationPage';
import { AdminActivityLogPage } from '../admin/pages/AdminActivityLogPage';
import { AdminFeedbackPage } from '../admin/pages/AdminFeedbackPage';
import { AdminDownloadsPage } from '../admin/pages/AdminDownloadsPage';
import { AdminLegalPages } from '../admin/pages/AdminLegalPages';
import { RequireAdmin } from '../admin/components/RequireAdmin';
import { ErrorBoundary } from '../components/UI/ErrorBoundary';

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
            <Route path="activity" element={<AdminActivityLogPage />} />
            <Route path="config" element={<AdminConfigPage />} />
            <Route path="feedback" element={<AdminFeedbackPage />} />
            <Route path="downloads" element={<AdminDownloadsPage />} />
            <Route path="legal" element={<AdminLegalPages />} />
          </Route>
        </Routes>
      </ErrorBoundary>
    </RequireAdmin>
  );
};

// Default export for lazy loading compatibility
export default AdminPanelPage;
