/**
 * =============================================================================
 * GLOBAL Z-INDEX SCALE — single source of truth
 * =============================================================================
 *
 * Stack overview (low → high):
 *   BASE → CONTENT → sticky subheaders → mobile bottom nav → HEADER →
 *   DROPDOWN → POPOVER → TOOLTIP → DRAWER → MODAL → PICTURE_IN_PICTURE → TOAST
 *
 * Overlay hosts (`#dropdown-root`, `#popover-root`, …) are siblings of `#root` in
 * `index.html`. Their `z-index` is applied in `mountOverlayHostStack()` from
 * these values so overlays are never trapped inside `#root` stacking contexts.
 *
 * Which primitive uses which layer:
 * | Primitive            | Host (see overlayHosts.ts) | Z_INDEX token        |
 * |----------------------|----------------------------|----------------------|
 * | Header, category bar | (in #root, not a host)     | HEADER, STICKY_*     |
 * | Menus, sort, avatar  | dropdown-root              | DROPDOWN             |
 * | Anchored pickers, …  | popover-root               | POPOVER              |
 * | Tooltips             | tooltip-root               | TOOLTIP              |
 * | Sheets, drawers, nav | drawer-root                | DRAWER               |
 * | Dialogs, lightbox, bookmark folder picker | modal-root          | MODAL                |
 * | PiP / mini player    | pip-root                   | PICTURE_IN_PICTURE   |
 * | Toasts               | toast-root                 | TOAST                |
 *
 * Anti-patterns (do not do):
 * - Portaling to `document.body` with ad-hoc z-50 / z-[100] — breaks when HEADER
 *   is on a higher band; use `getOverlayHost()` instead.
 * - Mounting floating UI inside `overflow: hidden` scroll areas — it will clip;
 *   portal to an overlay host.
 * - Applying `transform` / `filter` / `opacity` on app-shell ancestors for
 *   decoration — creates stacking contexts; prefer animating inner children or
 *   keep overlays portaled outside.
 * - Inventing z-index numbers outside this module — extend the scale here.
 *
 * MODAL_BACKDROP is reserved for future split backdrop/panel hosts; ModalShell
 * currently uses one host at MODAL with an in-tree backdrop + panel.
 * =============================================================================
 */
export const Z_INDEX = {
  BASE: 0,
  CONTENT: 1,
  /** Sticky toolbars / rails inside the main document (below HEADER). */
  STICKY_SUBHEADER: 50,
  /** Same band as STICKY_SUBHEADER — sticky category rail, page toolbars. */
  CATEGORY_BAR: 50,
  /** Fixed mobile tab bar — above in-content stickies, below HEADER. */
  MOBILE_BOTTOM_NAV: 75,
  /** Fixed feedback tab / small fixed chrome — still below HEADER. */
  CHROME_WIDGET: 95,
  /** Fixed site header */
  HEADER: 100,
  /** Header dropdowns, sort menu, card overflow menus, notifications panel */
  DROPDOWN: 1000,
  /** Anchored pickers: collections, bookmark folder UI, bulk bars */
  POPOVER: 1050,
  TOOLTIP: 1100,
  /** Mobile nav drawer, filter sheets, article drawer, fullscreen search */
  DRAWER: 1200,
  /** Reserved — backdrop layer if split from panel */
  MODAL_BACKDROP: 1300,
  /** Dialog shells, auth, create nugget, image lightbox */
  MODAL: 1310,
  /** Floating video / mini player — below toasts */
  PICTURE_IN_PICTURE: 1350,
  TOAST: 1400,
} as const;

export type ZIndexToken = keyof typeof Z_INDEX;
