# Media Handling Quick Reference

## 🎯 Core Principle

**Media supports analysis. Media never competes with or interrupts text.**

---

## 📦 Key Imports

```typescript
// Type definitions
import type { Article, PrimaryMedia, SupportingMediaItem } from '@/types';

// Classification utilities
import { 
  classifyArticleMedia, 
  getThumbnailUrl, 
  getSupportingMediaCount 
} from '@/utils/mediaClassifier';

// Components
import { CardMedia } from '@/components/card/atoms/CardMedia';
import { SupportingMediaSection } from '@/components/shared/SupportingMediaSection';
```

---

## 🔧 Common Patterns

### Pattern 1: Classify Media
```typescript
const { primaryMedia, supportingMedia } = classifyArticleMedia(article);

// primaryMedia: PrimaryMedia | null (exactly one)
// supportingMedia: SupportingMediaItem[] (zero or more)
```

### Pattern 2: Get Thumbnail for Card
```typescript
const thumbnailUrl = getThumbnailUrl(article);

if (thumbnailUrl) {
  // Use thumbnail
} else {
  // Use system fallback
}
```

### Pattern 3: Render Card Media
```tsx
<CardMedia
  article={article}
  visibility={article.visibility}
  onMediaClick={handleMediaClick}
  className="rounded-lg"
/>
```

### Pattern 4: Render Supporting Media (Drawer Only)
```tsx
{supportingMedia && supportingMedia.length > 0 && (
  <SupportingMediaSection 
    supportingMedia={supportingMedia}
    className="pt-4"
  />
)}
```

---

## 📐 Rendering Rules

### Nugget Card (Feed/Grid/Masonry)
```
┌─────────────────────────────────┐
│  [PRIMARY MEDIA THUMBNAIL]      │ ← Only primary media
│  +3                            ← Supporting count indicator
└─────────────────────────────────┘
│  Title                          │
│  Text preview...                │
│  Tags                           │
│  Actions                        │
└─────────────────────────────────┘
```

### Article Detail Drawer
```
┌─────────────────────────────────┐
│  Categories & Title             │
│  Meta (read time, date)         │
├─────────────────────────────────┤
│  SECTION 1: Analysis Text       │ ← Always first
│  (Structured Markdown)          │
├─────────────────────────────────┤
│  SECTION 2: Primary Media       │ ← After text
│  [YouTube/Image/Doc Embed]      │
├─────────────────────────────────┤
│  SECTION 3: Supporting Media    │ ← At bottom
│  • Images Grid                  │
│  • Videos/Docs List             │
└─────────────────────────────────┘
```

---

## 🎨 Media Priority

```
1. YouTube Videos  ← Highest priority (becomes primary)
2. Images          ← Medium priority
3. Documents       ← Lower priority
4. Generic Links   ← Lowest priority (never primary)
```

**Rule**: First media item with highest priority becomes primary. All others become supporting.

---

## ✅ Do's

✅ **DO** use `classifyArticleMedia()` when you need to separate primary and supporting media

✅ **DO** render text before media in drawer

✅ **DO** use `getThumbnailUrl()` for card thumbnails

✅ **DO** show supporting media only in drawer (never in cards)

✅ **DO** pass full `article` object to `CardMedia` component

✅ **DO** render supporting images as visual thumbnails (not links)

✅ **DO** maintain backwards compatibility with legacy media fields

---

## ❌ Don'ts

❌ **DON'T** render supporting media in cards or inline expansion

❌ **DON'T** create image galleries or carousels in feed view

❌ **DON'T** dynamically re-classify media on every render (use memoization)

❌ **DON'T** let media interrupt text flow in drawer

❌ **DON'T** auto-play videos

❌ **DON'T** make media sticky or fixed position

❌ **DON'T** guess or infer thumbnails from visual properties

---

## 🐛 Debugging

### Issue: No thumbnail showing in card
```typescript
// Check 1: Does article have primary media?
const { primaryMedia } = classifyArticleMedia(article);
console.log('Primary media:', primaryMedia);

// Check 2: Is thumbnail generated?
const thumbnailUrl = getThumbnailUrl(article);
console.log('Thumbnail URL:', thumbnailUrl);

// Check 3: Fallback to legacy fields
console.log('Legacy media:', article.media, article.images, article.video);
```

### Issue: Supporting media not showing in drawer
```typescript
// Check: Are supporting media items classified?
const { supportingMedia } = classifyArticleMedia(article);
console.log('Supporting count:', supportingMedia.length);
console.log('Supporting items:', supportingMedia);
```

