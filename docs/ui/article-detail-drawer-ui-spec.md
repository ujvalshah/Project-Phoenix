# Article detail drawer — UI specification (LLM recreation)

This document describes the **Article details** experience as implemented in Project Phoenix: the **desktop grid side drawer** (`ArticleDrawer` + `ArticleDetail` with `isModal={true}`), the **shared inner content** (`ArticleDetail`), and closely related surfaces (`ArticleModal`). It is derived from `src/components/ArticleDrawer.tsx`, `ArticleModal.tsx`, `ArticleDetail.tsx`, `DetailTopBar.tsx`, `MarkdownRenderer.tsx`, `ArticleDetailLazy.tsx`, `index.css`, and `tailwind.config.js`.

**Dark mode:** `class` strategy on `<html>` / root — use Tailwind `dark:` variants everywhere they appear below.

---

## 1. Architecture (what stacks where)

| Layer | Component | Role |
|--------|-----------|------|
| Overlay host | Portal to `#drawer` host (`getOverlayHost('drawer')`) | Stacking context for drawer |
| Backdrop | Dimmed full-screen layer | Click closes drawer |
| Panel | Right-aligned column | White/slate surface, border-left, shadow |
| Scroll | `overflow-y-auto` + `custom-scrollbar` | Vertical scroll only inside panel |
| Chrome | `ArticleDetail` root + `DetailTopBar` | Sticky header + body |

**Home grid drawer** uses `ArticleDrawer`. **Mobile / single-column** article overlay uses `ArticleModal` (`ModalShell` + panel); inner content is the same `ArticleDetail` with `isModal={true}`.

---

## 2. Drawer shell (`ArticleDrawer`)

### 2.1 Root overlay

- **Layout:** `fixed inset-0 flex justify-end isolation-auto`
- **While closing:** `pointer-events-none` on root; backdrop also non-interactive + `opacity-0`
- **A11y:** `role="dialog"`, `aria-modal="true"`, `aria-label="Article details drawer"`, `aria-describedby="drawer-content"`

### 2.2 Backdrop

- **Position:** `absolute inset-0`
- **Fill:** `bg-black/40`
- **Effect:** `backdrop-blur-sm`
- **Motion:** `transition-opacity duration-200 ease-out`; `motion-reduce:transition-none`
- **Open:** `opacity-100 pointer-events-auto`
- **Closing:** `opacity-0 pointer-events-none`
- **Behavior:** `onClick` → close (after exit delay, see §2.5)

### 2.3 Panel (drawer column)

- **Width:** `w-full` (narrow viewports), `sm:w-[400px]`, `lg:w-[500px]`
- **Height:** `h-full`
- **Background:** `bg-white dark:bg-slate-950`
- **Elevation:** `shadow-2xl`
- **Layout:** `flex flex-col`
- **Separator:** `border-l border-slate-200 dark:border-slate-800`
- **Slide animation:** `transform transition-transform duration-200 ease-out motion-reduce:transition-none`
  - Open: `translate-x-0`
  - Closing: `translate-x-full` (slides off to the right)
- **Pointer:** `pointer-events-auto` on panel; inner `onClick` stops propagation so backdrop does not receive clicks

### 2.4 Scroll container

- **ID:** `drawer-content` (used by `IntersectionObserver` for media carousel visibility)
- **Classes:** `flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-950`

### 2.5 Close timing

- Exit duration **200 ms** (`CLOSE_EXIT_MS`), aligned with Tailwind `duration-200` on backdrop/panel.
- If `prefers-reduced-motion: reduce`, delay **0 ms** before calling parent `onClose`.

---

## 3. Modal shell variant (`ArticleModal` + `ModalShell`)

Used when the article opens as a **modal panel** (not the grid drawer). Inner `ArticleDetail` is still `isModal={true}`.

### 3.1 `ModalShell` wrapper

- **Position:** `fixed inset-0 flex` + alignment (`align="end"` → `justify-end items-stretch`)
- **Safe area:** inline `paddingTop/Bottom/Left/Right` = `env(safe-area-inset-*)`
- **Open/closed:** `opacity-100 pointer-events-auto` vs `opacity-0 pointer-events-none`, `transition-opacity duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]`

### 3.2 Modal backdrop (different from drawer)

- **Classes:** `absolute inset-0 bg-slate-900/60` + same opacity transition as shell
- Click closes (unless disabled by props)

### 3.3 Modal panel

- **Width:** `w-full md:w-1/2 max-w-[1000px] h-full`
- **Background / border / shadow:** same as drawer panel (`bg-white dark:bg-slate-950`, `shadow-2xl`, `border-l border-slate-200 dark:border-slate-800`)
- **Entry animation:** `animate-in slide-in-from-right duration-300 ease-out` (Tailwind animate plugin pattern)

