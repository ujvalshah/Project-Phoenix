# React → Next.js UI/UX Reconstruction Specification

**Document Purpose:** This specification enables an LLM to rebuild the same visual appearance, layout, interaction behavior, and UX patterns in Next.js (App Router) from the original React SPA, with zero visual or behavioral drift.

**Critical Constraint:** Document ONLY what exists. Do not propose improvements, modernizations, or redesigns.

---

## Table of Contents

1. [Global Layout & Page Structure](#1-global-layout--page-structure)
2. [Feed / Card System (Primary UX Surface)](#2-feed--card-system-primary-ux-surface)
3. [Typography System](#3-typography-system)
4. [Color & Theme Tokens](#4-color--theme-tokens)
5. [Spacing & Density](#5-spacing--density)
6. [Component Inventory](#6-component-inventory)
7. [Interaction & UX Behavior](#7-interaction--ux-behavior)
8. [Responsiveness](#8-responsiveness)
9. [State, Loading & Feedback](#9-state-loading--feedback)
10. [React → Next.js Mapping Notes](#10-react--nextjs-mapping-notes)
11. [Non-negotiable UI/UX Behaviors to Preserve](#11-non-negotiable-uiux-behaviors-to-preserve)
12. [Next.js Implementation Constraints for Parity](#12-nextjs-implementation-constraints-for-parity)

---

## 1. Global Layout & Page Structure

### 1.1 Overall Layout Model

**Architecture:**
- **Layout Model:** Document-based scrolling (body is scroll container)
- **Header:** Fixed positioned, renders OUTSIDE MainLayout component (in App.tsx root)
- **Content Flow:** Natural document flow below fixed header
- **Spacing:** Explicit spacers (HeaderSpacer, CategorySpacer) handle fixed/sticky element space reservation

**Layout Invariant (CRITICAL):**
```
Fixed headers do not reserve space.
All fixed/sticky elements require explicit spacers.
No padding-top hacks - use spacers instead.
```

**Files:**
- `src/App.tsx` - Header rendered at root level
- `src/components/layouts/MainLayout.tsx` - Content container only
- `src/components/layouts/PageStack.tsx` - Vertical stacking with spacers

### 1.2 Container Widths & Gutters

**Width Constraints:**
- **Content Max Width:** `max-w-[1600px]` or `max-w-[1800px]` (varies by page)
- **Content Padding:** `px-4 lg:px-6` (standard horizontal padding)
- **Toolbar Padding:** `px-4 lg:px-6` (Header uses this)

**Grid Layout:**
- **Grid Columns (Grid View):**
  - Mobile: `grid-cols-1`
  - Tablet (md): `md:grid-cols-2`
  - Desktop (lg): `lg:grid-cols-3`
  - Large Desktop (xl): `xl:grid-cols-4`
- **Gap:** `gap-6` (24px) for grid, `gap-4` (16px) for masonry

**Files:**
- `src/components/ArticleGrid.tsx` - Grid column definitions
- `src/constants/layout.ts` - Layout constants

### 1.3 Header Behavior

**Height:**
- **Mobile (< lg):** `h-14` (56px)
- **Desktop (>= lg):** `h-16` (64px)

**Positioning:**
- **Type:** `fixed top-0 left-0 right-0`
- **Z-Index:** `z-50` (defined in `Z_INDEX.HEADER`)
- **Background:** `bg-white` (light), `bg-slate-900` (dark mode)
- **Spacing:** Header owns its vertical space, content flows below

**Layout Rules:**
- Header MUST be rendered outside MainLayout (prevents layout shifts)
- HeaderSpacer MUST be used in PageStack to reserve space
- Header never wraps or conditionally renders based on content state

**Files:**
- `src/components/Header.tsx` - Header implementation
- `src/components/layouts/PageStack.tsx` - HeaderSpacer usage
- `src/constants/layout.ts` - Header height constants

### 1.4 Footer

**No Global Footer:** Application does not have a global footer component. All navigation is in Header or Navigation Drawer.

### 1.5 Sidebar Behavior

**Navigation Drawer:**
- **Type:** Portal-based overlay (not persistent sidebar)
- **Position:** `fixed` with slide-in animation from left
- **Width:** `w-[280px]`
- **Z-Index:** `Z_INDEX.HEADER_OVERLAY` (100)
- **Trigger:** Hamburger menu button in Header
- **Behavior:** Closes on outside click, Escape key, or navigation link click

**Files:**
- `src/components/Header.tsx` - NavigationDrawer component (internal)

### 1.6 Scroll Handling

**Scroll Container:**
- **Type:** Document/body scrolling (NOT container-based)
- **Scroll Restoration:** Browser default (no custom scroll restoration logic)
- **Scroll Padding:** `scroll-padding-top: 64px` (desktop), `56px` (mobile) - defined in `index.css`

**Infinite Scroll:**
- **Trigger:** Intersection Observer with `rootMargin: '300px'` (prefetch distance)
- **Trigger Element:** Placed at bottom of article list
- **Loading Indicator:** `Loader2` spinner with "Loading more..." text
- **Threshold:** `threshold: 0` (triggers when any part enters viewport)

**Files:**
- `src/components/ArticleGrid.tsx` - InfiniteScrollTrigger component
- `index.css` - Scroll padding rules

### 1.7 Route-Level Layout Differences

**HomePage (/):**
- Uses `PageStack` with optional `categoryToolbar` (TagFilterBar)
- Main content wrapped in `max-w-[1800px] mx-auto px-4 lg:px-6 pb-4`
- No additional layout wrapper

**Collections Pages (/collections, /collections/:id):**
- Uses `PageStack` without category toolbar
- Page-specific toolbar via `PageToolbar` component (sticky below header)

**Profile Pages (/profile/:userId, /myspace):**
- Uses `PageStack` without category toolbar
- Tab-based navigation within page

**Admin Pages (/admin/*):**
- Uses admin-specific layout with AdminSidebar
- AdminTopbar component for sub-navigation

**Files:**
- `src/pages/HomePage.tsx`
- `src/pages/CollectionsPage.tsx`
- `src/components/layouts/PageStack.tsx`

---

## 2. Feed / Card System (Primary UX Surface)

### 2.1 Card Types

**Two-Card Architecture:**
1. **Hybrid Card:** Media block at top, tags, title, body content, footer
2. **Media-Only Card:** Media fills card body, optional short caption with gradient overlay, footer

**Card Type Detection:**
- Determined by `article.cardType` property (`'hybrid'` | `'media-only'`)
- Media-only cards have no text wrapper block, no hybrid spacing/padding

**Files:**
- `src/components/card/variants/GridVariant.tsx`
- `src/components/card/variants/MasonryVariant.tsx`
- `src/components/card/variants/FeedVariant.tsx`

### 2.2 Grid Rules

**Grid View (GridVariant):**
- **Columns:** Responsive (1/2/3/4 columns based on breakpoint)
- **Rows:** `auto-rows-auto` (mobile), `md:auto-rows-fr` (tablet+)
- **Card Height:** Equal-height rows (via `auto-rows-fr` and `flex flex-col h-full` on cards)
- **Spacing:** `gap-6` (24px)

**Masonry View (MasonryVariant):**
- **Columns:** Fixed count per breakpoint
  - Mobile: 1 column
  - Tablet (md): 2 columns
  - Desktop (lg): 3 columns
  - Large (xl): 4 columns
- **Layout:** CSS columns (NOT grid) with `break-inside-avoid` on cards
- **Card Height:** Auto (natural content height)
- **Spacing:** `mb-6` (24px bottom margin between cards)

**Feed View (FeedVariant):**
- **Width:** `max-w-2xl mx-auto`
- **Spacing:** `gap-8` (32px vertical spacing)
- **Card Height:** Auto (natural content height)

**Utility View:**
- Same as Grid View but with different card styling (compact)

**Files:**
- `src/components/ArticleGrid.tsx` - Grid layout definitions
- `src/components/MasonryGrid.tsx` - Masonry column logic

### 2.3 Card Dimensions & Consistency

**Grid Card:**
- **Container:** `flex flex-col h-full`
- **Border Radius:** `rounded-xl` (12px)
- **Padding (Body):** `px-4 pb-2` (16px horizontal, 8px bottom)
- **Padding (Media):** `pt-2 px-2 pb-2` (8px top, 8px horizontal, 8px bottom)
- **Gap (Internal):** `gap-2` (8px between elements)

**Masonry Card:**
- **Container:** `flex flex-col` (no fixed height)
- **Border Radius:** `rounded-2xl` (16px)
- **Padding:** `p-4` (16px all sides)
- **Margin Bottom:** `mb-6` (24px)
- **Break Inside:** `break-inside-avoid` (prevents card splitting across columns)

**Feed Card:**
- **Container:** `flex flex-col`
- **Border Radius:** `rounded-2xl` (16px)
- **Padding:** `p-6` (24px all sides)
- **Gap:** `gap-4` (16px between elements)

**Files:**
- `src/components/card/variants/GridVariant.tsx`
- `src/components/card/variants/MasonryVariant.tsx`
- `src/components/card/variants/FeedVariant.tsx`

### 2.4 Image Handling Rules

**Aspect Ratio:**
- **Hybrid Cards:** `aspect-video` (16:9) for media block
- **Media-Only Cards:** `w-full h-full` with `object-cover` (fills available space, crops to fit)
- **Media-Only (contain mode):** `object-contain` when `isMediaOnly={true}` (shows full image, no crop)

**Cropping vs Contain:**
- **Hybrid Cards:** `object-cover` (crop to fill)
- **Media-Only Cards:** `object-contain` (show full, no crop)

**Fallbacks:**
- **No Image:** `CardGradientFallback` component renders gradient background with title initials
- **Image Error:** Falls back to gradient fallback
- **Multi-Image Grid:** `CardThumbnailGrid` shows 2x2 or 3x3 grid when multiple images exist

**Image Sources:**
- Primary media: `article.media` object
- Legacy images: `article.images[]` array
- Thumbnail URL: Determined by `getThumbnailUrl()` utility

**Files:**
- `src/components/card/atoms/CardMedia.tsx`
- `src/components/card/atoms/CardGradientFallback.tsx`
- `src/components/card/atoms/CardThumbnailGrid.tsx`

### 2.5 Text Rules

**Title:**
- **Rendering:** Included inside `CardContent` truncation wrapper (wraps title + body together)
- **Line Limit:** Truncated via `line-clamp` (number of lines varies by variant)
- **Conditional:** Only shows if `shouldShowTitle` is true

**Summary/Content Truncation:**
- **Hybrid Cards:** Truncated with fade overlay when content overflows
- **Measurement:** Uses `useLayoutEffect` to measure `scrollHeight` vs `clientHeight`
- **Threshold:** Requires minimum 2.5 visible lines before truncation triggers
- **Tables:** Hidden in truncated state (`line-clamp` containers hide tables entirely)
- **Media-Only Cards:** No truncation, no fade (just renders content)

**Read-More Logic:**
- **Trigger:** Click on fade overlay expands content
- **State:** `isExpanded` state managed by `CardContent` component
- **Animation:** Height transition (no explicit duration, CSS transition)

**Metadata Placement:**
- **Location:** Footer row (`border-t` separator)
- **Left Side:** Author name, avatar, date (`CardMeta` component)
- **Right Side:** Action buttons (share, save, menu) (`CardActions` component)

**Files:**
- `src/components/card/atoms/CardContent.tsx` - Truncation and expansion logic
- `src/components/card/atoms/CardMeta.tsx` - Metadata display
- `src/components/card/atoms/CardTitle.tsx` - Title rendering (used within CardContent)

### 2.6 Action Affordances

**Footer Actions (CardActions):**
- **Share Button:** Icon button, opens share menu
- **Save/Bookmark Button:** Icon button, toggles save state
- **Menu Button:** Icon button, opens dropdown with edit/delete/report options

**Link Button:**
- **Position:** Absolutely positioned `top-2 right-2` over media area
- **Style:** `bg-black/70 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-full`
- **Conditional:** Only shows when `linkButtonProps.shouldShow` is true (has valid source URL)

**Selection Checkbox (Selection Mode):**
- **Position:** Absolutely positioned `top-3 right-3` with `z-20`
- **Size:** `w-6 h-6`
- **Style:** Circular checkbox with primary color when selected

**Files:**
- `src/components/card/atoms/CardActions.tsx`
- `src/components/card/variants/GridVariant.tsx` - Link button and selection checkbox

### 2.7 Tags Display

**Rendering:**
- **Max Visible:** 3 tags (grid), 2 tags (masonry/feed)
- **Style:** Muted pills with `text-xs` font size
- **Color:** `text-slate-600 dark:text-slate-400`
- **Background:** `bg-slate-100 dark:bg-slate-800`
- **Placement:** Above title/content in hybrid cards

**Interaction:**
- **Click:** Filters feed by tag (via `onTagClick` handler)
- **Popover:** Optional tag popover for tag management (admin only)

**Files:**
- `src/components/card/atoms/CardTags.tsx`

---

## 3. Typography System

### 3.1 Font Families

**Primary Font:**
- **Family:** `font-sans` (Tailwind default - system font stack)
- **Stack:** Browser default sans-serif (no custom font loading)
- **Loading Method:** System fonts (no @font-face declarations)

**Font Loading:**
- No web font imports
- No font preloading
- Relies on system font stack

**Files:**
- `index.css` - Global body styles
- `tailwind.config.js` - No custom font families defined

### 3.2 Font Sizes

**Scale (Tailwind defaults):**
- **Extra Small:** `text-[10px]` - Labels, badges, metadata
- **Small:** `text-xs` (12px) - Secondary text, descriptions, tags
- **Base:** `text-sm` (14px) - Body text, navigation labels, button text
- **Medium:** `text-base` (16px) - Titles, headings
- **Large:** `text-lg` (18px) - Large headings

**Card-Specific Typography:**
- **Card Title:** `text-base` (16px) in grid, `text-lg` (18px) in feed
- **Card Content:** `text-sm` (14px) - Body text
- **Card Metadata:** `text-xs` (12px) - Author, date
- **Card Tags:** `text-[10px]` - Tag labels

**Files:**
- `src/components/card/atoms/CardTitle.tsx`
- `src/components/card/atoms/CardContent.tsx`
- `src/components/card/atoms/CardMeta.tsx`

### 3.3 Font Weights

**Scale:**
- **Normal:** `font-normal` (400) - Body text
- **Medium:** `font-medium` (500) - Navigation, labels, metadata
- **Bold:** `font-bold` (700) - Titles, important text
- **Extra Bold:** `font-extrabold` (800) - Brand name, emphasis

**Usage:**
- **Card Titles:** `font-bold` or `font-medium` (varies by variant)
- **Navigation:** `font-medium` (500)
- **Buttons:** `font-bold` or `font-medium`
- **Brand Logo:** `font-extrabold` (800)

**Files:**
- `src/components/Header.tsx` - Navigation weights
- `src/components/card/atoms/CardTitle.tsx` - Title weights

### 3.4 Line Heights

**Defaults:**
- Uses Tailwind default line heights (relative to font size)
- No explicit `line-height` overrides in most components

**Card Content:**
- Inherits from parent container
- No explicit line-height declarations

### 3.5 Heading Hierarchy

**Usage:**
- **H1:** Not used in cards or main content
- **H2:** Not used in cards (CardTitle renders as `div` or `h3`)
- **H3:** Used in modal titles, page headings
- **Card Titles:** Rendered as `div` or `h3` (not semantic headings)

**Files:**
- `src/components/card/atoms/CardTitle.tsx` - Renders as `h3` or `div`

### 3.6 Muted vs Primary Text Semantics

**Primary Text:**
- **Light Mode:** `text-slate-900` or `text-gray-900`
- **Dark Mode:** `text-white` or `dark:text-white`

**Secondary Text:**
- **Light Mode:** `text-slate-600` or `text-gray-600`
- **Dark Mode:** `text-slate-300` or `dark:text-slate-300`

**Muted Text:**
- **Light Mode:** `text-slate-500`, `text-gray-500`, or `text-slate-400`
- **Dark Mode:** `text-slate-400` or `dark:text-slate-400`

**Disabled Text:**
- **Light Mode:** `text-slate-400` or `text-gray-400`
- **Dark Mode:** `text-slate-500`

**Files:**
- Various card components use these semantic color classes

---

## 4. Color & Theme Tokens

### 4.1 Color Palette

**Primary Color (Yellow/Gold):**
```
primary-50:  #fffbea   // Lightest
primary-100: #fff5c8
primary-200: #ffea96
primary-300: #fde047
primary-400: #facc15
primary-500: #eab308   // Main primary (scrollbars, accents)
primary-600: #ca8a04   // Hover states
primary-700: #a16207
primary-800: #854d0e
primary-900: #713f12   // Darkest
```

**Usage:**
- **Accent:** `primary-500` (#eab308) - Scrollbars, focus rings, highlights
- **Hover:** `primary-600` (#ca8a04)
- **Focus:** `ring-primary-500` or `ring-yellow-400`

**Files:**
- `tailwind.config.js` - Primary color definition
- `index.css` - Scrollbar colors use primary-500

**Collection Colors (Accent Themes):**
```javascript
[
  { bg: 'bg-blue-500', text: 'text-blue-600', light: 'bg-blue-50' },
  { bg: 'bg-emerald-500', text: 'text-emerald-600', light: 'bg-emerald-50' },
  { bg: 'bg-indigo-500', text: 'text-indigo-600', light: 'bg-indigo-50' },
  { bg: 'bg-amber-500', text: 'text-amber-600', light: 'bg-amber-50' },
  { bg: 'bg-teal-500', text: 'text-teal-600', light: 'bg-teal-50' },
  { bg: 'bg-cyan-500', text: 'text-cyan-600', light: 'bg-cyan-50' },
  { bg: 'bg-slate-500', text: 'text-slate-600', light: 'bg-slate-50' },
]
```

**Files:**
- `src/components/collections/CollectionCard.tsx` - Collection badge colors

### 4.2 Neutral Colors (Slate/Gray Scale)

**Light Mode:**
- **Background:** `bg-white`
- **Subtle Background:** `bg-slate-50`, `bg-gray-50`
- **Borders:** `border-slate-200`, `border-gray-100`, `border-gray-200`
- **Text Primary:** `text-slate-900`, `text-gray-900`
- **Text Secondary:** `text-slate-600`, `text-gray-500`, `text-gray-600`
- **Text Muted:** `text-slate-400`, `text-gray-400`
- **Hover Backgrounds:** `bg-gray-100`, `bg-slate-100`

**Dark Mode:**
- **Background:** `bg-slate-900`, `dark:bg-slate-900`
- **Subtle Background:** `bg-slate-800`, `dark:bg-slate-800`
- **Borders:** `border-slate-700`, `border-slate-800`
- **Text Primary:** `text-white`, `dark:text-white`
- **Text Secondary:** `text-slate-300`, `dark:text-slate-300`
- **Text Muted:** `text-slate-400`, `dark:text-slate-400`

### 4.3 Background vs Surface Usage

**Global Background:**
- **MainLayout:** `bg-slate-100 dark:bg-slate-950`
- **Body:** Inherits from MainLayout

**Card Surface:**
- **Light:** `bg-white dark:bg-slate-900`
- **Border:** `border-slate-200 dark:border-slate-800` (cards)
- **Border (Subtle):** `border-slate-100 dark:border-slate-800` (dividers)

**Header Surface:**
- **Light:** `bg-white`
- **Dark:** Inherits from MainLayout (no explicit dark background)

**Files:**
- `src/components/layouts/MainLayout.tsx` - Global background
- `src/components/card/variants/GridVariant.tsx` - Card backgrounds

### 4.4 Border, Divider & Shadow Rules

**Borders:**
- **Card Border:** `border border-slate-200 dark:border-slate-700` (grid), `border-slate-200 dark:border-slate-800` (masonry/feed)
- **Border Radius (Cards):** `rounded-xl` (12px - grid), `rounded-2xl` (16px - masonry/feed)
- **Border Radius (Buttons):** `rounded-lg` (8px), `rounded-xl` (12px), `rounded-full` (pills)

**Dividers:**
- **Card Footer Divider:** `border-t border-slate-100 dark:border-slate-800`
- **Section Dividers:** `border-t border-gray-100` (light), `border-slate-800` (dark)

**Shadows:**
- **Card Shadow (Default):** `shadow-sm` (subtle)
- **Card Shadow (Hover):** `hover:shadow-md` (grid), `hover:shadow-lg` (masonry/feed)
- **Feed Card Shadow:** `shadow-[0_8px_24px_rgba(0,0,0,0.04)]` (custom)
- **Feed Card Hover:** `hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)]`
- **Masonry Tile Hover:** `box-shadow: 0 10px 18px rgba(0, 0, 0, 0.08)` (light), `rgba(0, 0, 0, 0.25)` (dark)

**Files:**
- `index.css` - Masonry tile hover shadow definitions
- Card variant files - Shadow classes

### 4.5 Theme Assumptions

**Theme Strategy:**
- **Mode:** `class` strategy (`darkMode: 'class'` in Tailwind config)
- **Toggle:** Manual toggle via theme button in Header
- **System Preference:** Detects `prefers-color-scheme: dark` on mount but allows manual override
- **Persistence:** Theme state stored in React state (not persisted to localStorage in current implementation)

**Implementation:**
- Dark mode toggled via `html.classList.add('dark')` / `remove('dark')`
- All components support dark mode via `dark:` variants

**Files:**
- `src/App.tsx` - Theme state and toggle logic
- `tailwind.config.js` - `darkMode: 'class'`

---

## 5. Spacing & Density

### 5.1 Spacing Scale

**Tailwind Spacing Scale (4px base unit):**
- `gap-1` = 4px
- `gap-2` = 8px
- `gap-3` = 12px
- `gap-4` = 16px
- `gap-6` = 24px
- `gap-8` = 32px

**Padding:**
- **Compact:** `p-1` (4px), `p-2` (8px)
- **Standard:** `p-3` (12px), `p-4` (16px)
- **Large:** `p-5` (20px), `p-6` (24px)
- **Card Padding:** `p-4` to `p-5` (16px-20px) varies by variant

### 5.2 Vertical Rhythm Conventions

**8-Point Grid Rhythm:**
- Primary spacing unit: 8px
- Card internal spacing: `gap-2` (8px)
- Card padding: Multiples of 4px or 8px
- Section spacing: `gap-6` (24px) or `gap-8` (32px)

**Card Internal Spacing:**
- **Grid Card Body:** `px-4 pb-2 gap-2` (16px horizontal, 8px bottom, 8px gap)
- **Masonry Card:** `p-4` with `mb-2` between elements
- **Feed Card:** `p-6 gap-4` (24px padding, 16px gap)

**Files:**
- `src/components/card/variants/GridVariant.tsx` - Spacing examples

### 5.3 Card Internal Spacing Rules

**Grid Card:**
- **Media Block:** `pt-2 px-2 pb-2` (8px top/horizontal/bottom)
- **Card Body:** `px-4 pb-2 gap-2` (16px horizontal, 8px bottom, 8px vertical gap)
- **Footer:** `px-4 py-2` (16px horizontal, 8px vertical)

**Masonry Card:**
- **Container:** `p-4` (16px all sides)
- **Between Elements:** `mb-2` (8px bottom margin)
- **Footer:** `pt-1` (4px top padding) with `border-t`

**Feed Card:**
- **Container:** `p-6` (24px all sides)
- **Gap:** `gap-4` (16px between elements)
- **Footer:** `pt-3` (12px top padding) with `border-t`

**Files:**
- Card variant files contain exact spacing values

---

## 6. Component Inventory

### 6.1 Core Reusable Components

**Layout Components:**
- `MainLayout` - Global content container
- `PageStack` - Vertical stacking with spacers
- `HeaderSpacer` - Reserves space for fixed header
- `CategorySpacer` - Reserves space for sticky category bar
- `PageToolbar` - Sticky toolbar for sub-pages

**Card Components:**
- `NewsCard` - Main card wrapper (routes to variants)
- `GridVariant` - Grid view card layout
- `MasonryVariant` - Masonry view card layout
- `FeedVariant` - Feed view card layout
- `UtilityVariant` - Utility view card layout

**Card Atoms:**
- `CardMedia` - Media/image rendering
- `CardTitle` - Title rendering
- `CardContent` - Content with truncation/expansion
- `CardMeta` - Author, date metadata
- `CardTags` - Tag pills display
- `CardActions` - Share, save, menu buttons
- `CardBadge` - Source type badge
- `CardContributor` - Contributor badge
- `CardGradientFallback` - Gradient fallback for no-image cards
- `CardThumbnailGrid` - Multi-image grid thumbnail

**Feed Components:**
- `ArticleGrid` - Grid container with responsive columns
- `MasonryGrid` - Masonry layout container
- `CardSkeleton` - Loading skeleton placeholder
- `CardError` - Error state card

**Header Components:**
- `Header` - Main header (fixed)
- `FilterPopover` - Filter dropdown
- `TagFilterBar` - Horizontal tag filter bar
- `CategoryFilterBar` - Category filter (deprecated, replaced by tags)

**Modal Components:**
- `ArticleModal` - Article detail modal
- `CreateNuggetModal` - Create/edit nugget modal
- `AuthModal` - Authentication modal
- `ImageLightbox` - Image carousel lightbox

**Files:**
- `src/components/` directory structure

### 6.2 Variants and States

**Card Variants:**
- `variant="grid"` - Compact grid card
- `variant="masonry"` - Masonry card with flexible height
- `variant="feed"` - Wide feed card
- `variant="utility"` - Compact utility card

**Loading States:**
- `CardSkeleton` - Matches card structure (3 variants: grid, masonry, feed)
- `Loader2` spinner - For infinite scroll loading

**Error States:**
- `CardError` - Error card with retry button
- `EmptyState` - Empty state with icon, title, description

**Selection States:**
- Selection mode via `selectionMode` prop
- Checkbox overlay when in selection mode
- Selected state: `border-primary-500 ring-1 ring-primary-500`

**Files:**
- `src/components/card/CardSkeleton.tsx`
- `src/components/card/CardError.tsx`
- `src/components/UI/EmptyState.tsx`

### 6.3 Implicit Design Contracts

**Props That Change Layout/Appearance:**
- `variant` prop on CardContent/CardSkeleton - Changes typography, spacing
- `cardType` prop (`'hybrid'` | `'media-only'`) - Changes card structure
- `isMediaOnly` prop on CardMedia - Changes image object-fit behavior
- `allowExpansion` prop on CardContent - Enables/disables truncation
- `selectionMode` prop - Shows/hides selection checkbox, disables footer actions
- `viewMode` prop on ArticleGrid - Changes grid layout (grid/masonry/feed/utility)

**Files:**
- Card variant files contain these prop contracts

---

## 7. Interaction & UX Behavior

### 7.1 Hover, Focus, Active States

**Card Hover:**
- **Grid Card:** `hover:shadow-md` (shadow increase)
- **Masonry Card:** `hover:shadow-lg hover:border-slate-300` (shadow + border color)
- **Masonry Tile (Image):** `translateY(-2px) scale(1.015)` with `box-shadow` (desktop only, `@media (hover: hover)`)
- **Feed Card:** `hover:-translate-y-0.5` (subtle lift) + `hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)]`

**Button Hover:**
- **Primary Button:** `hover:scale-[1.02]` (subtle scale)
- **Icon Button:** `hover:text-gray-700` (color change)
- **Link Button (on card):** `hover:bg-black/90 hover:scale-105`

**Focus States:**
- **Focus Ring:** `focus:ring-2 focus:ring-primary-500 focus:ring-offset-2`
- **Focus Visible:** `focus-visible:outline-2px solid rgb(59, 130, 246)` (blue-500)
- **Masonry Tile Focus:** `outline: 2px solid rgb(59, 130, 246)`, no scale animation on focus

**Active States:**
- Navigation items: `bg-white text-gray-900` (active), `text-gray-500 hover:text-gray-700` (inactive)

**Files:**
- `index.css` - Masonry tile hover styles
- Card variant files - Hover classes

### 7.2 Navigation Behavior (Client-Side Routing)

**Router:**
- **Library:** React Router v7 (`react-router-dom`)
- **Type:** `BrowserRouter` (clean URLs, no hash)
- **Base:** Root path (`/`)

**Route Patterns:**
- `/` - HomePage (feed with filters)
- `/collections` - Collections list
- `/collections/:collectionId` - Collection detail
- `/profile/:userId` - Profile page (public or own)
- `/myspace` - Redirects to `/profile/:currentUserId`
- `/account` - Account settings (protected)
- `/admin/*` - Admin panel with nested routes (protected)
- `/about`, `/terms`, `/privacy`, etc. - Legal pages (dynamic)

**Navigation:**
- **Client-Side:** All navigation uses `Link` components (no page reloads)
- **Hash Redirect:** Legacy `/#/path` URLs redirect to `/path` (backwards compatibility)
- **Protected Routes:** `ProtectedRoute` wrapper redirects to home if not authenticated

**Scroll Restoration:**
- **Default:** Browser default scroll restoration (no custom logic)
- **State Preservation:** No scroll position preservation on route change

**Files:**
- `src/App.tsx` - Route definitions
- `src/main.tsx` - BrowserRouter setup
- `src/components/auth/ProtectedRoute.tsx`

### 7.3 Expand/Collapse Patterns

**Card Content Expansion:**
- **Trigger:** Click on fade overlay (when content is truncated)
- **State:** `isExpanded` managed by `CardContent` component
- **Animation:** CSS height transition (no explicit duration)
- **Measurements:** Uses `useLayoutEffect` to measure overflow
- **Threshold:** Requires minimum 2.5 visible lines before truncation triggers

**Files:**
- `src/components/card/atoms/CardContent.tsx` - Expansion logic

### 7.4 Read-More Logic

**Truncation Detection:**
- **Method:** Measurement-based (compares `scrollHeight` vs `clientHeight`)
- **Timing:** `useLayoutEffect` after render to ensure accurate measurements
- **Threshold:** `MIN_VISIBLE_LINES = 2.5` (requires 2.5 visible lines before truncation)

**Truncation Display:**
- **CSS:** `line-clamp-{n}` utility (variant-specific line counts)
- **Fade Overlay:** Gradient fade at bottom when truncated
- **Read More:** Fade overlay is clickable to expand

**Tables in Content:**
- **Truncated State:** Tables hidden entirely (`display: none` in line-clamp containers)
- **Expanded State:** Tables shown normally

**Files:**
- `src/components/card/atoms/CardContent.tsx` - Truncation and read-more logic
- `index.css` - Table hiding rules in truncated content

### 7.5 Scroll Restoration Behavior

**Current Implementation:**
- **Default Browser Behavior:** Uses browser's default scroll restoration
- **No Custom Logic:** No `useEffect` hooks to restore scroll position
- **Route Changes:** Scroll position resets to top on route change (browser default)

**Infinite Scroll:**
- **Position Preservation:** Not preserved when filters/search change (query key change resets scroll)
- **Pagination:** New pages append to bottom, scroll position maintained during load-more

**Files:**
- No explicit scroll restoration code found (relies on browser default)

---

## 8. Responsiveness

### 8.1 Breakpoints

**Tailwind Default Breakpoints:**
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px (main breakpoint for desktop/mobile split)
- `xl`: 1280px
- `2xl`: 1536px

**Tablet Detection:**
- Custom logic: `window.innerWidth >= 768 && window.innerWidth < 1024`
- Used for conditional rendering (e.g., filter popover behavior)

**Files:**
- `src/components/Header.tsx` - Tablet detection logic
- `src/constants/layout.ts` - Breakpoint constants

### 8.2 Mobile vs Desktop Differences

**Header:**
- **Mobile (< lg):** `h-14` (56px), simplified layout with hamburger menu
- **Desktop (>= lg):** `h-16` (64px), full navigation bar visible

**Grid Columns:**
- **Mobile:** `grid-cols-1` (1 column)
- **Tablet (md):** `md:grid-cols-2` (2 columns)
- **Desktop (lg):** `lg:grid-cols-3` (3 columns)
- **Large (xl):** `xl:grid-cols-4` (4 columns)

**Masonry Columns:**
- **Mobile:** 1 column
- **Tablet (md):** 2 columns
- **Desktop (lg):** 3 columns
- **Large (xl):** 4 columns

**Search:**
- **Mobile:** Search icon button opens full-screen overlay
- **Desktop:** Inline search bar in header center

**View Mode Buttons:**
- **Mobile:** Grid and Masonry only (Utility hidden)
- **Desktop:** All three view modes (Grid, Masonry, Utility)

**Navigation:**
- **Mobile:** Hamburger menu opens drawer
- **Desktop:** Inline navigation pills in header

**Files:**
- `src/components/Header.tsx` - Responsive header layout
- `src/components/ArticleGrid.tsx` - Responsive grid columns

### 8.3 Components That Adapt vs Collapse

**Adapt:**
- **Grid:** Column count adapts (1/2/3/4 columns)
- **Header:** Layout adapts (simplified mobile, full desktop)
- **Search:** Overlay on mobile, inline on desktop
- **Masonry:** Column count adapts

**Collapse:**
- **Navigation:** Drawer on mobile, inline on desktop
- **View Modes:** Utility mode hidden on mobile
- **Filter Popover:** Combined filter+sort on tablet, separate on desktop

**Files:**
- Various components use `hidden lg:flex` / `flex lg:hidden` patterns

---

## 9. State, Loading & Feedback

### 9.1 Loading States

**Skeleton Loaders:**
- **Component:** `CardSkeleton` with 3 variants (grid, masonry, feed)
- **Structure:** Matches real card layout (media, tags, title, content, footer)
- **Animation:** `animate-shimmer` (gradient animation)
- **Count:** 6 skeletons shown during initial load
- **Placement:** Replaces card grid during loading

**Loading Indicators:**
- **Infinite Scroll:** `Loader2` spinner with "Loading more..." text
- **Button Loading:** `Loader2` spinner replaces button content
- **Page Loading:** `Loader2` spinner in Suspense fallback

**Loading Behavior:**
- **Initial Load:** Shows skeleton grid
- **Load More:** Shows spinner at bottom of list
- **Filter/Search Change:** Shows skeleton grid (query resets)

**Files:**
- `src/components/card/CardSkeleton.tsx`
- `src/components/ArticleGrid.tsx` - Loading state rendering

### 9.2 Empty States and Copy Tone

**Empty State Component:**
- **Icon:** Lucide icon (typically `SearchX`)
- **Title:** String prop (e.g., "No nuggets found")
- **Description:** String prop (e.g., "Try adjusting your search or filters.")

**Copy Tone:**
- **Concise:** Short, direct messages
- **Helpful:** Suggests actions (e.g., "Try adjusting your search")
- **Neutral:** No emojis, no excessive punctuation

**Usage:**
- Shown when `articles.length === 0` and not loading
- Replaces entire grid with centered empty state

**Files:**
- `src/components/UI/EmptyState.tsx`
- `src/components/ArticleGrid.tsx` - Empty state rendering

### 9.3 Error Handling UI

**Card Error Component:**
- **Display:** Error card with message and retry button
- **Variant:** Matches card variant (grid/feed)
- **Actions:** "Retry" button triggers `onRetry` callback

**Error States:**
- **Query Error:** Replaces grid with error card
- **Network Error:** Shows error card with retry option
- **Error Boundary:** Falls back to error UI (no custom error boundary in cards)

**Files:**
- `src/components/card/CardError.tsx`
- `src/components/ArticleGrid.tsx` - Error state rendering

---

## 10. React → Next.js Mapping Notes

### 10.1 SPA Assumptions to Preserve

**Client-Side Navigation:**
- Current: React Router `Link` components for all navigation (no page reloads)
- Next.js: Must use Next.js `Link` component with `prefetch` behavior matching React Router
- **Critical:** Navigation should feel instant (no full page reloads)

**State Preservation:**
- Current: React state persists during route changes (App.tsx state shared across routes)
- Next.js: Must use client-side state management (Context or state management library) to preserve filter/search/viewMode state across routes

**Hash URL Redirect:**
- Current: `/#/path` redirects to `/path` (legacy support)
- Next.js: Must implement middleware or redirect rule for `/#/path` → `/path`

**Files:**
- `src/App.tsx` - HashRedirect component
- `src/App.tsx` - Global state (viewMode, searchQuery, etc.)

### 10.2 Layout Components → app/layout.tsx

**Mapping:**
- **MainLayout:** Maps to root `app/layout.tsx` (provides global background, no header)
- **Header:** Renders in root layout OR separate layout file (must be outside page content container to match fixed positioning)
- **PageStack:** Cannot map directly (Next.js doesn't have equivalent). Must use client component wrapper or custom layout component

**Critical Layout Rules:**
- Header MUST be fixed and render outside page content container
- HeaderSpacer MUST be client-side component (cannot be in server layout)
- PageStack spacing logic must be preserved in Next.js layout structure

**Files:**
- `src/components/layouts/MainLayout.tsx`
- `src/components/layouts/PageStack.tsx`
- `src/App.tsx` - Header rendering

### 10.3 Page-Specific Wrappers

**Current Pattern:**
- Each page uses `PageStack` with optional `categoryToolbar`
- Pages wrap content in max-width containers

**Next.js Pattern:**
- Use route-specific `layout.tsx` files OR client component wrappers
- Preserve `PageStack` spacing logic (HeaderSpacer, CategorySpacer)

**Files:**
- `src/pages/HomePage.tsx` - PageStack usage example

### 10.4 Client-Only Components

**Must Be Client Components:**
- All card components (use hooks, event handlers)
- Header (uses state, event handlers, portals)
- ArticleGrid (uses intersection observer, state)
- All modals (use portals, state)
- Theme toggle logic (uses `useEffect` to manipulate DOM)

**Can Be Server Components (with caution):**
- Static content (legal pages, if no interactivity)
- Layout structure (but must wrap client components)

**Files:**
- Most components in `src/components/` are client components

### 10.5 Behavior Dependent on useEffect, Global State, or Router Events

**useEffect Dependencies:**
- **Theme Toggle:** `useEffect` to add/remove `dark` class on `html` element
- **Hash Redirect:** `useEffect` to detect and redirect hash URLs
- **Scroll Position:** No custom scroll restoration (relies on browser default)
- **Infinite Scroll:** `useEffect` to set up Intersection Observer

**Global State:**
- **View Mode:** Stored in App.tsx state, shared across routes
- **Search Query:** Stored in App.tsx state, shared across routes
- **Selected Categories/Tags:** Stored in App.tsx state
- **Theme State:** Stored in App.tsx state (not persisted to localStorage)

**Router Events:**
- **Route Change:** No custom handlers (relies on React Router default behavior)
- **Protected Routes:** `useEffect` in ProtectedRoute to redirect if not authenticated

**Next.js Migration:**
- Theme state must use client-side state or cookies/localStorage
- View mode/search state must be in client component or URL params
- Router events: Use Next.js router events or middleware

**Files:**
- `src/App.tsx` - Global state and useEffect hooks
- `src/components/auth/ProtectedRoute.tsx` - Router-dependent logic

---

## 11. Non-negotiable UI/UX Behaviors to Preserve

### 11.1 Layout Behaviors

1. **Header Positioning:**
   - Header MUST be fixed and render outside page content container
   - Header height MUST be exactly 56px (mobile) / 64px (desktop)
   - HeaderSpacer MUST reserve space to prevent content overlap

2. **Card Grid Layout:**
   - Grid columns MUST match exactly: 1 (mobile), 2 (tablet), 3 (desktop), 4 (xl)
   - Grid gap MUST be 24px (`gap-6`)
   - Cards MUST use equal-height rows via `auto-rows-fr`

3. **Masonry Layout:**
   - MUST use CSS columns (NOT grid) with `break-inside-avoid`
   - Column counts MUST match: 1/2/3/4 columns by breakpoint
   - Cards MUST have `mb-6` (24px) bottom margin

### 11.2 Interaction Behaviors

1. **Card Click:**
   - Clicking card body opens article modal/detail view
   - Clicking footer actions does NOT open modal (event propagation stopped)
   - Clicking link button opens source URL in new tab

2. **Content Truncation:**
   - MUST use measurement-based overflow detection (not CSS-only)
   - MUST require minimum 2.5 visible lines before truncation triggers
   - Fade overlay MUST be clickable to expand content

3. **Infinite Scroll:**
   - MUST trigger at 300px before viewport bottom (`rootMargin: '300px'`)
   - Loading indicator MUST show "Loading more..." text with spinner
   - Scroll position MUST be maintained during load-more (not reset)

4. **Media-Only Cards:**
   - Media MUST fill available card space (no padding wrapper)
   - Caption MUST use gradient overlay at bottom (`from-black/80 via-black/60 to-transparent`)
   - Image click MUST open lightbox (same as hybrid cards)

### 11.3 Visual Behaviors

1. **Hover Effects:**
   - Masonry tile hover MUST use `translateY(-2px) scale(1.015)` (desktop only)
   - Hover effects MUST be disabled on touch devices (`@media (hover: hover)`)
   - Card shadow MUST increase on hover (`shadow-sm` → `shadow-md` or `shadow-lg`)

2. **Theme Toggle:**
   - MUST use `class` strategy (`html.classList.add('dark')`)
   - MUST detect system preference on mount but allow manual override
   - Dark mode MUST apply to all components via `dark:` variants

3. **Typography:**
   - Card titles MUST use `text-base` (16px) in grid, `text-lg` (18px) in feed
   - Body text MUST use `text-sm` (14px)
   - Metadata MUST use `text-xs` (12px)

### 11.4 State Behaviors

1. **Filter/Search State:**
   - State MUST persist across route changes (shared in root layout)
   - Filter changes MUST reset infinite scroll (new query key)
   - Search query MUST trim whitespace on blur/submit

2. **View Mode:**
   - View mode selection MUST persist across routes
   - View mode change MUST NOT reset scroll position (if possible)
   - Utility mode MUST be hidden on mobile

### 11.5 Accessibility Behaviors

1. **Keyboard Navigation:**
   - Cards MUST be keyboard focusable (`tabIndex={0}`)
   - Enter/Space on card MUST open article modal
   - Focus rings MUST use `ring-2 ring-primary-500`

2. **Screen Readers:**
   - Cards MUST have descriptive `aria-label` (includes title, tags, author, excerpt)
   - Loading states MUST have `aria-live` regions
   - Empty states MUST have descriptive text

---

## 12. Next.js Implementation Constraints for Parity

### 12.1 Layout Boundaries

**Server vs Client Split:**
- **Server Components:** Layout structure, static content, SEO metadata
- **Client Components:** All interactive components (cards, header, modals, grids)

**Layout Hierarchy:**
```
app/
  layout.tsx (Server) - MainLayout equivalent, HeaderSpacer equivalent
    Header (Client) - Fixed header
    PageStack equivalent (Client) - Spacing logic
      page.tsx (Server/Client) - Page content
```

**Critical Constraints:**
- Header MUST be client component (uses hooks, state, portals)
- HeaderSpacer MUST be client component (uses hooks for height calculation)
- PageStack spacing logic MUST be client-side (cannot rely on server layout alone)

### 12.2 Routing Assumptions

**Route Structure:**
- Must match existing route patterns exactly:
  - `/` → HomePage
  - `/collections` → CollectionsPage
  - `/collections/[collectionId]` → CollectionDetailPage
  - `/profile/[userId]` → ProfilePage
  - `/account` → AccountSettingsPage (protected)
  - `/admin/*` → AdminPanelPage (protected, nested routes)
  - Legal pages: `/about`, `/terms`, etc.

**Client-Side Navigation:**
- MUST use Next.js `Link` with `prefetch={true}` (matches React Router behavior)
- Navigation MUST be instant (no full page reloads for client-side routes)
- Hash redirect (`/#/path` → `/path`) MUST be handled (middleware or client-side)

**Protected Routes:**
- MUST use middleware or client component wrapper (cannot use React Router ProtectedRoute)
- MUST redirect to home if not authenticated (preserve React behavior)

### 12.3 Client/Server Split

**Must Be Client Components:**
- All card variants and atoms (use hooks, event handlers, state)
- Header (uses state, portals, event handlers)
- ArticleGrid, MasonryGrid (use Intersection Observer, state)
- All modals (use portals, state)
- Theme toggle logic (manipulates DOM)
- Infinite scroll trigger (uses Intersection Observer)

**Can Be Server Components:**
- Legal page content (if static)
- Layout structure (but must wrap client components)
- SEO metadata (in layout.tsx or page.tsx)

**Hydration Considerations:**
- Theme state: Must match server-rendered class (`dark` on `html` element)
- Scroll position: Cannot be server-rendered (client-only)

### 12.4 State Management

**Global State (Currently in App.tsx):**
- **View Mode:** Must persist across routes → Use URL params OR client component context
- **Search Query:** Must persist → Use URL params (query string) OR client context
- **Selected Categories/Tags:** Must persist → Use URL params OR client context
- **Theme State:** Must persist → Use cookies/localStorage OR client context

**Recommendation:**
- Use URL params for filter/search/viewMode (shareable, bookmarkable)
- Use client context or cookies for theme preference

### 12.5 Data Fetching

**Current Pattern:**
- React Query `useInfiniteQuery` for articles
- Client-side filtering/pagination
- Query key includes search, category, sort, limit

**Next.js Pattern:**
- Use React Query in client components (same as current)
- OR use Next.js Server Actions + React Query for hybrid approach
- **Critical:** Infinite scroll behavior MUST be preserved (client-side Intersection Observer)

**Server vs Client Data:**
- Initial page load: Can use server-side data fetching (Server Components)
- Infinite scroll: MUST be client-side (uses Intersection Observer)
- Filter/search changes: Can be server-side (with client-side state sync)

### 12.6 Performance Constraints

**Code Splitting:**
- Current: Lazy loading via `React.lazy()` and `Suspense`
- Next.js: Automatic code splitting via route-based file structure
- **Critical:** Must match lazy loading behavior (don't bundle all pages in initial JS)

**Image Optimization:**
- Current: Uses Cloudinary URLs, no Next.js Image component
- Next.js: Can use Next.js Image OR keep Cloudinary (must match current behavior)

**Bundle Size:**
- Current: Vite bundle with code splitting
- Next.js: Automatic code splitting, but must ensure similar bundle sizes

---

## Document Metadata

**Generated:** [Date]
**Source:** React SPA codebase analysis
**Target:** Next.js App Router reconstruction
**Purpose:** Zero visual/behavioral drift migration specification

**Key Files Referenced:**
- `src/App.tsx`
- `src/components/Header.tsx`
- `src/components/card/variants/*.tsx`
- `src/components/ArticleGrid.tsx`
- `src/components/layouts/MainLayout.tsx`
- `src/components/layouts/PageStack.tsx`
- `src/constants/layout.ts`
- `src/constants/zIndex.ts`
- `tailwind.config.js`
- `index.css`

**Next Steps:**
1. Use this specification to guide Next.js App Router implementation
2. Verify each section during migration
3. Test for visual and behavioral parity
4. Update specification if discrepancies found
