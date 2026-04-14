/**
 * Centralized z-index scale.
 *
 * Layer order:
 * - App content: 0
 * - Sticky UI and header overlays: 100-400
 * - Modal backdrop/panel/popovers: 1000-1020
 * - Global toasts/alerts: 1100+
 */
export const Z_INDEX = {
  APP_CONTENT: 0,
  /** Fixed mobile tab bar — above content, below header overlays. */
  MOBILE_BOTTOM_NAV: 150,
  CATEGORY_BAR: 200,
  HEADER: 300,
  HEADER_OVERLAY: 400,
  BACKDROP: 1000,
  MODAL: 1010,
  MODAL_POPOVER: 1020,
  TOAST: 1100,
} as const;










