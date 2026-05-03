/**
 * Authorization for editorial (Mongo `Collection`) API — not bookmark folders.
 * Public collections: mutations are admin-only. Private: creator or admin.
 */
export function isAdminRole(userRole) {
    return typeof userRole === 'string' && userRole.toLowerCase().trim() === 'admin';
}
/** Whether the user may inspect which editorial collections include a given article (edit nugget UI). */
export function canInspectArticleCollectionMembership(articleAuthorId, userId, userRole) {
    if (!userId)
        return false;
    if (isAdminRole(userRole))
        return true;
    if (!articleAuthorId)
        return false;
    return String(articleAuthorId) === String(userId);
}
/** Rename/delete/update metadata */
export function canModifyCollectionMetadata(collection, userId, userRole) {
    if (!userId)
        return false;
    if (isAdminRole(userRole))
        return true;
    if (collection.type === 'public')
        return false;
    return String(collection.creatorId) === String(userId);
}
/** Add/remove entries (and batch variants) */
export function canModifyCollectionEntriesPolicy(collection, userId, userRole) {
    if (!userId)
        return false;
    if (isAdminRole(userRole))
        return true;
    if (collection.type === 'public')
        return false;
    return String(collection.creatorId) === String(userId);
}
/** POST create: `type` defaults to public in controller when omitted */
export function canCreateCollectionOfType(type, userRole) {
    const effective = type || 'public';
    if (effective === 'public') {
        return isAdminRole(userRole);
    }
    return true;
}
export function canViewCollectionPolicy(collection, userId, userRole) {
    if (collection.type === 'public')
        return true;
    if (!userId)
        return false;
    if (isAdminRole(userRole))
        return true;
    return String(collection.creatorId) === String(userId);
}
//# sourceMappingURL=editorialCollectionPolicy.js.map