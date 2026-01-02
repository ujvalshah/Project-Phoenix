# Feed Components - Mobile-First Compact Feed

Production-grade mobile-first compact feed implementation with CLS-safe images, virtualization, and premium UX.

## Components

### FeedContainer
Main virtualized feed container using TanStack React Virtual. Handles scroll persistence and efficient rendering.

**Usage:**
```tsx
import { FeedContainer } from '@/components/feed';

<FeedContainer
  articles={articles}
  isLoading={isLoading}
  onArticleClick={(article) => handleClick(article)}
  onLike={(article) => handleLike(article)}
  onBookmark={(article) => handleBookmark(article)}
  onShare={(article) => handleShare(article)}
  gap={16}
  overscan={3}
/>
```

### FeedCardCompact
Compact feed card with fixed 4:3 aspect ratio preview images. Uses ImageLayer for CLS-safe image loading.

**Features:**
- Fixed aspect ratio preview (prevents CLS)
- Tap/hover states
- Source badge overlay
- Compact metadata display
- Tag truncation (shows first 3 tags)

### ImageLayer
CLS-safe image component with blur-up transition and error handling.

**Features:**
- Fixed aspect ratio wrapper (reserves space before load)
- Skeleton placeholder (matches exact dimensions)
- Blur-up thumbnail from Cloudinary
- Full-res fade-in handoff
- Media placeholder on failure (never collapses)
- Sentry error logging
- Intrinsic hints (width, height, loading, decoding)
- Fetch priority support (high for first 2 images)

**Usage:**
```tsx
import { ImageLayer } from '@/components/feed';

<ImageLayer
  src={imageUrl}
  blurPlaceholder={blurThumbnailUrl}
  alt="Preview"
  aspectRatio={4 / 3} // Optional - undefined for natural aspect ratio
  fetchPriority="high" // "high" | "low" | "auto"
  isInViewport={true}
  sourceDomain="example.com"
/>
```

### DetailViewBottomSheet
Full infographic view with zoom + pan support. Opens from feed cards.

**Features:**
- Bottom sheet modal (mobile-first)
- Blurred thumbnail immediate render (shared element illusion)
- Async high-res image fetch + fade-in
- Zoom + pan (mouse, touch, pinch)
- Sticky DetailHeader (Close + zoom controls)
- Sticky ActionDock (safe-area insets)
- Focus trap + ESC to close
- ARIA labels for accessibility

### DetailHeader
Sticky top header with close button and zoom controls.

### ActionDock
Sticky bottom action bar with source link, like, bookmark, and share buttons. Safe-area aware for mobile devices.

## Integration with React Query

The FeedContainer integrates seamlessly with React Query's `useInfiniteArticles` hook:

```tsx
import { useInfiniteArticles } from '@/hooks/useInfiniteArticles';
import { FeedContainer } from '@/components/feed';

const {
  articles,
  isLoading,
  fetchNextPage,
  hasNextPage,
} = useInfiniteArticles({
  searchQuery,
  activeCategory,
  sortOrder,
  limit: 25,
});

<FeedContainer
  articles={articles}
  isLoading={isLoading}
  onArticleClick={handleArticleClick}
/>
```

## CLS Prevention Strategy

1. **Fixed Aspect Ratio**: All preview images use 4:3 aspect ratio wrapper
2. **Skeleton Matching**: Skeleton placeholders match exact dimensions
3. **Reserved Space**: Container reserves space BEFORE image load
4. **Natural Height Never Controls Layout**: Images use object-fit: cover

## Performance Optimizations

1. **Virtualization**: Only renders visible cards + small overscan (TanStack React Virtual)
2. **Memoization**: Components are memoized to limit re-renders
3. **Lazy Loading**: Images outside viewport use loading="lazy"
4. **Fetch Priority**: First 2 images get fetchPriority="high"
5. **Scroll Persistence**: Scroll position preserved when opening/closing Detail View

## Accessibility

- ARIA labels on all interactive elements
- Focus trap in Detail View
- ESC key to close Detail View
- Keyboard navigation support
- Semantic HTML (article, button, etc.)

## Error Handling

- Zod schema validation for feed items
- Sentry logging for image load failures
- Graceful fallbacks (media placeholder, safe defaults)
- Never collapses container on error




