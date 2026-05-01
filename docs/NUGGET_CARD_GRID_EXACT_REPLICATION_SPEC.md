# Nugget Card Grid Exact Replication Spec

This document is a card-only, implementation-focused handoff for recreating the **exact** Nugget cards shown on the homepage grid.

Scope:
- Homepage `grid` cards (not masonry cards, not feed-detail layout).
- Targets `NewsCard` + `GridVariant` + card atom components.

Primary sources:
- `src/components/card/variants/GridVariant.tsx`
- `src/components/card/atoms/CardMedia.tsx`
- `src/components/card/atoms/CardTags.tsx`
- `src/components/card/atoms/CardTitle.tsx`
- `src/components/card/atoms/CardContent.tsx`
- `src/components/card/atoms/CardMeta.tsx`
- `src/components/card/atoms/CardActions.tsx`
- `src/components/card/atoms/CardThumbnailGrid.tsx`
- `src/components/ArticleGrid.tsx` (grid context)

---

## 1) Grid Context Contract (Card Container in Page)

- Parent grid columns: `1 / 2 / 3 / 4` at base / `md` / `lg` / `xl`.
- Grid gap: `gap-6` (24px).
- Grid row behavior: `auto-rows-auto items-stretch`.
- Card wrappers animate with `fade-in-up` in initial reveal only.

Do not alter these context constraints, or card proportions and row rhythm will drift.

---

## 2) Outer Card Shell (Must Match Exactly)

Card root (`article`) visual contract:
- Layout: `group relative flex flex-col h-full overflow-hidden`.
- Surface: `bg-white dark:bg-slate-900`.
- Border: `border border-slate-200 dark:border-slate-700`.
- Radius: `rounded-xl`.
- Elevation: `shadow-sm hover:shadow-md`.
- Motion: `transition-shadow duration-200`.
- Interaction:
  - `cursor-pointer`.
  - Focus ring: `focus:ring-2 focus:ring-primary-500 focus:ring-offset-2`.
  - Dark offset: `focus:ring-offset-slate-900`.

Selection mode variants:
- Selected: `border-primary-500 ring-1 ring-primary-500`.
- Unselected: neutral border retained.

---

## 3) Canonical Vertical Structure

The card is built in this order:

1. **Selection overlay checkbox** (only in selection mode; top-left absolute).
2. **Top media block** (hybrid/media-only variant specific).
3. **Body content block** (tags + title/content).
4. **Footer block** (`mt-auto`) with CTA row + meta/action row.
5. **Optional contributor strip**.

Never place metadata above content or above CTAs.

---

## 4) Variant-Specific Layout Rules

## 4.1 Hybrid card (`cardType === "hybrid"`)

### Media zone
- Wrapper: `relative w-full overflow-hidden rounded-t-xl pt-2 px-2 pb-2`.
- Media frame (`CardMedia`): `aspect-video rounded-lg`.
- Optional overlays:
  - Source badge (top-left) for link source.
  - Source button (top-right): dark translucent chip.

### Body zone
- Wrapper: `flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden px-4 pb-2 gap-2`.
- Order:
  - `CardTags` row (if tags exist)
  - `CardContent` (includes title + body truncation logic)

### Footer zone
- Wrapper: `mt-auto px-4 py-2 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2`.
- CTA row (conditional on text overflow):
  - Desktop drawer mode: single centered `View Full Article`.
  - Mobile/feed mode: split `Expand/Collapse` + `View Full Article`.
- Bottom row:
  - Left: `CardMeta`
  - Right: `CardActions`

## 4.2 Media-only card (`cardType === "media-only"`)

- Top media area dominates:
  - `flex-1 flex flex-col relative overflow-hidden rounded-t-xl min-h-[200px]`.
  - Nested media wrapper: `absolute inset-0 pt-2 px-2 pb-2`.
- Optional bottom caption gradient when text exists:
  - gradient from black/80 to transparent.
  - caption `line-clamp-3`.
- Source button still appears top-right when URL exists.
- No hybrid body stack (tags/title/content block) inserted like hybrid mode.

---

## 5) Tag Pills (Exact Visual Language)

`TagPill` style:
- Base: `inline-flex ... rounded-full border border-slate-200 bg-slate-50`.
- Padding: `px-1.5 py-0.5`.
- Typography: `text-xs font-medium text-slate-600`.
- Dark: `dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400`.

Interactive tag hover/focus:
- `hover:border-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:shadow-sm`.
- focus ring: `focus:ring-2 focus:ring-primary-500 focus:ring-offset-2`.

Tag row behavior:
- Single-row, no wrap.
- Up to 3 inline tags + `+N` overflow pill.
- Row container (grid/feed): `flex flex-nowrap items-center gap-1 ... overflow-hidden`.

`+N` overflow pill:
- Same pill style as tags (`rounded-full`, `px-1.5 py-0.5`, `text-xs`).
- Opens dropdown portal.

---

## 6) Typography Hierarchy (Card Internal)

### Title
- `text-xs font-semibold`.
- `line-clamp-2`.
- `leading-snug`.
- Colors: `text-slate-900 dark:text-white`.
- Hover color shift: `group-hover:text-primary-600 dark:group-hover:text-primary-400`.

### Body text
- Base size: `text-xs`.
- Grid variant color: `text-slate-600 dark:text-slate-400`.
- Feed variant (if used): `text-slate-700 dark:text-slate-300`.
- Hybrid cards use `leading-relaxed`.