---

## 4. Global tokens (Tailwind + CSS)

### 4.1 Primary palette (`tailwind.config.js` `theme.extend.colors.primary`)

Used for links, focus rings, scrollbar, timestamp highlights, etc.

| Token | Hex (approx.) |
|--------|----------------|
| primary-400 | `#facc15` |
| primary-500 | `#eab308` |
| primary-600 | `#ca8a04` |
| primary-100 / 900 | light/dark highlight backgrounds for active timestamp |

### 4.2 Typography stack

No custom `fontFamily` in `tailwind.config.js` — **system UI stack** from Tailwind defaults (`font-sans` if applied at app root).

### 4.3 Font-size mapping (Tailwind class → actual size)

There are no HTML `<font>` tags in this UI. Font sizing is driven by Tailwind classes and inherited styles.

| Class | rem | px | Typical use in article drawer |
|------|-----|----|-------------------------------|
| `text-[10px]` | 0.625rem | 10px | Tag chips, carousel counter, disclaimer text, tiny labels |
| `text-[11px]` | 0.6875rem | 11px | Source pill label (`"Source"`) |
| `text-xs` | 0.75rem | 12px | Meta row text, markdown body, markdown headings (`h1`–`h4` in compact mode), menu items |
| `text-sm` | 0.875rem | 14px | Author name, article title wrapper, loading caption |
| `text-base` | 1rem | 16px | Not a primary drawer default; appears only in some inherited/global contexts |

### 4.4 Font tags/elements in this implementation

| Element tag / role | Effective class in drawer | Effective size |
|--------------------|---------------------------|----------------|
| Title wrapper (`div` with `role=\"heading\"` + `aria-level={1}`) | `text-sm font-semibold` | 14px |
| Markdown `h1` / `h2` / `h3` / `h4` | `text-xs font-bold` (compact renderer map) | 12px |
| Markdown paragraph/list text | Inherits from `nugget-content text-xs` | 12px |
| Author name (`div`) | `text-sm font-bold` | 14px |
| Meta row (`div`) | `text-xs font-medium` | 12px |
| Disclaimer (`div`) | `text-[10px] italic` | 10px |
| Source label (`span`) | `text-[11px] font-semibold` | 11px |
| Dropdown item text (`button`) | `text-xs font-medium` | 12px |

### 4.5 Scrollbar (`.custom-scrollbar` in `index.css`)

- **Firefox:** `scrollbar-width: thin`; `scrollbar-color: #eab308 transparent` (primary-500 + transparent track)
- **WebKit thumb:** `#eab308` (primary-500), hover `#ca8a04` (primary-600), `border-radius: 9999px`
- **WebKit size:** 4×4 px

---

## 5. Inner surface: `ArticleDetail` (drawer / modal mode: `isModal={true}`)

### 5.1 Root container (`isModal`)

- **Classes:** `bg-white dark:bg-slate-950 min-h-full flex flex-col`

### 5.2 Main scroll structure

When `isModal`:

- **Outer flex child:** `flex-1` (scroll is on **parent** — drawer/modal scroll container)
- **Inner content wrapper:** `max-w-none px-5 py-6 space-y-6`

Vertical rhythm between major blocks: **`space-y-6`** (1.5 rem).

### 5.3 Optional: standalone page (`isModal={false}`)

Not the drawer, but same component: max width `max-w-[720px] mx-auto`, horizontal padding `px-4 xl:px-6`, vertical `py-6`. Drawer uses `constrainWidth={false}` from parent so width follows panel only.

---

## 6. Sticky top bar (`DetailTopBar`)

Only when `showHeader` is true (default: same as `isModal` → **shown in drawer/modal**).

### 6.1 Bar container

- **Layout:** `sticky top-0 z-10 flex items-center justify-between`
- **Padding:** `px-4 py-3`
- **Background:** `bg-white/80 dark:bg-slate-950/80 backdrop-blur-md`
- **Bottom border:** `border-b border-slate-100 dark:border-slate-800`

### 6.2 Left cluster (author)

- **Row:** `flex items-center gap-3 min-w-0`
- **Avatar:** `Avatar` with `size="sm"` → `w-6 h-6`, initials `text-[10px]`, `rounded-full`, `bg-slate-200 dark:bg-slate-700`, `text-slate-600 dark:text-slate-300`, `font-bold`
- **Name:** `text-sm font-bold text-slate-900 dark:text-white truncate`

### 6.3 Right cluster (actions)