### Issue: Media showing in wrong order
```
✅ Correct Order:
1. Title & Meta
2. Text Content (Markdown)
3. Primary Media Embed
4. Supporting Media Section

❌ Wrong: Media before text
❌ Wrong: Supporting media in card
❌ Wrong: Mixed media and text
```

---

## 🔍 Type Signatures

### PrimaryMedia
```typescript
interface PrimaryMedia {
  type: MediaType;           // 'youtube' | 'image' | 'document' | ...
  url: string;               // Media URL
  thumbnail?: string;        // Cached thumbnail URL
  aspect_ratio?: string;     // e.g., "16/9" or "4/3"
  previewMetadata?: PreviewMetadata;
}
```

### SupportingMediaItem
```typescript
interface SupportingMediaItem {
  type: MediaType;
  url: string;
  thumbnail?: string;
  filename?: string;
  title?: string;
  previewMetadata?: PreviewMetadata;
}
```

### MediaType
```typescript
type MediaType = 
  | 'image' 
  | 'video' 
  | 'document' 
  | 'link' 
  | 'text' 
  | 'youtube' 
  | 'twitter' 
  | 'linkedin' 
  | 'instagram' 
  | 'tiktok' 
  | 'rich';
```

---

## 📖 Examples

### Example 1: YouTube + Screenshots
```typescript
const article: Article = {
  primaryMedia: {
    type: 'youtube',
    url: 'https://youtube.com/watch?v=abc',
    thumbnail: 'https://img.youtube.com/vi/abc/hqdefault.jpg',
  },
  supportingMedia: [
    { type: 'image', url: 'screenshot1.png' },
    { type: 'image', url: 'screenshot2.png' },
  ],
};

// Card shows: YouTube thumbnail with play button + "+2" indicator
// Drawer shows: Text → YouTube embed → 2-image grid
```

### Example 2: Image + PDF Report
```typescript
const article: Article = {
  primaryMedia: {
    type: 'image',
    url: 'chart.png',
    thumbnail: 'chart.png',
  },
  supportingMedia: [
    { 
      type: 'document', 
      url: 'report.pdf',
      filename: 'Q4 Report.pdf',
    },
  ],
};

// Card shows: Chart image thumbnail + "+1" indicator
// Drawer shows: Text → Chart image → Report link
```

### Example 3: Text-Only Nugget
```typescript
const article: Article = {
  primaryMedia: null,
  supportingMedia: [],
};

// Card shows: No media section
// Drawer shows: Text only
```

---

## 🚨 Common Mistakes

### Mistake 1: Passing Individual Media Fields
```typescript
// ❌ WRONG
<CardMedia 
  media={article.media}
  images={article.images}
  visibility={article.visibility}
/>

// ✅ CORRECT
<CardMedia 
  article={article}
  visibility={article.visibility}
/>
```

### Mistake 2: Rendering Media Before Text
```typescript
// ❌ WRONG ORDER
<div>
  <PrimaryMediaEmbed />
  <MarkdownContent />
</div>

// ✅ CORRECT ORDER
<div>
  <MarkdownContent />
  <PrimaryMediaEmbed />
  <SupportingMediaSection />
</div>
```

### Mistake 3: Using Supporting Media for Thumbnails
```typescript
// ❌ WRONG
const thumbnail = supportingMedia[0]?.url;

// ✅ CORRECT
const thumbnail = getThumbnailUrl(article);
```

---

## 📚 Related Files

- **Types**: `src/types/index.ts`
- **Classification**: `src/utils/mediaClassifier.ts`
- **Card Media**: `src/components/card/atoms/CardMedia.tsx`
- **Supporting Media**: `src/components/shared/SupportingMediaSection.tsx`
- **Drawer**: `src/components/ArticleDetail.tsx`
- **Card Variants**: `src/components/card/variants/`

---

## 💡 Tips

1. **Memoize Classification**: Use `useMemo` when classifying media in components
   ```typescript
   const { primaryMedia, supportingMedia } = useMemo(
     () => classifyArticleMedia(article), 
     [article]
   );
   ```

2. **Backwards Compatibility**: Legacy fields are automatically converted
   ```typescript
   // Old nuggets with article.images[] work automatically
   // Classification extracts first image as primary
   ```

3. **YouTube Thumbnails**: Auto-generated at high quality
   ```typescript
   // Format: https://img.youtube.com/vi/{VIDEO_ID}/hqdefault.jpg
   // Resolution: 480x360 (high quality)
   ```

4. **Supporting Media Limit**: Show first 4 images in grid, rest as "+N"
   ```typescript
   // Prevents visual overload in drawer
   // User can still access all via "View all"
   ```

---

**Last Updated**: December 24, 2025  
**Version**: 1.0





