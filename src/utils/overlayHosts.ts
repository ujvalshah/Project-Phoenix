import { Z_INDEX } from '@/constants/zIndex';

/**
 * Overlay host map — use `getOverlayHost()` + `DropdownPortal` / `ModalShell` instead of
 * `position: absolute` menus inside cards, toolbars, masonry, or scroll regions.
 *
 * Which host for which UI:
 * - **dropdown** — action menus, bulk toolbars, column pickers, “more” menus anchored to buttons.
 * - **popover** — richer anchored panels (e.g. “+N tags”), non-modal context UI.
 * - **tooltip** — hover/focus hints (`Tooltip`); keep ephemeral and non-interactive where possible.
 *   Interactive bubbles (e.g. author name + dismiss) also use `#tooltip-root` with fixed positioning
 *   from `getBoundingClientRect` — see `CardMeta`.
 * - **drawer** — slide-over shells (navigation, filters).
 * - **modal** — dialogs, lightboxes, full-screen overlays; use `ModalShell` for consistent behavior.
 *   For combobox/listbox panels **inside** an open modal, use `DropdownPortal` with `host="modal"`
 *   so the list stacks above the modal body without local `z-index` arms races.
 * - **pip** / **toast** — dedicated layers for PiP and notifications.
 *
 * When **not** to use local `absolute`/`fixed` floating UI:
 * - Any ancestor may use `overflow: hidden|auto|scroll`, `transform`, `filter`, `backdrop-filter`,
 *   or `contain`, which clips or creates a stacking context that breaks in-layout popups.
 *
 * Prefer removing unnecessary `overflow: hidden` on wrappers; if overflow is required for layout,
 * portal the floating piece to the appropriate host above.
 *
 * IDs must match `index.html` overlay siblings of `#root`.
 * Each host is `position: fixed; inset: 0; pointer-events: none`; children set
 * `pointer-events: auto` where they handle input.
 */
const HOST_IDS = {
  dropdown: 'dropdown-root',
  popover: 'popover-root',
  tooltip: 'tooltip-root',
  drawer: 'drawer-root',
  modal: 'modal-root',
  pip: 'pip-root',
  toast: 'toast-root',
} as const;

export type OverlayHostKind = keyof typeof HOST_IDS;

const HOST_STACK: Array<[string, number]> = [
  [HOST_IDS.dropdown, Z_INDEX.DROPDOWN],
  [HOST_IDS.popover, Z_INDEX.POPOVER],
  [HOST_IDS.tooltip, Z_INDEX.TOOLTIP],
  [HOST_IDS.drawer, Z_INDEX.DRAWER],
  [HOST_IDS.modal, Z_INDEX.MODAL],
  [HOST_IDS.pip, Z_INDEX.PICTURE_IN_PICTURE],
  [HOST_IDS.toast, Z_INDEX.TOAST],
];

/**
 * Apply z-index and geometry to overlay roots. Call once at app bootstrap
 * (`main.tsx`) so values always match `Z_INDEX` without duplicating magic
 * numbers in HTML.
 */
export function mountOverlayHostStack(): void {
  if (typeof document === 'undefined') return;
  for (const [id, z] of HOST_STACK) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.style.position = 'fixed';
    el.style.inset = '0';
    el.style.pointerEvents = 'none';
    el.style.zIndex = String(z);
  }
}

/**
 * Preferred portal target for floating UI. Falls back to `document.body` in
 * tests or if a host is missing.
 */
export function getOverlayHost(kind: OverlayHostKind): HTMLElement {
  if (typeof document === 'undefined') return null as unknown as HTMLElement;
  const id = HOST_IDS[kind];
  return document.getElementById(id) ?? document.body;
}
