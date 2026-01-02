# Media Classification Migration Guide

## Overview

This guide explains how existing nuggets with legacy media fields will be automatically classified into the new primary/supporting media architecture.

---

## 🔄 Automatic Migration

**Good News**: No database migration required! The system automatically classifies media at runtime.

### How It Works

1. **Frontend reads article** from database (with legacy fields)
2. **Classification utility** runs `classifyArticleMedia(article)`
3. **System determines** primary and supporting media on-the-fly
4. **Components render** using classified media
5. **Next time article is edited**, save classification permanently

---

## 📊 Migration Scenarios

### Scenario 1: Article with `media` field only

**Before** (Legacy):
```json
{
  "media": {
    "type": "youtube",
    "url": "https://youtube.com/watch?v=abc123"
  }
}
```

**After** (Automatic Classification):
```json
{
  "primaryMedia": {
    "type": "youtube",
    "url": "https://youtube.com/watch?v=abc123",
    "thumbnail": "https://img.youtube.com/vi/abc123/hqdefault.jpg"
  },
  "supportingMedia": []
}
```

---

### Scenario 2: Article with multiple images

**Before** (Legacy):
```json
{
  "images": [
    "https://example.com/image1.jpg",
    "https://example.com/image2.jpg",
    "https://example.com/image3.jpg"
  ]
}
```

**After** (Automatic Classification):
```json
{
  "primaryMedia": {
    "type": "image",
    "url": "https://example.com/image1.jpg",
    "thumbnail": "https://example.com/image1.jpg"
  },
  "supportingMedia": [
    {
      "type": "image",
      "url": "https://example.com/image2.jpg",
      "thumbnail": "https://example.com/image2.jpg"
    },
    {
      "type": "image",
      "url": "https://example.com/image3.jpg",
      "thumbnail": "https://example.com/image3.jpg"
    }
  ]
}
```

**Rule**: First image becomes primary, rest become supporting.

---

### Scenario 3: Article with media + images

**Before** (Legacy):
```json
{
  "media": {
    "type": "youtube",
    "url": "https://youtube.com/watch?v=abc123"
  },
  "images": [
    "https://example.com/screenshot1.jpg",
    "https://example.com/screenshot2.jpg"
  ]
}
```

**After** (Automatic Classification):
```json
{
  "primaryMedia": {
    "type": "youtube",
    "url": "https://youtube.com/watch?v=abc123",
    "thumbnail": "https://img.youtube.com/vi/abc123/hqdefault.jpg"
  },
  "supportingMedia": [
    {
      "type": "image",
      "url": "https://example.com/screenshot1.jpg",
      "thumbnail": "https://example.com/screenshot1.jpg"
    },
    {
      "type": "image",
      "url": "https://example.com/screenshot2.jpg",
      "thumbnail": "https://example.com/screenshot2.jpg"
    }
  ]
}
```

**Rule**: YouTube (higher priority) becomes primary, images become supporting.

---

### Scenario 4: Article with video + documents

**Before** (Legacy):
```json
{
  "video": "https://youtube.com/watch?v=xyz789",
  "documents": [
    {
      "title": "Report.pdf",
      "url": "https://example.com/report.pdf",
      "type": "pdf"
    }
  ]
}
```

**After** (Automatic Classification):
```json
{
  "primaryMedia": {
    "type": "youtube",
    "url": "https://youtube.com/watch?v=xyz789",
    "thumbnail": "https://img.youtube.com/vi/xyz789/hqdefault.jpg"
  },
  "supportingMedia": [
    {
      "type": "document",
      "url": "https://example.com/report.pdf",
      "filename": "Report.pdf",
      "title": "Report.pdf"
    }
  ]
}
```

**Rule**: Video (higher priority) becomes primary, document becomes supporting.

---

### Scenario 5: Article with images + documents

**Before** (Legacy):
```json
{
  "images": ["https://example.com/chart.png"],
  "documents": [
    {
      "title": "Data.xlsx",
      "url": "https://example.com/data.xlsx",
      "type": "xlsx"
    }
  ]
}
```

