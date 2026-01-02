# Layout Architecture Guide

> **CRITICAL**: Read this before making any layout changes.

## Overview

This app uses a multi-layout architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────────┐
│                          App.tsx                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Header (fixed)                            ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │                    MainLayout                                ││
│  │  ┌─────────────────────────────────────────────────────────┐││
│  │  │                     Routes                               │││
│  │  │  /           → HomePage (view mode switching)            │││
│  │  │  /feed       → FeedLayoutPage (workspace layout)         │││
│  │  │  /feed/:id   → FeedLayoutPage + ArticleDetailPage        │││
│  │  │  /collections → CollectionsPage                          │││
│  │  │  ...etc                                                  │││
│  │  └─────────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## Route → Layout Mapping

| Route | Component | Layout Type | View Modes |
|-------|-----------|-------------|------------|
| `/` | HomePage | PageStack + conditional | grid, feed, masonry, utility |
| `/feed` | FeedLayoutPage | ResponsiveLayoutShell | N/A (fixed layout) |
| `/feed/:articleId` | FeedLayoutPage + ArticleDetailPage | ResponsiveLayoutShell | N/A |
| `/collections` | CollectionsPage | PageStack | N/A |
| `/collections/:id` | CollectionDetailPage | PageStack | N/A |
| `/profile/:userId` | MySpacePage | PageStack | N/A |

---

## Layout Components

### 1. MainLayout (`src/components/layouts/MainLayout.tsx`)
- **Purpose**: Base wrapper for all routes
- **Responsibilities**: Background, theme colors, min-height
- **Does NOT**: Handle header, routing, or responsive behavior

### 2. ResponsiveLayoutShell (`src/components/layouts/ResponsiveLayoutShell.tsx`)
- **Purpose**: 2/3-column workspace layout for Feed page
- **Responsibilities**: Grid structure, sidebar/feed/detail slots
- **Used by**: FeedLayoutPage only

### 3. PageStack (`src/components/layouts/PageStack.tsx`)
- **Purpose**: Vertical stacking with header spacer
- **Responsibilities**: Category toolbar slot, main content slot
- **Used by**: HomePage, CollectionsPage, etc.

---

## Stability Rules (DO NOT VIOLATE)

### Rule 1: No Arbitrary Grid Templates
```tsx
// ❌ FORBIDDEN - Causes CSS compilation failures
"grid-cols-[260px_minmax(500px,760px)_1fr]"
"lg:grid-cols-[220px_minmax(0,1fr)_260px]"

// ✅ REQUIRED - Always use stable classes
"grid-cols-1"
"lg:grid-cols-2" 
"xl:grid-cols-3"
```

### Rule 2: Width Constraints on Children
```tsx
// ✅ CORRECT - Explicit widths on elements
<aside className="w-[260px] shrink-0">
<main className="w-full max-w-[760px]">
<aside className="w-full max-w-[720px]">
```

### Rule 3: Defensive Fallbacks
```tsx
// ✅ CORRECT - Content stays readable even if grid fails
<div className="w-full max-w-[760px] mx-auto">
  {content}
</div>
```

### Rule 4: Header is Fixed, Not in Layout
- Header is rendered in App.tsx, OUTSIDE MainLayout
- All layouts must account for header height (pt-14 = 56px)
- Never render Header inside layout components

---

## Breakpoints

| Name | Tailwind | Pixels | Layout Behavior |
|------|----------|--------|-----------------|
| Mobile | default | < 1024px | Single column |
| Tablet | `lg:` | ≥ 1024px | 2 columns (if sidebar) |
| Desktop | `xl:` | ≥ 1280px | 3 columns (sidebar + feed + detail) |

---

## View Mode System (Home Page Only)

The view mode system ONLY affects HomePage, not FeedLayoutPage.

```tsx
// In App.tsx
const [viewMode, setViewMode] = useState<'grid' | 'feed' | 'masonry' | 'utility'>('grid');

// Passed to Header (for buttons) and HomePage (for rendering)
<Header viewMode={viewMode} setViewMode={setViewMode} />
<HomePage viewMode={viewMode} />
```

| View Mode | Component | Description |
|-----------|-----------|-------------|
| `grid` | ArticleGrid | 4-column card grid |
| `feed` | Feed + sidebars | 3-column with topics/collections |
| `masonry` | ArticleGrid | Masonry-style grid |
| `utility` | ArticleGrid | Compact utility view |

---

## Common Mistakes to Avoid

### 1. Mixing Layout Responsibilities
```tsx
// ❌ BAD - FeedLayoutPage trying to handle view modes
<FeedLayoutPage viewMode={viewMode} />

// ✅ GOOD - FeedLayoutPage has fixed workspace layout
<FeedLayoutPage />
```

### 2. Arbitrary Values in Grid
```tsx
// ❌ BAD - Can fail silently
className="grid-cols-[200px_1fr_300px]"

// ✅ GOOD - Always works
className="grid-cols-3"
// With children having: w-[200px], w-full, w-[300px]
```

### 3. Forgetting Header Offset
```tsx
// ❌ BAD - Content hidden behind header
<div className="min-h-screen">

// ✅ GOOD - Accounts for fixed header
<div className="min-h-screen pt-14">
```

---

## Testing Checklist

Before merging layout changes:

- [ ] Test at mobile width (< 768px)
- [ ] Test at tablet width (768px - 1024px)
- [ ] Test at desktop width (1024px - 1280px)
- [ ] Test at large width (> 1280px)
- [ ] Verify view mode switching works on Home page
- [ ] Verify Feed page layout is stable
- [ ] Check browser console for CSS/layout errors
- [ ] Verify no horizontal scrollbar appears

---

## File Locations

```
src/
├── components/
│   └── layouts/
│       ├── MainLayout.tsx           # Base app wrapper
│       ├── ResponsiveLayoutShell.tsx # Workspace grid layout
│       ├── PageStack.tsx            # Vertical stacking layout
│       ├── HeaderSpacer.tsx         # Header offset spacer
│       └── ...
├── pages/
│   ├── HomePage.tsx                 # View mode switching
│   ├── FeedLayoutPage.tsx           # Workspace layout wrapper
│   └── ArticleDetail.tsx            # Detail page (nested in feed)
├── constants/
│   └── layout.ts                    # Layout constants (heights, etc.)
└── LAYOUT_ARCHITECTURE.md           # This file
```

---

## Emergency Recovery

If layout breaks completely:

1. Check browser console for CSS errors
2. Verify Tailwind is compiling (check for missing classes in DevTools)
3. Look for arbitrary grid templates (`grid-cols-[...]`) and replace with stable classes
4. Ensure all layout components have max-width fallbacks
5. Check that header offset (pt-14) is present

---

*Last updated: December 2025*




