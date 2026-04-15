import { useMemo } from 'react';
import { useAuthContext } from '@/context/AuthContext';

// Wrapper hook to maintain compatibility with existing components
// and provide easy access to auth context.
export const useAuth = () => {
  const context = useAuthContext();
  return useMemo(
    () => ({
      ...context,
      currentUser: context.user,
      currentUserId: context.user?.id || '',
      isAdmin: context.user?.role === 'admin',
    }),
    [context],
  );
};
