/**
 * Pure helpers for user route authorization (unit-tested).
 */

export type UserMutationAccess = 'allow' | 'forbid' | 'unauthenticated';

export function accessUserMutation(
  authUserId: string | undefined,
  authRole: string | undefined,
  targetUserId: string
): UserMutationAccess {
  if (authUserId === undefined || authUserId === '') return 'unauthenticated';
  if (authUserId === targetUserId) return 'allow';
  if (authRole === 'admin') return 'allow';
  return 'forbid';
}
