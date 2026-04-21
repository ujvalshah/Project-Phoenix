import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { shallowEqualAuth, useAuthSelector } from '@/context/AuthContext';

interface AdminRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

export const AdminRoute: React.FC<AdminRouteProps> = ({ children, redirectTo = '/collections' }) => {
  const { isAuthenticated, isLoading, isAdmin, openAuthModal } = useAuthSelector(
    (a) => ({
      isAuthenticated: a.isAuthenticated,
      isLoading: a.isLoading,
      isAdmin: a.user?.role === 'admin',
      openAuthModal: a.openAuthModal,
    }),
    shallowEqualAuth,
  );
  const location = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      openAuthModal('login');
    }
  }, [isLoading, isAuthenticated, openAuthModal]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  if (!isAdmin) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
};
