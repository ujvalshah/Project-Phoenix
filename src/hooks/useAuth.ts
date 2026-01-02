import { useAuthContext } from '@/context/AuthContext';

// Wrapper hook to maintain compatibility with existing components
// and provide easy access to auth context
export const useAuth = () => {
  const context = useAuthContext();
  
  return {
    ...context,
    currentUser: context.user,
    currentUserId: context.user?.id || '', // Fallback for components demanding an ID string
    isAdmin: context.user?.role === 'admin'
  };
};


