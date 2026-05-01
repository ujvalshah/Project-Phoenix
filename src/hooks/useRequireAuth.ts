
import { useCallback } from 'react';
import { shallowEqualAuth, useAuthSelector } from '../context/AuthContext';

export const useRequireAuth = () => {
  const { isAuthenticated, openAuthModal } = useAuthSelector(
    (a) => ({
      isAuthenticated: a.isAuthenticated,
      openAuthModal: a.openAuthModal,
    }),
    shallowEqualAuth,
  );

  const withAuth = useCallback(
    <Args extends unknown[], R>(callback: (...args: Args) => R) =>
      (...args: Args): R | undefined => {
        if (isAuthenticated) {
          return callback(...args);
        }
        openAuthModal('login');
        return undefined;
      },
    [isAuthenticated, openAuthModal],
  );

  return { withAuth };
};
