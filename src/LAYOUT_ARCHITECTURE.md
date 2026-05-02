# Layout Architecture Guide

> **CRITICAL**: Read this before making any layout changes.

## Overview

Primary shell: fixed `Header` in [`App.tsx`](App.tsx), then [`MainLayout`](components/layouts/MainLayout.tsx) wrapping routed pages. Legacy hash URLs and **`/feed` paths redirect to `/`** (same home surface).

```
┌─────────────────────────────────────────────────────────────────┐
│                          App.tsx                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Header (fixed)                            ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │                    MainLayout                                ││
│  │  ┌─────────────────────────────────────────────────────────┐││
│  │  │                     Routes                               │││
│  │  │  /           → HomePage (`grid` | `masonry` from Header) │││
│  │  │  /feed, /feed/:id → Navigate to `/`                     │││
│  │  │  /collections → CollectionsPage                         │││
│  │  │  ...                                                    │││
│  │  └─────────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## Route → Layout Mapping

| Route | Component | Layout Type | Notes |
|-------|-----------|-------------|-------|
| `/` | [`HomePage`](pages/HomePage.tsx) | [`PageStack`](components/layouts/PageStack.tsx) | View mode: **`grid`** or **`masonry`** only (`App.tsx` state) |
| `/feed`, `/feed/:articleId` | — | — | **`Navigate` to `/`** in [`App.tsx`](App.tsx); no dedicated feed page |
| `/collections` | [`CollectionsPage`](pages/CollectionsPage.tsx) | `PageStack` | |
| `/collections/:id` | [`CollectionDetailPage`](pages/CollectionDetailPage.tsx) | `PageStack` | |
| `/profile/:userId` | [`MySpacePage`](pages/MySpacePage.tsx) | `PageStack` | |

---

## Layout Components

### 1. MainLayout (`src/components/layouts/MainLayout.tsx`)

- **Purpose**: Base wrapper for all routes
- **Responsibilities**: Background, theme colors, min-height
- **Does NOT**: Handle header, routing, or responsive behavior

### 2. PageStack (`src/components/layouts/PageStack.tsx`)

- **Purpose**: Vertical stacking with header spacer
- **Responsibilities**: Category toolbar slot, main content slot
- **Used by**: [`HomePage`](pages/HomePage.tsx), [`CollectionsPage`](pages/CollectionsPage.tsx), and similar stacks

*(Historical `ResponsiveLayoutShell` / `FeedLayoutPage` were removed when `/feed` was unified into home.)*

---

## Stability Rules (DO NOT VIOLATE)

### Rule 1: No Arbitrary Grid Templates

```tsx
// ❌ FORBIDDEN - Causes CSS compilation failures
"grid-cols-[260px_minmax(500px,760px)_1fr]"

// ✅ REQUIRED - Always use stable classes
"grid-cols-1"
"lg:grid-cols-2"
"xl:grid-cols-3"
```

### Rule 2: Width Constraints on Children

```tsx
<aside className="w-[260px] shrink-0">
<main className="w-full max-w-[760px]">
```

### Rule 3: Header is Fixed, Not in Layout

- Header is rendered in `App.tsx`, **outside** `MainLayout`.
- Pages use [`HeaderSpacer`](components/layouts/HeaderSpacer.tsx) / `PageStack` to reserve space.

---

## View mode (`HomePage` only)

[`App.tsx`](App.tsx):

```tsx
const [viewMode, setViewMode] = useState<'grid' | 'masonry'>('grid');
<Header viewMode={viewMode} setViewMode={setViewMode} />
<HomePage viewMode={viewMode} />
```

| View Mode | Rendering |
|-----------|-----------|
| `grid` | [`ArticleGrid`](components/ArticleGrid.tsx) grid path |
| `masonry` | Masonry path inside `ArticleGrid` |

Optional window virtualization when `HOME_FEED_VIRTUALIZATION` is enabled ([`ArticleGrid.tsx`](components/ArticleGrid.tsx)).

---

## File locations

```
src/
├── components/
│   └── layouts/
│       ├── MainLayout.tsx
│       ├── PageStack.tsx
│       └── HeaderSpacer.tsx
├── pages/
│   ├── HomePage.tsx
│   └── ArticleDetail.tsx   # Drawer/modal/detail contexts
└── constants/
    └── layout.ts
```

---

*Updated to match routing after `/feed` removal.*
