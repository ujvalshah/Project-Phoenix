# YouTube Timestamp Click Recommendations

## Current Behavior

When users click timestamps in nugget content (e.g., `(00:36)`), they:
- Open YouTube in a **new tab**
- Lose context of the nugget
- Have to manually find the timestamp in YouTube

## Recommended Solution

**Intercept YouTube timestamp clicks and open the YouTube modal with automatic seeking.**

### User Experience Flow

1. User clicks timestamp `(00:36)` in content
2. YouTube modal opens (if not already open)
3. Video automatically seeks to 36 seconds
4. User stays in-app, maintains context

### Implementation Details

#### 1. **Detect YouTube Timestamp Links**

Links in markdown content that point to YouTube videos with timestamps:
- `https://youtube.com/watch?v=VIDEO_ID&t=36s`
- `https://youtu.be/VIDEO_ID?t=36`
- `https://youtube.com/watch?v=VIDEO_ID&t=1m30s`

#### 2. **Extract Timestamp from URL**

Parse timestamp formats:
- `t=36` → 36 seconds
- `t=1m30s` → 90 seconds
- `t=36s` → 36 seconds

#### 3. **Update YouTubeModal Component**

Add `startTime` prop to YouTube embed URL:
```typescript
const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1&start=${startTime}`;
```

#### 4. **Update MarkdownRenderer**

Intercept YouTube links and call callback instead of opening new tab:
```typescript
a: ({ href, children }) => {
  // Check if it's a YouTube timestamp link
  if (isYouTubeTimestampLink(href)) {
    const { videoId, timestamp } = extractYouTubeTimestamp(href);
    return (
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onYouTubeTimestampClick?.(videoId, timestamp);
        }}
        className="text-primary-600 dark:text-primary-400 hover:underline cursor-pointer"
      >
        {children}
      </button>
    );
  }
  // Regular link behavior
  return <a href={href} target="_blank" ...>
}
```

### Code Changes Required

1. **YouTubeModal.tsx** - Add `startTime` prop
2. **MarkdownRenderer.tsx** - Detect and intercept YouTube timestamp links
3. **useNewsCard.ts** - Add handler for timestamp clicks
4. **ArticleDetail.tsx** - Pass timestamp handler to MarkdownRenderer

### Benefits

✅ **Better UX** - Users stay in context  
✅ **Faster** - No tab switching  
✅ **Mobile-friendly** - Works seamlessly on mobile  
✅ **Consistent** - Matches YouTube modal behavior  

### Edge Cases

- **If modal already open:** Seek to new timestamp (update iframe src)
- **If no YouTube video:** Fallback to opening link in new tab
- **Invalid timestamp:** Ignore timestamp, play from start
- **Different video:** Close current modal, open new one with timestamp

### Performance

- **Zero impact** - Only affects YouTube links
- **Lazy loading** - Modal still loads on-demand
- **No bundle size increase** - Just URL parsing logic

---

## Alternative: Keep New Tab but Add "Open in Modal" Option

If you prefer to keep the new tab behavior but add an option:

- Add a small icon next to timestamps: "🎬 Open in modal"
- Clicking icon opens modal with timestamp
- Clicking timestamp itself opens new tab (current behavior)

This gives users choice but adds UI complexity.

---

## Recommendation

**Implement the intercept approach** - It's cleaner, more consistent, and provides better UX without adding UI complexity.
