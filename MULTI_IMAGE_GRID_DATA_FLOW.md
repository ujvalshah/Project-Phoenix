# Multi-Image Grid Implementation - Data Flow Examples

## Example 1: Multi-Image Nugget (Grid Rendered)

### Input Article Data
```typescript
{
  id: "abc123",
  title: "Understanding React Hooks",
  primaryMedia: {
    type: "image",
    url: "https://example.com/hook-diagram.png",
    thumbnail: "https://example.com/hook-diagram.png"
  },
  supportingMedia: [
    {
      type: "image",
      url: "https://example.com/useState-example.png"
    },
    {
      type: "image", 
      url: "https://example.com/useEffect-example.png"
    },
    {
      type: "image",
      url: "https://example.com/custom-hook.png"
    }
  ]
}
```

### Processing Flow
```typescript
// Step 1: classifyArticleMedia
const { primaryMedia, supportingMedia } = classifyArticleMedia(article);
// primaryMedia: { type: "image", url: "hook-diagram.png", ... }
// supportingMedia: [3 images]

// Step 2: getAllImageUrls
const allImageUrls = getAllImageUrls(article);
// Result: [
//   "https://example.com/hook-diagram.png",
//   "https://example.com/useState-example.png", 
//   "https://example.com/useEffect-example.png",
//   "https://example.com/custom-hook.png"
// ]

// Step 3: shouldRenderMultiImageGrid check
primaryMedia.type !== 'youtube'  // ✅ true (it's 'image')
allImageUrls.length >= 2         // ✅ true (4 images)
primaryMedia.type === 'image'    // ✅ true

// Result: shouldRenderMultiImageGrid = true
```

### Rendered Output
```jsx
<CardThumbnailGrid
  images={[
    "hook-diagram.png",
    "useState-example.png",
    "useEffect-example.png", 
    "custom-hook.png"
  ]}
  articleTitle="Understanding React Hooks"
  onGridClick={handleMediaClick}
/>

// Renders:
// ┌─────────────────────────┐
// │  [Diagram]  | [useState]│
// │ [useEffect] | [Custom]  │
// └─────────────────────────┘
```

---

## Example 2: YouTube + Images (Single Thumbnail)

### Input Article Data
```typescript
{
  id: "xyz789",
  title: "React Tutorial",
  primaryMedia: {
    type: "youtube",
    url: "https://youtube.com/watch?v=ABC123",
    thumbnail: "https://img.youtube.com/vi/ABC123/hqdefault.jpg"
  },
  supportingMedia: [
    {
      type: "image",
      url: "https://example.com/slide1.png"
    },
    {
      type: "image",
      url: "https://example.com/slide2.png"
    }
  ]
}
```

### Processing Flow
```typescript
// Step 1: classifyArticleMedia
const { primaryMedia } = classifyArticleMedia(article);
// primaryMedia: { type: "youtube", ... }

// Step 2: getAllImageUrls
const allImageUrls = getAllImageUrls(article);
// Result: [
//   "https://example.com/slide1.png",
//   "https://example.com/slide2.png"
// ]
// Note: YouTube URL NOT included (only images)

// Step 3: shouldRenderMultiImageGrid check
primaryMedia.type !== 'youtube'  // ❌ FALSE (it's 'youtube')
// Short-circuit: Grid NOT rendered

// Result: shouldRenderMultiImageGrid = false
```

### Rendered Output
```jsx
// Single YouTube thumbnail (existing behavior)
<Image
  src="https://img.youtube.com/vi/ABC123/hqdefault.jpg"
  className="object-cover"
/>

// Plus YouTube indicator overlay
<div className="absolute bottom-0 ...">
  <YouTubeLogo />
  <span>React Tutorial</span>
</div>

// Plus supporting media badge
<div className="absolute bottom-2 right-2">
  <Layers /> +2
</div>
```

---

## Example 3: Single Image (Single Thumbnail)

### Input Article Data
```typescript
{
  id: "def456",
  title: "Architecture Diagram",
  primaryMedia: {
    type: "image",
    url: "https://example.com/architecture.png",
    thumbnail: "https://example.com/architecture.png"
  },
  supportingMedia: []
}
```

