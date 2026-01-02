# Multi-Image Thumbnail Grid - Visual Examples

## Before vs After

### BEFORE (All Nuggets Showed Single Image)
```
┌─────────────────────┐
│                     │
│   [Single Image]    │  ← Even if 5 images existed,
│                     │     only first one was shown
│                     │
└─────────────────────┘
```

### AFTER (Multi-Image Nuggets Show Grid)

#### 2 Images
```
┌─────────────────────┐
│  [Img 1] | [Img 2]  │
│          |          │
└─────────────────────┘
```

#### 3 Images
```
┌─────────────────────┐
│  [Img 1] | [Img 2]  │
│  [Img 3] |  empty   │
└─────────────────────┘
```

#### 4 Images
```
┌─────────────────────┐
│  [Img 1] | [Img 2]  │
│  [Img 3] | [Img 4]  │
└─────────────────────┘
```

#### 5+ Images (e.g., 8 images)
```
┌─────────────────────┐
│  [Img 1] | [Img 2]  │
│  [Img 3] | [Img 4]  │
│          |   +4 ⬅   │  Badge overlay
└─────────────────────┘
```

## Decision Tree

```
                    [Nugget Card]
                         |
                         |
        Does it have primary media?
                         |
                    Yes  |  No
                         |   └─> [No thumbnail]
                         |
            What type of primary media?
                         |
        ┌────────────────┼────────────────┐
        |                |                |
    YouTube          Document          Image
        |                |                |
        v                v                v
    [YouTube        [Document      How many images total?
   Thumbnail]      Icon/Preview]         |
                                    ┌────┼────┐
                                    |         |
                                  One      2+
                                    |         |
                                    v         v
                              [Single    [2x2 Grid
                               Image]    Thumbnail]
```

## Example Use Cases

### Use Case 1: Research Nugget with Charts
**Scenario**: User saves article with 3 data visualization charts

**Result**:
- Card shows 2x2 grid with 3 charts visible
- All charts remain readable (object-contain)
- Click opens drawer with full carousel

### Use Case 2: Tutorial with Screenshots
**Scenario**: User saves guide with 10 step-by-step screenshots

**Result**:
- Card shows 2x2 grid with first 4 screenshots
- "+6" badge on 4th cell indicates more images
- Click opens drawer to view all 10 in carousel

### Use Case 3: YouTube Video with Slides
**Scenario**: User saves YouTube lecture + 5 slide images

**Result**:
- Card shows YouTube thumbnail (video takes precedence)
- Supporting media badge shows "+5"
- Click opens drawer with video + slide carousel

### Use Case 4: Single Infographic
**Scenario**: User saves single infographic image

**Result**:
- Card shows single image thumbnail (existing behavior)
- No grid layout
- Click opens drawer

## Implementation Details

### CSS Grid Structure
```css
/* Parent container */
.grid.grid-cols-2.gap-0.5 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.125rem; /* 2px gap */
}

/* Each cell */
.relative.overflow-hidden {
  position: relative;
  overflow: hidden;
  /* Inherits equal width/height from grid */
}

/* Image within cell */
img.object-contain {
  width: 100%;
  height: 100%;
  object-fit: contain; /* Preserves full image */
}
```

### Conditional Rendering Logic
```typescript
// Three checks determine grid rendering:
const shouldRenderMultiImageGrid = 
  primaryMedia?.type !== 'youtube' &&    // No video
  allImageUrls.length >= 2 &&            // 2+ images
  (primaryMedia?.type === 'image' ||     // Images only
   primaryMedia === null);

// Then:
{shouldRenderMultiImageGrid ? (
  <CardThumbnailGrid images={allImageUrls} ... />
) : (
  <SingleThumbnail ... />
)}
```

## Aspect Ratio Behavior

### Single Image
- Uses stored aspect ratio (e.g., 16:9, 4:3, 1:1)
- Container height adapts to aspect ratio

### Multi-Image Grid
- Grid cells are square (1:1)
- Overall container still respects card aspect ratio
- Images within cells use object-contain

### YouTube
- Always 16:9 aspect ratio
- Fills container with object-cover

## Edge Cases Handled

### ✅ Empty Image URLs
- Filtered out before grid rendering
- Grid only renders if ≥2 valid URLs

### ✅ Mixed Media Types
- Video + Images: Shows video thumbnail
- Document + Images: Shows document preview
- Only images: Shows grid (if 2+)

### ✅ Legacy Data Structure
- Works with old `images[]` array
- Works with new `primaryMedia` + `supportingMedia`
- Graceful fallback for unclassified media

### ✅ Performance
- All computations memoized (useMemo)
- Component is React.memo wrapped
- No unnecessary re-renders

## Accessibility

### Alt Text
Each grid image has descriptive alt text:
```
"Image 1 of 4 for [Article Title]"
"Image 2 of 4 for [Article Title]"
...
```

### Keyboard Navigation
- Grid inherits click handler from parent
- Entire grid is clickable (opens drawer)
- Tab navigation works as expected

## Dark Mode Support

All styling includes dark mode variants:
```css
bg-slate-100 dark:bg-slate-800  /* Cell backgrounds */
text-white                       /* "+N" badge text */
bg-black/60                      /* Badge overlay */
```

## Responsive Behavior

Currently uniform across all breakpoints:
- Mobile: 2x2 grid
- Tablet: 2x2 grid  
- Desktop: 2x2 grid

Card size adjusts via parent grid layout, but grid structure remains constant.





