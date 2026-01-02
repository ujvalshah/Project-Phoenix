
import { useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { checkPermission } from '../auth/adminPermissions';
import { AdminPermission } from '../types/admin';

export const useAdminPermissions = () => {
  const { modularUser } = useAuth();

  const can = useCallback((permission: AdminPermission) => {
    return checkPermission(modularUser, permission);
  }, [modularUser]);

  return { can };
};
