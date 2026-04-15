/**
 * Authorization for editorial (Mongo `Collection`) API — not bookmark folders.
 * Public collections: mutations are admin-only. Private: creator or admin.
 */

export function isAdminRole(userRole: string | undefined): boolean {
  return typeof userRole === 'string' && userRole.toLowerCase().trim() === 'admin';
}

/** Rename/delete/update metadata */
export function canModifyCollectionMetadata(
  collection: { type: string; creatorId: unknown },
  userId: string | undefined,
  userRole: string | undefined
): boolean {
  if (!userId) return false;
  if (isAdminRole(userRole)) return true;
  if (collection.type === 'public') return false;
  return String(collection.creatorId) === String(userId);
}

/** Add/remove entries (and batch variants) */
export function canModifyCollectionEntriesPolicy(
  collection: { type: string; creatorId: unknown },
  userId: string | undefined,
  userRole: string | undefined
): boolean {
  if (!userId) return false;
  if (isAdminRole(userRole)) return true;
  if (collection.type === 'public') return false;
  return String(collection.creatorId) === String(userId);
}

/** POST create: `type` defaults to public in controller when omitted */
export function canCreateCollectionOfType(
  type: 'public' | 'private' | undefined,
  userRole: string | undefined
): boolean {
  const effective = type || 'public';
  if (effective === 'public') {
    return isAdminRole(userRole);
  }
  return true;
}

export function canViewCollectionPolicy(
  collection: { type: string; creatorId: unknown },
  userId: string | undefined,
  userRole: string | undefined
): boolean {
  if (collection.type === 'public') return true;
  if (!userId) return false;
  if (isAdminRole(userRole)) return true;
  return String(collection.creatorId) === String(userId);
}
