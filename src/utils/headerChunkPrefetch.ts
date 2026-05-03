/**
 * Intent prefetch for lazily loaded header chunks (bell dropdown, nav drawer).
 * Safe in prod: only warms the module/network; does not open UI or change behavior.
 * Duplicate calls are no-ops after the first `import()` is scheduled.
 */

let notificationBellDropdownInflight: Promise<unknown> | undefined;
let navigationDrawerInflight: Promise<unknown> | undefined;

/** Warm NotificationBellDropdown chunk (matches React.lazy path in NotificationBell). */
export function prefetchNotificationBellDropdownChunk(): void {
  if (notificationBellDropdownInflight) return;
  notificationBellDropdownInflight = import('@/components/NotificationBellDropdown').catch(() => {
    notificationBellDropdownInflight = undefined;
  });
}

/** Warm NavigationDrawer chunk (matches React.lazy path in Header). */
export function prefetchNavigationDrawerChunk(): void {
  if (navigationDrawerInflight) return;
  navigationDrawerInflight = import('@/components/header/NavigationDrawer').catch(() => {
    navigationDrawerInflight = undefined;
  });
}
