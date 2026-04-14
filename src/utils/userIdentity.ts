export function getSafeUsernameHandle(input: {
  username?: string | null;
  displayName?: string | null;
  userId?: string | null;
}): string {
  const username = (input.username || '').trim().toLowerCase();
  if (username) return username;

  const fromName = (input.displayName || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 16);
  if (fromName.length >= 3) return fromName;

  const suffix = (input.userId || 'user').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toLowerCase();
  return `user_${suffix || 'acct'}`;
}