**After** (Automatic Classification):
```json
{
  "primaryMedia": {
    "type": "image",
    "url": "https://example.com/chart.png",
    "thumbnail": "https://example.com/chart.png"
  },
  "supportingMedia": [
    {
      "type": "document",
      "url": "https://example.com/data.xlsx",
      "filename": "Data.xlsx",
      "title": "Data.xlsx"
    }
  ]
}
```

**Rule**: Image (higher priority) becomes primary, document becomes supporting.

---

## 🎯 Priority Rules

### Media Type Priority (High to Low)

```
1. YouTube Videos     → Always primary (if present)
2. Images            → Primary if no videos
3. Documents         → Primary if no videos/images
4. Generic Links     → Never primary (always supporting)
```

### Selection Algorithm

```typescript
function selectPrimary(allMedia: MediaItem[]): MediaItem {
  // Sort by priority
  const sorted = allMedia.sort((a, b) => 
    getPriority(b.type) - getPriority(a.type)
  );
  
  // Return first item that qualifies as primary
  return sorted.find(item => 
    ['youtube', 'image', 'document'].includes(item.type)
  );
}
```

---

## 🔧 Backend Migration (Optional)

### Option 1: Lazy Migration (Recommended)

**Approach**: Classify on-demand, save on edit

```typescript
// When article is fetched
const article = await Article.findById(id);

// Frontend automatically classifies
const { primaryMedia, supportingMedia } = classifyArticleMedia(article);

// When article is edited and saved
article.primaryMedia = primaryMedia;
article.supportingMedia = supportingMedia;
await article.save();
```

**Advantages**:
- No bulk migration needed
- Gradual rollout
- Less risk
- Validates classification during edit

---

### Option 2: Bulk Migration Script

**Approach**: One-time script to classify all existing articles

```typescript
// scripts/migrateMediaFields.ts

import { Article } from './models/Article';
import { classifyArticleMedia } from './utils/mediaClassifier';

async function migrateAllArticles() {
  const articles = await Article.find({
    $or: [
      { primaryMedia: { $exists: false } },
      { supportingMedia: { $exists: false } }
    ]
  });
  
  console.log(`Found ${articles.length} articles to migrate`);
  
  for (const article of articles) {
    const { primaryMedia, supportingMedia } = classifyArticleMedia(article);
    
    article.primaryMedia = primaryMedia;
    article.supportingMedia = supportingMedia;
    
    await article.save();
    console.log(`✓ Migrated article ${article.id}`);
  }
  
  console.log('Migration complete!');
}

migrateAllArticles();
```

**Run**:
```bash
ts-node scripts/migrateMediaFields.ts
```

**Advantages**:
- All data migrated upfront
- Consistent state
- Better performance (no runtime classification)

---

## 📋 Migration Checklist

### Pre-Migration
- [ ] Backup database
- [ ] Test classification logic on sample data
- [ ] Review priority rules
- [ ] Verify thumbnail generation for YouTube videos

### During Migration
- [ ] Run migration script (if using Option 2)
- [ ] Monitor for errors
- [ ] Validate random samples

### Post-Migration
- [ ] Verify cards show correct thumbnails
- [ ] Verify drawers show correct media order
- [ ] Check supporting media counts
- [ ] Test with different media combinations

---

## 🧪 Testing Migration

### Test Case 1: YouTube Video
```bash
# Before migration
curl http://localhost:3000/api/articles/123

{
  "media": {
    "type": "youtube",
    "url": "https://youtube.com/watch?v=abc"
  }
}

# After migration
{
  "primaryMedia": {
    "type": "youtube",
    "url": "https://youtube.com/watch?v=abc",
    "thumbnail": "https://img.youtube.com/vi/abc/hqdefault.jpg"
  },
  "supportingMedia": []
}
```

### Test Case 2: Multiple Images
```javascript
// Test classification
const article = {
  images: ['img1.jpg', 'img2.jpg', 'img3.jpg']
};

const { primaryMedia, supportingMedia } = classifyArticleMedia(article);

expect(primaryMedia.url).toBe('img1.jpg');
expect(supportingMedia.length).toBe(2);
```

### Test Case 3: Mixed Media
```javascript
const article = {
  video: 'https://youtube.com/watch?v=abc',
  images: ['img1.jpg', 'img2.jpg'],
  documents: [{ url: 'doc.pdf', title: 'Doc' }]
};

const { primaryMedia, supportingMedia } = classifyArticleMedia(article);

expect(primaryMedia.type).toBe('youtube');
expect(supportingMedia.length).toBe(3); // 2 images + 1 doc
```