### Disclaimer
- `text-[10px] italic text-slate-400 dark:text-slate-500 leading-snug`.
- top separator: `mt-2 pt-1.5 border-t ...`.

### Metadata text
- `text-xs text-slate-500 dark:text-slate-400`.

---

## 7) Truncation + Fade Behavior (Critical)

Collapsed content container:
- Always capped when not expanded:
  - default max-height `180px`
  - if markdown table detected: `200px`
- `overflow: hidden`.

Fade overlay when overflow exists:
- Overlay height: `h-20`.
- Separate light/dark gradient masks.
- If expansion enabled, show `Read more` button in overlay.

`Read more` button:
- `text-xs font-semibold`.
- `px-4 py-2`.
- `rounded-lg`.
- `border-2 border-slate-300 dark:border-slate-600`.
- Min tap target: `min-h-[44px]`.

Collapse control (expanded state):
- Small centered text control with chevron up.

Important:
- On desktop drawer mode, inline expansion is disabled and overflow only controls CTA visibility.

---

## 8) Media Rendering Rules (Thumbnail Behavior)

### Single thumbnail mode
- Container radius: `rounded-xl`.
- Clickable media area with focus ring.
- Media image behavior:
  - YouTube: `object-cover` (fills frame edge-to-edge).
  - Uploaded/static images in hybrid/media-only: `object-contain` (no crop).

### Multi-image grid mode
- Used when:
  - no YouTube primary media,
  - at least 2 grid-visible images.
- Cell background: `bg-slate-100 dark:bg-slate-800`.
- Cell min target: `min-h-[44px]`.
- Cell image: `object-cover`.
- Layouts:
  - 2 images: split layout.
  - 3 images: 1 large left + 2 stacked right.
  - 4+ images: 2x2 with `+N` overlay on 4th.

### Supporting media count badge
- Bottom-right badge when not in multi-image grid:
  - `bg-black/70`, `text-[10px]`, `px-2 py-1`, `rounded-full`.

---

## 9) CTA + Actions Row Details

### Desktop grid (`disableInlineExpansion=true`)
- Show single `View Full Article` only for hybrid cards with overflow.
- Button style is quiet/subtle:
  - `text-xs font-medium`
  - rounded-full
  - soft hover bg
  - no filled primary style.

### Mobile/feed (inline expansion allowed)
- Split two-button row when overflow:
  - left: Expand/Collapse
  - right: View Full Article
- Buttons:
  - `text-xs font-medium`
  - `rounded-lg border border-slate-200 dark:border-slate-700`
  - `min-h-[44px]`

### CardActions icon cluster
- Icon button min target: `min-h-[44px] min-w-[44px]`.
- Icon size: `16`.
- Rounded full hover surfaces.
- Menu dropdown:
  - width `w-40`
  - rounded `rounded-xl`
  - text `text-xs`.

---

## 10) Meta Row Details

Left block (`CardMeta`):
- Avatar size: `w-6 h-6` round.
- Fallback avatar:
  - `bg-primary-100 dark:bg-primary-900/30`
  - initials text `text-[9px] font-bold`.
- Date text uses absolute compact formatter (e.g. `Apr 30 '26`).

Tooltip bubble:
- `text-[10px]`, dark background, tiny arrow.

Meta row alignment:
- outer row uses `justify-between`.
- meta + actions must stay baseline-centered and visually balanced.

---

## 11) Color and Surface Tokens (Card-Focused)

Primary card palette:
- Surface: white / slate-900.
- Border: slate-200 / slate-700.
- Secondary text: slate-600/500/400 shades.
- Interactive accent: primary yellow scale for rings/highlights.
- Overlay dark chips: black at ~70% opacity.

Do not increase saturation/contrast; preserve restrained editorial tone.

---

## 12) Pixel-Integrity QA Checklist (Card-Only)

- Card radius and border thickness are identical across all cards.
- Card shadows are soft (`sm` to `md`) with no scale jump.
- Media inset (`pt-2 px-2 pb-2`) is consistent everywhere.
- Tag pills remain compact; no oversized chips.
- Title max 2 lines and text size remains `text-xs`.
- Body truncation and fade appear only on overflowed cards.
- `View Full Article` remains low-emphasis visual CTA.
- Footer top border position is stable and not crowded.
- Meta row (avatar/date/actions) is centered and evenly spaced.
- Dark mode keeps same hierarchy with adjusted neutrals only.

---

## 13) Non-Negotiable Do-Not-Change List

- Do not change `rounded-xl` outer card language.
- Do not replace subtle borders/shadows with heavy styles.
- Do not switch all card images to `object-cover` (must preserve contain behavior for non-YouTube).
- Do not remove overflow-based CTA logic.
- Do not enlarge typography scale in card internals.
- Do not tighten parent grid gap below `gap-6`.

---

## 14) Suggested Handoff Bundle

For another engineer/LLM, share:
- This file (`docs/NUGGET_CARD_GRID_EXACT_REPLICATION_SPEC.md`)
- `docs/HOMEPAGE_UI_REPLICATION_SPEC.md`
- `docs/CARD_MEDIA_IMAGE_URL_PATTERNS.md`
- 1 desktop screenshot (baseline), preferably one mobile screenshot too.

