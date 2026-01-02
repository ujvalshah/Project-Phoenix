import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading, openAuthModal } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      openAuthModal('login');
    }
  }, [isLoading, isAuthenticated, openAuthModal]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div></div>;
  }

  if (!isAuthenticated) {
    // Redirect to home but keep the URL so we could potentially redirect back after login (not implemented here yet)
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  return <>{children}</>;
};