---

## ⚠️ Edge Cases

### Edge Case 1: No Media
```json
{
  "media": null,
  "images": [],
  "video": null,
  "documents": []
}
```

**Result**: 
```json
{
  "primaryMedia": null,
  "supportingMedia": []
}
```

---

### Edge Case 2: Invalid YouTube URL
```json
{
  "video": "https://invalid-youtube-url"
}
```

**Handling**:
- Classify as primary media (type: 'video')
- No thumbnail generated
- Show fallback icon in card

---

### Edge Case 3: Multiple YouTube Videos
```json
{
  "video": "https://youtube.com/watch?v=abc",
  "media": {
    "type": "youtube",
    "url": "https://youtube.com/watch?v=xyz"
  }
}
```

**Result**:
- First YouTube video (from `media` field) becomes primary
- Second YouTube video (from `video` field) becomes supporting

---

## 🔍 Validation Queries

### Find Articles Without Classification
```javascript
db.articles.find({
  $or: [
    { primaryMedia: { $exists: false } },
    { primaryMedia: null }
  ]
}).count()
```

### Find Articles With Legacy Fields Only
```javascript
db.articles.find({
  primaryMedia: { $exists: false },
  $or: [
    { media: { $exists: true } },
    { images: { $exists: true, $ne: [] } },
    { video: { $exists: true } },
    { documents: { $exists: true, $ne: [] } }
  ]
})
```

### Validate Migration Success
```javascript
db.articles.aggregate([
  {
    $group: {
      _id: null,
      total: { $sum: 1 },
      withPrimary: {
        $sum: {
          $cond: [{ $ne: ["$primaryMedia", null] }, 1, 0]
        }
      },
      withSupporting: {
        $sum: {
          $cond: [{ $gt: [{ $size: { $ifNull: ["$supportingMedia", []] } }, 0] }, 1, 0]
        }
      }
    }
  }
])
```

---

## 🚨 Rollback Plan

### If Migration Fails

1. **Stop the migration script**
   ```bash
   # Press Ctrl+C
   ```

2. **Restore from backup**
   ```bash
   mongorestore --db nuggets --drop /path/to/backup
   ```

3. **Revert code changes**
   ```bash
   git revert HEAD
   ```

4. **Investigate errors**
   - Check logs for specific articles
   - Test classification logic on failed items
   - Fix issues

5. **Re-run migration**
   - With fixes applied
   - On subset of data first
   - Then full migration

---

## 📊 Migration Metrics

Track these metrics during migration:

- **Total articles processed**: `X / Y`
- **Articles with primary media**: `X%`
- **Articles with supporting media**: `X%`
- **YouTube videos as primary**: `X%`
- **Images as primary**: `X%`
- **Documents as primary**: `X%`
- **Errors encountered**: `X`
- **Migration duration**: `X minutes`

---

## ✅ Post-Migration Verification

### Visual Checks

1. **Feed View**
   - [ ] Cards show correct thumbnails
   - [ ] YouTube play buttons visible
   - [ ] "+N" indicators show for supporting media
   - [ ] No broken images

2. **Drawer View**
   - [ ] Text renders before media
   - [ ] Primary media displays correctly
   - [ ] Supporting media section shows all items
   - [ ] Image grids render properly
   - [ ] Video/doc lists are clickable

3. **Inline Expansion**
   - [ ] Only text expands
   - [ ] Media stays in header
   - [ ] No duplicate media

### Functional Checks

```bash
# Test API response
curl http://localhost:3000/api/articles/123 | jq '.primaryMedia, .supportingMedia'

# Expected output:
{
  "primaryMedia": { ... },
  "supportingMedia": [ ... ]
}
```

---

## 💡 Best Practices

1. **Migrate during low-traffic hours**
2. **Start with small batch** (e.g., 100 articles)
3. **Monitor system performance** during migration
4. **Keep backup for at least 7 days**
5. **Document any manual fixes** needed
6. **Communicate with team** before/after migration

---

**Last Updated**: December 24, 2025  
**Status**: Production Ready ✅