- **Row:** `flex items-center gap-2 shrink-0`
- **Share** (if article not private): `ShareMenu` with `className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"`
- **Bookmark:** `BookmarkButton` `size="md"`, `className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"`
- **Overflow menu trigger:** `p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500 hover:text-slate-700 dark:hover:text-slate-300`, icon `MoreVertical` **20px**
- **Close:** `p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors`, `X` **20px**, `text-slate-500`

### 6.4 Dropdown menu (`DropdownPortal` anchored to More button)

- **Panel:** `w-40 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl py-1 overflow-hidden`
- **Offset:** `offsetY={4}`
- **Menu items:** `w-full text-left px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2`
- **Delete row:** `text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20`
- **Icons in rows:** Lucide **12px**; Globe tinted `text-blue-500`, Lock `text-amber-500`

---

## 7. Article header block (tags, title, meta)

### 7.1 Tags (optional)

- **Container:** `flex flex-wrap gap-1 mb-3`
- **Chip:** `inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-slate-50 border border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400`

### 7.2 Title

- **Wrapper:** `role="heading"` `aria-level={1}` — `text-sm font-semibold text-slate-900 dark:text-white leading-snug mb-3`
- **Content:** `MarkdownRenderer` **without** `prose` (compact markdown mapping). Loading: pulse bar `h-4 max-w-[85%] rounded bg-slate-200/80 dark:bg-slate-800`

### 7.3 Meta row (read time + date)

- **Row:** `flex items-center gap-4 text-xs font-medium text-slate-500 dark:text-slate-400`
- **Read time cluster:** `flex items-center gap-1.5`, icon `Clock` **14px**
- **Date:** plain text when `publishedAt` exists (`formatDate`)

### 7.4 “Source” pill (when `sourceUrl` resolved)

- **Element:** `<a target="_blank" rel="noopener noreferrer">`
- **Layout:** `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full w-fit`
- **Colors:** `bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-200 transition-colors`
- **Icon:** `ExternalLink` **12px**, `flex-shrink-0`
- **Label:** `text-[11px] font-semibold` — text `"Source"`

---

## 8. Media carousel (`isModal && currentDrawerMedia`)

Unified carousel for primary + supporting media (deduped list). Renders **below** source button in flow; body markdown follows in code order after carousel (see implementation file for exact order).

### 8.1 Section spacing

- **Outer:** `pt-2`, `ref` for scroll-into-view / intersection

### 8.2 Touch swipe (when not showing inline YouTube)

- Swipe threshold **40px** horizontal delta to change slide

### 8.3 Media frame

- **Outer:** `relative`
- **Card:** `w-full bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden`
- **Aspect ratio:** YouTube `16/9`; image uses `aspect_ratio` from media or default **`4/3`**

### 8.4 Carousel chrome (when `drawerMediaItems.length > 1`)

- **Prev / Next buttons:** `absolute left-2 | right-2 top-1/2 -translate-y-1/2`, `p-2 rounded-full bg-black/60 hover:bg-black/75 text-white transition-colors z-10`, icons `ChevronLeft` / `ChevronRight` **16px**
- **Counter pill:** `absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 text-white text-[10px] px-2 py-1 z-10` — pattern `{index+1} / {total}`

### 8.5 Floating “Jump to player”

When modal, media exists, and carousel scrolls mostly out of view (`intersectionRatio < 0.2` with root = `#drawer-content`):

- **Position:** `fixed bottom-4 right-4 z-30`
- **Size:** `h-10 w-10` circle, `inline-flex items-center justify-center rounded-full`
- **Surface:** `border border-slate-200 bg-white/95 text-slate-700 shadow-lg backdrop-blur`, dark: `dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-200`
- **Hover:** `hover:bg-slate-100 dark:hover:bg-slate-800`
- **Focus:** `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500`
- **Icon:** `ArrowUp` **16px**; label sr-only “Jump to player”

---

## 9. Body markdown (analysis / excerpt)

### 9.1 Wrapper

- **Classes:** `nugget-content text-xs text-slate-600 dark:text-slate-400 leading-relaxed`
- **Renderer:** `MarkdownRenderer` with default `prose={false}` → **compact** component map
- **Root markdown class:** inner wrapper gets `markdown-content` from `MarkdownRenderer`

### 9.2 Compact markdown typography (`MarkdownRenderer` — used in drawer)

All headings h1–h4 in markdown: `text-xs font-bold mt-1.5 mb-1 text-slate-900 dark:text-white leading-tight`

