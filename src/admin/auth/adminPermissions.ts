
import { AdminRole, AdminPermission } from '../types/admin';
import { User } from '@/types/user'; // Frontend User Type

// Define capability sets
const ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  user: [], // Regular users have no admin access
  
  admin: [
    'admin.access',
    'admin.users.view',
    'admin.users.suspend', // Can suspend, but maybe not change role
    'admin.nuggets.view',
    'admin.nuggets.hide',
    'admin.collections.view',
    'admin.collections.edit',
    'admin.tags.manage',
    'admin.config.manage',
  ],
  
  superadmin: [
    'admin.access',
    'admin.users.view',
    'admin.users.edit',
    'admin.users.suspend',
    'admin.nuggets.view',
    'admin.nuggets.hide',
    'admin.nuggets.delete', // Only superadmin can hard delete
    'admin.collections.view',
    'admin.collections.edit',
    'admin.tags.manage',
    'admin.config.manage',
  ]
};

/**
 * Checks if a user has a specific permission.
 * Falls back to 'user' role if user object is missing or role is unrecognized.
 */
export const checkPermission = (user: User | null | undefined, permission: AdminPermission): boolean => {
  if (!user) return false;
  
  // Map frontend roles to admin roles
  // Note: Your app currently uses 'admin' | 'user' strings. 
  // We treat 'admin' as 'superadmin' for this stub unless you have a specific superadmin flag.
  const userRole: AdminRole = (user.role === 'admin') ? 'superadmin' : 'user';
  
  const allowed = ROLE_PERMISSIONS[userRole] || [];
  return allowed.includes(permission);
};
