/**
 * Syncs layout helpers with scroll-driven header visibility (narrow viewports).
 * DropdownPortal uses getHeaderHeight() — when the fixed header is slid away,
 * clamping against 0 avoids incorrect vertical offsets.
 */

let narrowHeaderHidden = false;

export function setNarrowHeaderHidden(hidden: boolean): void {
  narrowHeaderHidden = hidden;
}

export function isNarrowHeaderHidden(): boolean {
  return narrowHeaderHidden;
}
