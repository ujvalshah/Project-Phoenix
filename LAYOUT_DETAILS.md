# Layout Details: Grid, Feed, Masonry, and Utility

This document provides comprehensive details about the four layout options implemented in the Project Nuggets application. These layouts offer different ways to display content (nuggets/articles) based on user preference and use case.

---

## Overview

The application supports four distinct layout modes:

1. **Grid** - Traditional card-based grid layout
2. **Feed** - Wide, single-column feed layout optimized for reading
3. **Masonry** - Pinterest-style masonry layout with auto-height columns
4. **Utility** - Content-first layout with unique visual hierarchy

All layouts share the same underlying data structure and functionality, but present content differently to optimize for various user experiences.

---

## 1. Grid Layout

### Description
A traditional card-based grid layout that displays content in a responsive grid format. Cards maintain consistent heights and are arranged in multiple columns based on screen size.

### Visual Characteristics
- **Card Style**: White/dark background with rounded corners (`rounded-2xl`)
- **Shadow**: Subtle shadow that increases on hover (`shadow-sm` → `hover:shadow-lg`)
- **Border**: Slate-colored border that becomes more prominent on hover
- **Padding**: Consistent padding (`p-4`)
- **Gap**: 24px gap between cards (`gap-6`)

### Layout Structure
```
┌─────────────────────┐
│   Media (if any)    │
│   Source Badge      │
├─────────────────────┤
│   Category Tags     │
│   Title             │
│   Content/Excerpt   │
├─────────────────────┤
│   Author | Actions  │
└─────────────────────┘
```

### Content Hierarchy
1. **Media** (if present) - Top position with source badge overlay
2. **Category Tags** - Displayed above title
3. **Title** - Prominent text display
4. **Content/Excerpt** - Expandable content with read more
5. **Footer** - Author metadata and action buttons

### Responsive Breakpoints
- **Mobile** (< 768px): 1 column
- **Tablet** (768px - 1024px): 2 columns
- **Desktop** (1024px - 1536px): 3 columns
- **Large Desktop** (≥ 1536px): 4 columns

### Special Features
- ✅ **Selection Mode Support**: Checkbox overlay for bulk selection
- ✅ **Selection Indicator**: Visual feedback with border and ring when selected
- ✅ **Click Areas**: Main card opens article drawer; footer actions don't trigger drawer
- ✅ **Hover Effects**: Shadow and border color transitions

### Use Cases
- Default browsing experience
- When users want to see many items at once
- Scannable content discovery
- Bulk selection/management tasks

---

## 2. Feed Layout

### Description
A wide, single-column feed layout optimized for focused reading and content consumption. Cards are wider and emphasize content over density.

### Visual Characteristics
- **Card Style**: White/dark background with rounded corners (`rounded-2xl`)
- **Shadow**: Enhanced shadow (`shadow-[0_8px_24px_rgba(0,0,0,0.04)]`) that increases on hover
- **Hover Effect**: Subtle lift animation (`hover:-translate-y-0.5`)
- **Padding**: More generous padding (`p-6`)
- **Gap**: Larger gap between cards (`gap-8`)
- **Max Width**: Constrained to `max-w-2xl` for optimal reading width

### Layout Structure
```
┌─────────────────────────────────────┐
│   Media (if any)                    │
│                                     │
│   Title (Dominant Anchor)           │
│   Content/Excerpt                   │
│   Category Tags (Demoted, 1-2 max)  │
├─────────────────────────────────────┤
│   Author | Actions                  │
└─────────────────────────────────────┘
```

### Content Hierarchy
1. **Media** (if present) - Full-width at top, rounded corners
2. **Title** - Dominant visual anchor, larger variant
3. **Content/Excerpt** - Full excerpt display with expansion
4. **Category Tags** - Visually demoted (muted pills, 1-2 max displayed)
5. **Footer** - Author metadata and actions

### Key Differences from Grid
- Media appears first (video-first nuggets)
- Title is more prominent
- Tags are visually demoted (fewer shown, muted style)
- Single column layout
- Optimized for reading flow

### Responsive Behavior
- **All Screen Sizes**: Single column
- **Width**: Max width of `2xl` (672px) for optimal reading
- **Centered**: Cards are centered on the page

