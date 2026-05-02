# Frontend Rendering Dependencies Checklist

Use this checklist when handing off frontend replication/implementation to another LLM or engineer.

Goal: ensure the UI renders and behaves correctly without subtle regressions.

---

## 1) Required Inputs (Must Share)

### UI Spec Documents
- `docs/HOMEPAGE_UI_REPLICATION_SPEC.md`
- `docs/CARD_MEDIA_IMAGE_URL_PATTERNS.md`

### Core Style System
- `tailwind.config.js`
- `index.css`
- `src/constants/layout.ts`

### Core Rendering Components
- `src/components/Header.tsx`
- `src/pages/HomePage.tsx`
- `src/components/CategoryToolbar.tsx`
- `src/components/ArticleGrid.tsx`
- `src/components/card/variants/GridVariant.tsx`
- `src/components/navigation/MobileBottomNav.tsx`
- `src/components/legal/LegalFooter.tsx`

### Route/Shell Wiring
- `src/App.tsx` (route composition + global shell placement)

---

## 2) Data Contract Dependencies (Critical)

Ensure API payloads and local models preserve these fields used in rendering:

### Card Media
- `primaryMedia`
  - `type`, `url`, `thumbnail`, `previewMetadata`
  - `showInGrid`, `showInMasonry`, `masonryTitle`
- `supportingMedia[]`
  - `type`, `url`, `thumbnail`, `order`/`position`
  - `showInGrid`, `showInMasonry`, `masonryTitle`
- `images[]`
- `media` (legacy path, still consumed in parts)
- `source_type`

### Card Content / Meta
- `title`, `content`, `excerpt`
- `tags`
- `authorName`, `authorAvatarUrl`, `formattedDate` (or equivalent mapped fields)

### Feed/Toolbar State Inputs
- search query (draft + committed model)
- selected filters (formats/domains/subtopics/tags)
- content stream (`standard` vs `pulse`)
- sort order
- pagination flags (`hasNextPage`, `isFetchingNextPage`)

If these contract fields are absent or renamed, visual behavior and card media ordering can break.

---

## 3) Runtime Behavior Dependencies (Critical)

### Breakpoints / Layout Invariants
- Keep `lg=1024`, `xl=1280` behavior assumptions.
- Keep header heights:
  - mobile: `56px`
  - desktop: `64px`
- Keep category bar height:
  - `44px` (`h-11`)

### Chrome/Scroll Behavior
- Header hide/show transitions on narrow viewport scroll.
- Mobile bottom nav show/hide coordination.
- Safe-area CSS var handling:
  - `--mobile-bottom-nav-inset`

### Interaction Model
- Desktop multi-column grid: card opens drawer path.
- Mobile/feed contexts: inline expansion/modal patterns.
- Sticky category toolbar and fixed header must preserve layering order.

---

## 4) Feature Flag Dependencies

Share active feature flag values used by frontend:
- `MARKET_PULSE` (nav, editor stream picker, and whether `?stream=pulse` applies; when off, `useFilterState` clamps the home feed to standard)
- Any feed virtualization flags affecting card mounting/scroll behavior
- Any experimental UI flags affecting card/media behavior

Without flag parity, screenshots and behavior will not match.

---

## 5) Theming / Visual Fidelity Dependencies

### Required
- `dark` class strategy (class-based dark mode).
- Tailwind `primary` palette from config.
- Current shadow/radius scale.
- compact typography classes (`text-[10.5px]`, `text-[11px]`, `text-xs`, `text-sm`).

### Common Drift Risks
- replacing translucent backgrounds with opaque fills,
- increasing border/shadow contrast too much,
- changing micro-spacing (`mt-0.5`, `mb-2`, `gap-2`, `gap-6`),
- changing icon sizes (16/18/19 px cadence).

---

## 6) Media Rendering Dependencies

For card media section parity, ensure these are present:
- URL classification logic: `src/utils/urlUtils.ts`
- Media collection/order logic: `src/utils/mediaClassifier.ts`
- Any normalization logic affecting media arrays/order:
  - `src/shared/articleNormalization/normalizeArticleInput.ts`
  - `src/shared/articleNormalization/preSaveValidation.ts`

Missing these causes:
- wrong media type detection,
- wrong thumbnail/source rendering,
- image order drift across cards.

---

## 7) Copy/Content Dependencies

Provide canonical copy for:
- nav labels,
- homepage microcopy,
- stream-specific onboarding strip text,
- card CTA labels (`View Full Article`, `Expand`, `Collapse`),
- footer/legal labels.

Text differences materially affect spacing and perceived fidelity.

---

## 8) QA Inputs to Provide in Handoff

Minimum QA bundle:
- 1 desktop screenshot (current baseline),
- 1 mobile screenshot (if available),
- this checklist + the two docs above,
- representative API payload sample for homepage cards,
- feature flag values used during screenshot capture.

---

## 9) Quick Verification Checklist

Before sign-off, verify:
- header height/blur and toolbar density match,
- category rail pill sizing and spacing match,
- desktop grid is 4-column at expected viewport,
- card radius/border/shadow exactly match baseline feel,
- card CTA remains low emphasis,
- image URL patterns correctly populate card media,
- mobile bottom nav safe-area behavior works on narrow viewport,
- dark mode keeps equivalent hierarchy and contrast.

---

## 10) Optional But Recommended

Create a temporary “parity sandbox” page that renders:
- one hybrid card,
- one media-only card,
- one no-media card,
- one overflow-text card,
under both light and dark modes across desktop/tablet/mobile widths.

This catches most rendering regressions quickly before full integration.
