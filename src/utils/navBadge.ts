export function formatNavBadgeCount(count: number): string {
  return count > 99 ? '99+' : String(count);
}

export function hasNavBadge(count: number | undefined | null): count is number {
  return typeof count === 'number' && count > 0;
}
