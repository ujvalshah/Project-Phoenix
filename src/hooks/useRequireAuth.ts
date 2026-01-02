
import { useCallback } from 'react';
import { useAuthContext } from '../context/AuthContext';
import { FeatureFlags } from '../admin/types/admin';

export const useRequireAuth = () => {
  const { isAuthenticated, openAuthModal, featureFlags } = useAuthContext();

  const withAuth = useCallback((callback: (...args: any[]) => void, featureKey?: keyof FeatureFlags) => {
    return (...args: any[]) => {
      // 1. If user is authenticated, always allow
      if (isAuthenticated) {
        callback(...args);
        return;
      }

      // 2. If a specific feature key is provided, check if it's allowed for guests
      // e.g. if featureKey is 'guestBookmarks' and flag is true, allow it.
      if (featureKey && featureFlags && featureFlags[featureKey]) {
        callback(...args);
        return;
      }

      // 3. Otherwise, block and show login
      openAuthModal('login');
    };
  }, [isAuthenticated, openAuthModal, featureFlags]);

  return { withAuth };
};