- **Paragraph:** `mb-1.5`
- **ul:** `list-disc list-outside ml-4 mb-2 space-y-1`
- **ol:** `list-decimal list-outside ml-4 mb-2 space-y-1`
- **li:** `pl-0.5`
- **blockquote:** `border-l-4 border-slate-300 dark:border-slate-600 pl-4 italic my-4 text-slate-600 dark:text-slate-400`
- **Inline code:** `bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-xs font-mono text-pink-600 dark:text-pink-400`
- **Code block:** `block bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-sm font-mono overflow-x-auto`
- **pre:** `bg-slate-100 dark:bg-slate-800 rounded-lg overflow-x-auto my-3`
- **Links:** `text-primary-600 dark:text-primary-400 hover:underline`, `target="_blank"`
- **strong:** `font-bold text-slate-900 dark:text-slate-100`
- **em:** `italic`
- **hr:** `my-6 border-slate-200 dark:border-slate-700`
- **Tables:** wrapper `markdown-table-wrapper overflow-x-auto -mx-1 px-1`; table `markdown-table w-full border-collapse my-3 text-xs sm:text-sm`; thead `bg-slate-50 dark:bg-slate-800/50`; th/td per component (borders slate-200/700/100/800)

### 9.3 YouTube / timestamp interactions

When `onYouTubeTimestampClick` is passed, links and timestamp pseudo-links become **buttons** with `text-primary-600 dark:text-primary-400`, optional flash `bg-primary-100 dark:bg-primary-900/40`.

### 9.4 `.nugget-content` table overrides (`index.css`)

Tables inside `.nugget-content` **inherit** font size/weight/line-height/color from the `text-xs` parent; cell padding emphasized with `!important` rules; borders use slate-200 / slate-100 (light) and slate-700 (dark header); zebra/hover rows use rgba slate tints. Mobile (`max-width: 640px`): slightly tighter cell padding.

### 9.5 Body loading fallback

- Container: `nugget-content text-xs ... space-y-2` + three pulse lines (`h-3`, varying max-widths, `rounded bg-slate-200/80 dark:bg-slate-800`)

---

## 10. Disclaimer (optional)

- **Container:** `mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] italic text-slate-400 dark:text-slate-500 leading-snug [&_a]:underline [&_a]:text-slate-500 dark:[&_a]:text-slate-400`
- **Content:** `MarkdownRendererLazy` (same compact stack as body)

---

## 11. Content not shown in drawer/modal path

- **`!isModal` primary media block** and **standalone supporting-media layout** use separate branches in `ArticleDetail`. The repo includes `SupportingMediaSection.tsx` (section title “Sources & Attachments”, grids, lists) but **`ArticleDetail` currently ends with a comment `{/* Supporting Media */}` and does not mount that component** — do not assume that section appears in production UI unless wired in.

---

## 12. Loading fallbacks (`ArticleDetailLazy.tsx`)

- **Full panel:** centered `min-h-[400px]`, spinner `h-8 w-8` circular border `border-b-2 border-primary-500`, caption `text-sm text-slate-500 dark:text-slate-400` — “Loading article...”

---

## 13. Recreation checklist (LLM-oriented)

1. **Portal + overlay:** full-viewport flex `justify-end`; backdrop dim + optional blur (drawer) vs slate tint (modal).
2. **Panel:** white/slate-950, left border slate-200/800, shadow-2xl, slide from right 200 ms (drawer) or slide-in-from-right 300 ms (modal).
3. **Scroll:** single vertical scroller with thin yellow scrollbar (primary palette).
4. **Sticky header:** frosted bar, avatar 24px, name sm bold, icon buttons 40px touch targets (p-2 + 20px icons).
5. **Body:** tags as 10px pills → title sm semibold markdown → meta xs medium slate-500 → optional Source pill (inverted colors) → optional media carousel with rounded-xl frame and black/60 controls → body **xs** relaxed slate-600 markdown compact theme → disclaimer 10px italic separated by border-t.
6. **Dark mode:** mirror every `dark:` class above.
7. **Primary accent:** links, focus ring, scrollbar, spinner — keep hex alignment with `tailwind.config.js` primary scale.

---

## 14. Source file map

| Concern | File |
|---------|------|
| Drawer shell, backdrop, width breakpoints | `src/components/ArticleDrawer.tsx` |
| Modal shell + panel width | `src/components/ArticleModal.tsx`, `src/components/UI/ModalShell.tsx` |
| Article layout, sections, carousel, disclaimer | `src/components/ArticleDetail.tsx` |
| Sticky header | `src/components/shared/DetailTopBar.tsx` |
| Markdown element mapping | `src/components/MarkdownRenderer.tsx` |
| Lazy fallbacks | `src/components/ArticleDetailLazy.tsx` |
| Scrollbar + `.nugget-content` tables | `index.css` |
| Brand yellow scale | `tailwind.config.js` |

---

*Generated from repository inspection. When the implementation changes, update this spec or regenerate from source.*