### Special Features
- ✅ **Finance-grade UI**: Reduced visual weight, increased hit areas
- ✅ **Reading Optimized**: Width and spacing optimized for readability
- ✅ **Smooth Animations**: Subtle hover lift effect
- ✅ **Content-First**: Emphasizes content over metadata

### Use Cases
- Focused reading sessions
- Long-form content consumption
- When users want minimal distractions
- Timeline/chronological feeds

---

## 3. Masonry Layout

### Description
A Pinterest-style masonry layout where content flows into multiple columns with varying heights. Cards automatically adjust to their content size, creating a dynamic, organic flow.

### Visual Characteristics
- **Layout Type**: Flex-based columns (NOT CSS columns)
- **Distribution**: Round-robin distribution (`index % columnCount`)
- **Gap**: Fixed gap of ~1rem (`gap-4`)
- **No Card Styling**: Uses `MasonryAtom` which is content-first (no backgrounds, borders, shadows)
- **Break-inside-avoid**: Prevents content from breaking across columns

### Layout Structure (Per Column)
```
Column 1          Column 2          Column 3          Column 4
┌────────┐        ┌────────┐        ┌────────┐        ┌────────┐
│ Media  │        │ Text   │        │ Media  │        │ Text   │
│        │        │ Block  │        │        │        │ Block  │
│        │        │        │        │        │        │        │
│        │        │        │        │        │        │        │
└────────┘        └────────┘        └────────┘        └────────┘
┌────────┐        ┌────────┐        ┌────────┐        
│ Text   │        │ Media  │        │ Text   │        
│ Block  │        │        │        │ Block  │        
│        │        │        │        │        │        
└────────┘        └────────┘        └────────┘        
```

### Content Rendering
- Uses `MasonryAtom` component (lightweight, content-first)
- **Media Block**: For articles with images/videos
- **Text Block**: For text-only nuggets
- **Action HUD**: Hover-triggered overlay with actions

### Responsive Breakpoints
- **Mobile** (< 768px): 1 column
- **Tablet** (768px - 1024px): 3 columns
- **Desktop** (1024px - 1536px): 4 columns
- **Large Desktop** (≥ 1536px): 5 columns

### Technical Implementation
- **Hook**: `useMasonry` for layout logic
- **Distribution Algorithm**: Deterministic round-robin
- **Resize Handling**: Debounced (100ms)
- **SSR-Safe**: Uses `defaultColumns: 1` for server-side rendering
- **Performance**: Optimized for smooth scrolling

### Special Features
- ✅ **Content-First Design**: No card backgrounds/borders (cleaner look)
- ✅ **Auto-Height**: Cards adjust to content naturally
- ✅ **Hover Actions**: Action HUD appears on hover
- ✅ **Dynamic Flow**: Content flows organically into columns
- ✅ **Performance Optimized**: Debounced resize handling

### Use Cases
- Visual content discovery
- Browsing image-heavy content
- Pinterest-style exploration
- When content heights vary significantly
- Maximizing screen real estate

---

## 4. Utility Layout

### Description
A unique layout with a reversed content hierarchy optimized for specific use cases. Features tags at the top, content in the middle, and media anchored to the bottom for visual uniformity.

### Visual Characteristics
- **Card Style**: White/dark background with rounded corners (`rounded-xl`)
- **Shadow**: Subtle shadow with hover enhancement
- **Border**: Slate-colored border
- **Padding**: Moderate padding (`p-5`)
- **Min Height**: Consistent minimum height (`min-h-[400px]`)
- **Gap**: 16px gap (`gap-4`)

### Layout Structure
```
┌─────────────────────┐
│ Tags    [Badge]     │  ← Header Zone
├─────────────────────┤
│ Title               │
├─────────────────────┤
│                     │
│   Content/Excerpt   │  ← Flex-1 (takes available space)
│                     │
│                     │
├─────────────────────┤
│ Media (anchored)    │  ← Pushed to bottom (mt-auto)
├─────────────────────┤
│ Author | Actions    │
└─────────────────────┘
```

### Content Hierarchy
1. **Header Zone**: 
   - **Left**: Category Tags
   - **Right**: Source Badge (if not text nugget)
2. **Title** - Prominent display
3. **Content/Excerpt** - Takes available space (`flex-1`)
4. **Media** - Anchored to bottom using `mt-auto` for uniformity
5. **Footer** - Author metadata and actions