### Processing Flow
```typescript
// Step 1: classifyArticleMedia
const { primaryMedia } = classifyArticleMedia(article);
// primaryMedia: { type: "image", ... }

// Step 2: getAllImageUrls
const allImageUrls = getAllImageUrls(article);
// Result: ["https://example.com/architecture.png"]

// Step 3: shouldRenderMultiImageGrid check
primaryMedia.type !== 'youtube'  // ✅ true
allImageUrls.length >= 2         // ❌ FALSE (only 1 image)
// Short-circuit: Grid NOT rendered

// Result: shouldRenderMultiImageGrid = false
```

### Rendered Output
```jsx
// Single image thumbnail (existing behavior)
<Image
  src="https://example.com/architecture.png"
  className="object-contain"
/>

// No grid, no badge
```

---

## Example 4: Legacy Data Structure (5 Images)

### Input Article Data (Old Format)
```typescript
{
  id: "old123",
  title: "Tutorial Screenshots",
  // NO primaryMedia field (legacy)
  // NO supportingMedia field (legacy)
  images: [
    "https://example.com/screen1.png",
    "https://example.com/screen2.png",
    "https://example.com/screen3.png",
    "https://example.com/screen4.png",
    "https://example.com/screen5.png"
  ]
}
```

### Processing Flow
```typescript
// Step 1: classifyArticleMedia (fallback classification)
const { primaryMedia, supportingMedia } = classifyArticleMedia(article);
// primaryMedia: { type: "image", url: "screen1.png", ... }
// supportingMedia: [
//   { type: "image", url: "screen2.png" },
//   { type: "image", url: "screen3.png" },
//   { type: "image", url: "screen4.png" },
//   { type: "image", url: "screen5.png" }
// ]

// Step 2: getAllImageUrls
const allImageUrls = getAllImageUrls(article);
// Result: [
//   "screen1.png", "screen2.png", "screen3.png",
//   "screen4.png", "screen5.png"
// ]

// Step 3: shouldRenderMultiImageGrid check
primaryMedia.type !== 'youtube'  // ✅ true
allImageUrls.length >= 2         // ✅ true (5 images)
primaryMedia.type === 'image'    // ✅ true

// Result: shouldRenderMultiImageGrid = true
```

### Rendered Output
```jsx
<CardThumbnailGrid
  images={[
    "screen1.png", "screen2.png", "screen3.png",
    "screen4.png", "screen5.png"
  ]}
/>

// Renders first 4 images + "+1" badge:
// ┌─────────────────────────┐
// │ [Screen 1] | [Screen 2] │
// │ [Screen 3] | [Screen 4] │
// │            |    +1      │  ← Badge overlay
// └─────────────────────────┘
```

---

## Example 5: Document + Images (Document Thumbnail)

### Input Article Data
```typescript
{
  id: "doc789",
  title: "Research Paper",
  primaryMedia: {
    type: "document",
    url: "https://example.com/paper.pdf",
    previewMetadata: { title: "Research Paper.pdf" }
  },
  supportingMedia: [
    {
      type: "image",
      url: "https://example.com/figure1.png"
    },
    {
      type: "image",
      url: "https://example.com/figure2.png"
    }
  ]
}
```

### Processing Flow
```typescript
// Step 1: classifyArticleMedia
const { primaryMedia } = classifyArticleMedia(article);
// primaryMedia: { type: "document", ... }

// Step 2: getAllImageUrls
const allImageUrls = getAllImageUrls(article);
// Result: [
//   "https://example.com/figure1.png",
//   "https://example.com/figure2.png"
// ]

// Step 3: shouldRenderMultiImageGrid check
primaryMedia.type !== 'youtube'  // ✅ true
allImageUrls.length >= 2         // ✅ true (2 images)
primaryMedia.type === 'image'    // ❌ FALSE (it's 'document')

// Result: shouldRenderMultiImageGrid = false
```

### Rendered Output
```jsx
// Document preview (existing behavior)
<div className="h-16">
  <DocumentIcon />
  <span>Research Paper.pdf</span>
</div>

// Plus supporting media badge
<div className="absolute bottom-2 right-2">
  <Layers /> +2
</div>
```

---

## Key Utility Function: getAllImageUrls()

