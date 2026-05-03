/**
 * Pure helpers for user route authorization (unit-tested).
 */
export function accessUserMutation(authUserId, authRole, targetUserId) {
    if (authUserId === undefined || authUserId === '')
        return 'unauthenticated';
    if (authUserId === targetUserId)
        return 'allow';
    if (authRole === 'admin')
        return 'allow';
    return 'forbid';
}
//# sourceMappingURL=userAccess.js.map