### Key Features
- **Reversed Hierarchy**: Tags-first approach
- **Media Anchoring**: Media pushed to bottom for visual consistency
- **Uniform Heights**: `min-h-[400px]` ensures consistent card heights
- **Accessibility**: Full keyboard navigation support (Enter/Space to activate)
- **ARIA Labels**: Descriptive labels for screen readers

### Responsive Breakpoints
- Uses the same grid system as Grid layout:
  - **Mobile** (< 768px): 1 column
  - **Tablet** (768px - 1024px): 2 columns
  - **Desktop** (1024px - 1536px): 3 columns
  - **Large Desktop** (≥ 1536px): 4 columns

### Special Features
- ✅ **Tags-First Design**: Tags displayed prominently at top
- ✅ **Media Anchoring**: Media at bottom creates visual uniformity
- ✅ **Keyboard Navigation**: Full accessibility support
- ✅ **Focus States**: Visible focus rings for keyboard users
- ✅ **Semantic HTML**: Uses `<article>` element with proper ARIA labels

### Use Cases
- Tag-focused browsing
- When source/type identification is important
- Administrative views
- Utility/search result displays
- When visual consistency is prioritized

---

## Technical Implementation

### Architecture

All layouts follow a consistent architecture pattern:

1. **Controller Layer** (`NewsCard.tsx`): Routes to appropriate variant based on `viewMode`
2. **Logic Hook** (`useNewsCard.ts`): Centralized business logic and state management
3. **Variant Components**: Pure JSX layouts that compose atomic components
4. **Atomic Components**: Reusable, stateless UI primitives

### Shared Components

All layouts use the same atomic components:
- `CardMedia` - Media display with badges
- `CardTitle` - Title display
- `CardMeta` - Author and date metadata
- `CardTags` - Category tags with popover
- `CardActions` - Action buttons (bookmark, share, menu)
- `CardContent` - Excerpt/content with read more
- `CardBadge` - Source/type badge
- `CardContributor` - Contributor footer

### Layout Selection

Layouts are selected via the `viewMode` prop:
```typescript
viewMode: 'grid' | 'feed' | 'masonry' | 'utility'
```

The `ArticleGrid` component handles layout rendering:
- **Masonry**: Uses dedicated `MasonryGrid` component
- **Grid/Feed/Utility**: Uses standard CSS Grid/Flex with `NewsCard` components

---

## Comparison Matrix

| Feature | Grid | Feed | Masonry | Utility |
|---------|------|------|---------|---------|
| **Columns** | 1-4 responsive | 1 (fixed) | 1-5 responsive | 1-4 responsive |
| **Card Style** | Full card styling | Full card styling | Content-first (no card) | Full card styling |
| **Media Position** | Top | Top | Top | Bottom (anchored) |
| **Tags Position** | Above title | Below content | Above title | Top (header) |
| **Content Emphasis** | Balanced | High | High | Medium |
| **Height** | Fixed (stretched) | Auto | Auto | Fixed (min-height) |
| **Selection Mode** | ✅ Supported | ❌ Not supported | ❌ Not supported | ❌ Not supported |
| **Best For** | General browsing | Reading | Visual discovery | Tag-focused |

---

## User Experience Considerations

### Grid Layout
- ✅ High information density
- ✅ Consistent visual rhythm
- ✅ Easy scanning
- ✅ Supports bulk operations

### Feed Layout
- ✅ Optimal reading experience
- ✅ Focused content consumption
- ✅ Less visual clutter
- ✅ Better for long-form content

### Masonry Layout
- ✅ Dynamic, organic flow
- ✅ Efficient use of space
- ✅ Great for visual content
- ✅ Pinterest-like experience

### Utility Layout
- ✅ Tag-focused navigation
- ✅ Visual consistency
- ✅ Source identification
- ✅ Administrative workflows

---

## Future Enhancements

Potential improvements for each layout:

### Grid
- Custom column count preferences
- Card size options (compact/normal/comfortable)

### Feed
- Reading mode toggle
- Font size customization
- Dark mode optimizations

### Masonry
- Infinite scroll optimization
- Lazy loading improvements
- Column width customization

### Utility
- Customizable tag display limit
- Alternative media positioning options
- Filter integration

---

*Last Updated: Based on current codebase implementation*