### Implementation
```typescript
export function getAllImageUrls(article: Article): string[] {
  const imageUrls: string[] = [];
  
  // Check if article has classified media
  const hasClassifiedMedia = 
    article.primaryMedia !== undefined || 
    article.supportingMedia !== undefined;
  
  if (hasClassifiedMedia) {
    // Add primary media if it's an image
    if (article.primaryMedia?.type === 'image' && article.primaryMedia.url) {
      imageUrls.push(article.primaryMedia.url);
    }
    
    // Add supporting images
    if (article.supportingMedia) {
      article.supportingMedia.forEach(media => {
        if (media.type === 'image' && media.url) {
          imageUrls.push(media.url);
        }
      });
    }
  } else {
    // Fall back to classifying media on the fly
    const classified = classifyArticleMedia(article);
    
    if (classified.primaryMedia?.type === 'image') {
      imageUrls.push(classified.primaryMedia.url);
    }
    
    classified.supportingMedia.forEach(media => {
      if (media.type === 'image' && media.url) {
        imageUrls.push(media.url);
      }
    });
  }
  
  return imageUrls;
}
```

### Behavior Summary

| Input | Output |
|-------|--------|
| Primary: image, Supporting: 2 images | `[primary, support1, support2]` (3 images) |
| Primary: youtube, Supporting: 2 images | `[support1, support2]` (2 images, NO youtube) |
| Primary: image, Supporting: none | `[primary]` (1 image) |
| Primary: document, Supporting: 2 images | `[support1, support2]` (2 images, NO document) |
| Legacy: `images: [...]` | Classified + collected (same logic) |

---

## Grid Rendering Decision Matrix

| Primary Media | Image Count | Grid Rendered? | Reason |
|---------------|-------------|----------------|--------|
| youtube | 0 | ❌ | YouTube takes precedence |
| youtube | 5 | ❌ | YouTube takes precedence |
| image | 1 | ❌ | Need 2+ images |
| image | 2 | ✅ | 2+ images, no video |
| image | 4 | ✅ | 2+ images, no video |
| image | 10 | ✅ | 2+ images, no video (shows 4 + "+6") |
| document | 2 | ❌ | Primary is not image |
| null | 2 | ✅ | Images only, 2+ images |
| null | 0 | ❌ | No media |

---

## Performance Characteristics

### Memoization Strategy
```typescript
// In CardMedia component:

const allImageUrls = useMemo(() => 
  getAllImageUrls(article),
  [article]  // Only recompute if article changes
);

const shouldRenderMultiImageGrid = useMemo(() => {
  if (primaryMedia?.type === 'youtube') return false;
  if (allImageUrls.length < 2) return false;
  if (primaryMedia && primaryMedia.type !== 'image') return false;
  return true;
}, [primaryMedia, allImageUrls.length]);
```

### Rendering Optimizations
- Component wrapped in `React.memo`
- Grid only renders when needed (conditional)
- Images lazy-loaded via `<Image>` component
- No unnecessary re-renders on parent updates

---

## Testing Data Fixtures

### Fixture 1: Grid Test (3 Images)
```typescript
const threeImageNugget = {
  id: "test1",
  title: "Three Images",
  primaryMedia: { type: "image", url: "/img1.png" },
  supportingMedia: [
    { type: "image", url: "/img2.png" },
    { type: "image", url: "/img3.png" }
  ]
};
// Expected: 2x2 grid with 3 cells filled
```

### Fixture 2: Grid Test (6 Images)
```typescript
const sixImageNugget = {
  id: "test2",
  title: "Six Images",
  images: [
    "/1.png", "/2.png", "/3.png",
    "/4.png", "/5.png", "/6.png"
  ]
};
// Expected: 2x2 grid + "+2" badge on 4th cell
```

### Fixture 3: No Grid (Video)
```typescript
const videoNugget = {
  id: "test3",
  title: "Video Tutorial",
  primaryMedia: { type: "youtube", url: "https://youtube.com/..." },
  supportingMedia: [
    { type: "image", url: "/slide1.png" },
    { type: "image", url: "/slide2.png" }
  ]
};
// Expected: YouTube thumbnail + "+2" badge
```

### Fixture 4: No Grid (Single Image)
```typescript
const singleImageNugget = {
  id: "test4",
  title: "One Image",
  primaryMedia: { type: "image", url: "/diagram.png" },
  supportingMedia: []
};
// Expected: Single image thumbnail
```





