# React SPA Reference Files for Next.js Migration

This folder contains key reference files from the React SPA codebase that are essential for understanding the UI/UX patterns and architecture when migrating to Next.js App Router.

## Purpose

These files are provided as reference material alongside the `REACT_TO_NEXTJS_UI_UX_SPECIFICATION.md` document to help developers understand the exact implementation details, component structure, styling patterns, and behavior that must be preserved during migration.

## Files Included

### Core Application Files
- `src/App.tsx` - Main application component with routing, global state, and layout structure
- `src/pages/HomePage.tsx` - Primary feed page implementation

### Layout Components
- `src/components/layouts/MainLayout.tsx` - Global layout container
- `src/components/layouts/PageStack.tsx` - Vertical stacking with spacers

### Header & Navigation
- `src/components/Header.tsx` - Fixed header with search, filters, and navigation

### Card System (Primary UX Surface)
- `src/components/ArticleGrid.tsx` - Grid container with responsive columns
- `src/components/card/variants/GridVariant.tsx` - Grid view card layout
- `src/components/card/variants/MasonryVariant.tsx` - Masonry view card layout
- `src/components/card/variants/FeedVariant.tsx` - Feed view card layout
- `src/components/card/CardSkeleton.tsx` - Loading skeleton placeholder
- `src/components/card/atoms/CardContent.tsx` - Content with truncation/expansion logic
- `src/components/card/atoms/CardMedia.tsx` - Media/image rendering component

### Constants & Configuration
- `src/constants/layout.ts` - Layout constants (heights, spacing, breakpoints)
- `src/constants/zIndex.ts` - Z-index hierarchy constants
- `tailwind.config.js` - Tailwind configuration with theme tokens
- `index.css` - Global styles, scrollbar styles, animations
- `package.json` - Dependencies and project configuration

## How to Use

1. **Read the Specification First:** Start with `REACT_TO_NEXTJS_UI_UX_SPECIFICATION.md` to understand the overall architecture and design system.

2. **Reference Specific Files:** Use these source files to understand exact implementation details when:
   - Recreating component structures in Next.js
   - Matching spacing, typography, and color values
   - Understanding interaction behaviors and state management
   - Preserving layout invariants and architectural patterns

3. **Map to Next.js:** Use the "React → Next.js Mapping Notes" section in the specification to understand how these React SPA patterns translate to Next.js App Router.

## Key Patterns to Preserve

- **Header Positioning:** Fixed header rendered outside MainLayout (see App.tsx)
- **Spacing System:** Explicit spacers (HeaderSpacer, CategorySpacer) for fixed/sticky elements
- **Card Architecture:** Two-card system (hybrid vs media-only) with specific rendering rules
- **Typography Scale:** Exact font sizes, weights, and line heights per component
- **Color Tokens:** Primary color palette and dark mode implementation
- **Grid Layout:** Responsive column counts (1/2/3/4 columns by breakpoint)
- **Infinite Scroll:** Intersection Observer with 300px prefetch distance

## Notes

- These files are for reference only - do not copy directly into Next.js without adaptation
- Follow the Next.js implementation constraints outlined in the specification
- Preserve visual and behavioral parity, not code parity
- All interactive components must be client components in Next.js
- Layout structure may need adjustment for Next.js App Router patterns

---

**Generated:** [Date]
**Source:** React SPA codebase
**Target:** Next.js App Router migration
