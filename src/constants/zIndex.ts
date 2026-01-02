/**
 * Z-Index Constants
 * 
 * Centralized z-index values to prevent stacking context conflicts.
 * 
 * Hierarchy:
 * - HEADER: Fixed header at top (50)
 * - CATEGORY_BAR: Sticky category filter bar (40)
 * - HEADER_OVERLAY: Header-triggered overlays (100)
 * - MODAL: Modal dialogs and overlays (200)
 */
export const Z_INDEX = {
  HEADER: 50,
  CATEGORY_BAR: 40,
  HEADER_OVERLAY: 100,
  MODAL: 200,
} as const;







