# Floating Mini Player Recommendation

## 🎯 User Request
Enable users to continue watching YouTube videos while scrolling, with a floating mini player overlay (similar to YouTube's picture-in-picture or mini player feature).

---

## 📊 Analysis: Options Comparison

### Option 1: Browser Picture-in-Picture (PiP) API
**Pros:**
- Native browser feature
- System-level overlay (works outside browser window)
- Minimal implementation code

**Cons:**
- ❌ **Limited browser support** (Safari iOS doesn't support it well)
- ❌ **Mobile experience is poor** (iOS requires fullscreen first)
- ❌ **No custom controls** (can't add pause/play overlay)
- ❌ **Inconsistent behavior** across browsers
- ❌ **Cannot customize position/size**

**Verdict:** ❌ **Not recommended** - Poor mobile UX and limited control

---

### Option 2: Custom Floating Mini Player (Recommended ✅)
**Pros:**
- ✅ **Full control** over UX, positioning, and behavior
- ✅ **Consistent experience** across all browsers/devices
- ✅ **Mobile-optimized** (touch-friendly, safe area aware)
- ✅ **Custom controls** (pause/play, close, expand)
- ✅ **Smooth animations** and transitions
- ✅ **Lightweight** (minimal performance impact)
- ✅ **Accessible** (keyboard navigation, ARIA labels)

**Cons:**
- Requires custom implementation
- Stays within browser window (not system-level)

**Verdict:** ✅ **STRONGLY RECOMMENDED** - Best UX and performance

---

### Option 3: Sticky Card (Alternative)
**Pros:**
- Simple implementation
- Video stays in context

**Cons:**
- ❌ Takes up significant screen space
- ❌ Blocks content below
- ❌ Poor mobile experience (limited screen space)
- ❌ Not truly "floating" - still part of scroll flow

**Verdict:** ❌ **Not recommended** - Poor UX, especially on mobile

---

## 🏆 Recommended Solution: Custom Floating Mini Player

### Architecture Overview

```
┌─────────────────────────────────────────┐
│  User scrolls away from video card      │
│  ↓                                       │
│  IntersectionObserver detects           │
│  card is out of viewport                │
│  ↓                                       │
│  FloatingMiniPlayer appears              │
│  (bottom-right corner, fixed position)  │
│  ↓                                       │
│  Video continues playing in mini player  │
│  ↓                                       │
│  User can:                               │
│  - Pause/Play                            │
│  - Close (returns to card)               │
│  - Expand (opens full modal)             │
│  - Click to scroll back to card          │
└─────────────────────────────────────────┘
```

---

## 🎨 UX Design Specifications

### Mini Player Appearance
- **Size:** `280px × 158px` (16:9 aspect ratio, ~40% of card size)
- **Position:** Bottom-right corner (desktop), bottom-center (mobile)
- **Z-index:** `9999` (above all content)
- **Safe Area:** Respects `env(safe-area-inset-bottom)` on mobile
- **Shadow:** `0 8px 32px rgba(0, 0, 0, 0.3)` for depth
- **Border Radius:** `12px` (rounded corners)

### Controls Overlay
- **Pause/Play Button:** Centered, semi-transparent background
- **Close Button:** Top-right corner (X icon)
- **Expand Button:** Bottom-right corner (maximize icon)
- **Video Title:** Bottom overlay with gradient (truncated if long)
- **Hover State:** Slight scale-up (1.02x) on desktop

### Mobile Optimizations
- **Touch Targets:** Minimum 44px × 44px
- **Swipe Down:** Dismiss mini player
- **Position:** Bottom-center (avoids notch/home indicator)
- **Size:** `100vw - 32px` width (with padding), maintains 16:9

---

## ⚡ Performance Considerations

### 1. **Single Video Policy**
- Only **one video** can play at a time globally
- Starting a new video automatically pauses/closes previous mini player
- Prevents multiple iframes from loading simultaneously

### 2. **Lazy Loading**
- Mini player iframe only loads when card scrolls out of viewport
- Original card iframe can be paused/unmounted when mini player appears
- Reduces memory usage (only one iframe active)

### 3. **Scroll Detection**
- Use `IntersectionObserver` API (native, performant)
- Throttle scroll events with `requestAnimationFrame` (like `BackToTopButton.tsx`)
- Check visibility every ~100ms (not on every scroll event)

### 4. **Memory Management**
- Unmount original card iframe when mini player appears
- Unmount mini player iframe when closed or when user scrolls back to card
- Clean up event listeners on unmount

### 5. **Iframe Communication**
- Use `postMessage` API to control video playback
- Pause original iframe when mini player loads
- Sync play state between card and mini player

---

## 🛠 Implementation Strategy

### Phase 1: Global State Management

**Create `VideoPlayerContext`** (`src/context/VideoPlayerContext.tsx`):
```typescript
interface VideoPlayerState {
  isPlaying: boolean;
  videoUrl: string | null;
  videoId: string | null;
  videoTitle: string | null;
  startTime: number;
  cardElementId: string | null; // For scrolling back
}

// Global state for single active video
// Methods: playVideo(), pauseVideo(), closeMiniPlayer(), scrollToCard()
```

**Why Context?**
- Single source of truth for active video
- Prevents multiple videos playing simultaneously
- Easy to access from any component
- Follows existing pattern (`AuthContext`, `ToastContext`)

---

### Phase 2: IntersectionObserver Hook

**Create `useVideoScrollDetection` hook** (`src/hooks/useVideoScrollDetection.ts`):
```typescript
// Detects when expanded video card scrolls out of viewport
// Returns: { isVisible: boolean, cardRef: RefObject<HTMLDivElement> }
// Triggers mini player when isVisible becomes false
```

**Performance:**
- Uses `IntersectionObserver` (native API, no scroll event overhead)
- Threshold: `0.1` (triggers when 10% visible)
- Root margin: `-50px` (triggers slightly before fully out of view)

---

### Phase 3: FloatingMiniPlayer Component

**Create `FloatingMiniPlayer.tsx`** (`src/components/FloatingMiniPlayer.tsx`):
- Fixed position overlay
- YouTube iframe (same as current implementation)
- Controls: pause/play, close, expand
- Smooth enter/exit animations
- Mobile swipe-to-dismiss

**Features:**
- Auto-appears when card scrolls out of view
- Auto-hides when user scrolls back to card
- Click to scroll back to original card
- Expand button opens full `YouTubeModal`

---

### Phase 4: Integration Points

**Update `CardMedia.tsx`:**
- Register card element ID when video expands
- Listen to `VideoPlayerContext` for play/pause state
- Pause/unmount iframe when mini player appears

**Update `useNewsCard.ts`:**
- Connect to `VideoPlayerContext` when video expands
- Pass video metadata to context

**Update `App.tsx` or `MainLayout.tsx`:**
- Render `<FloatingMiniPlayer />` at root level (outside scroll container)

---

## 📱 Mobile-Specific Features

### 1. **Swipe Gestures**
- Swipe down: Dismiss mini player
- Swipe left/right: Navigate to next/previous video (future enhancement)

### 2. **Safe Area Insets**
```css
bottom: calc(env(safe-area-inset-bottom) + 16px);
```

### 3. **Touch Targets**
- All buttons: Minimum 44px × 44px
- Spacing between buttons: 8px minimum

### 4. **Performance on Mobile**
- Reduce animation duration (200ms instead of 300ms)
- Use `will-change: transform` for smooth animations
- Debounce scroll detection (check every 200ms on mobile)

---

## 🎯 User Flow

### Scenario 1: Scroll Away from Video
1. User expands video inline in card
2. Video starts playing
3. User scrolls down
4. Card scrolls out of viewport (detected by IntersectionObserver)
5. Mini player appears in bottom-right corner
6. Video continues playing in mini player
7. Original card iframe is paused/unmounted

### Scenario 2: Scroll Back to Video
1. User scrolls back up
2. Card enters viewport
3. Mini player auto-hides
4. Video continues in original card (or user can expand again)

### Scenario 3: Close Mini Player
1. User clicks close button (X)
2. Mini player disappears
3. Video pauses
4. User can resume by clicking card again

### Scenario 4: Expand from Mini Player
1. User clicks expand button (maximize icon)
2. Mini player closes
3. Full `YouTubeModal` opens
4. Video continues playing seamlessly

---

## 🔒 Edge Cases & Error Handling

### 1. **Multiple Videos**
- Only one mini player can exist at a time
- Starting new video closes previous mini player
- Context enforces single-video policy

### 2. **Card Deleted/Unmounted**
- Mini player detects card no longer exists
- Auto-closes mini player
- Cleans up state

### 3. **Network Issues**
- Iframe error handling
- Fallback: Show error message in mini player
- Allow user to retry or close

### 4. **Page Navigation**
- Clean up mini player on route change
- Pause video before navigation
- Restore state if user returns (optional)

---

## 📊 Performance Metrics (Target)

- **Initial Render:** < 50ms
- **Scroll Detection:** < 5ms per check (using IntersectionObserver)
- **Animation:** 60fps (using CSS transforms)
- **Memory:** Only one iframe active at a time
- **Bundle Size:** +~8KB (mini player component + context)

---

## 🚀 Implementation Priority

### High Priority (MVP)
1. ✅ Global `VideoPlayerContext`
2. ✅ `FloatingMiniPlayer` component
3. ✅ IntersectionObserver integration
4. ✅ Basic controls (pause/play, close)

### Medium Priority (Enhanced UX)
5. Expand button (opens full modal)
6. Scroll-to-card functionality
7. Smooth animations
8. Mobile swipe gestures

### Low Priority (Nice-to-Have)
9. Video queue (play next video)
10. Mini player position customization
11. Keyboard shortcuts (space = pause/play)
12. Picture-in-picture fallback (for supported browsers)

---

## 🎨 Visual Mockup (Text Description)

```
┌─────────────────────────────────────────┐
│                                         │
│  [Scrollable Content]                  │
│                                         │
│  ┌─────────────────┐                   │
│  │  Card with Video│                   │
│  │  (out of view)  │                   │
│  └─────────────────┘                   │
│                                         │
│                    ┌──────────────┐    │
│                    │  [▶] Video  │    │ ← Mini Player
│                    │  Title...    │    │   (Fixed)
│                    │  [X] [⛶]    │    │
│                    └──────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

---

## ✅ Recommendation Summary

**Recommended Approach:** Custom Floating Mini Player

**Key Benefits:**
1. ✅ **Consistent UX** across all devices/browsers
2. ✅ **Full control** over behavior and appearance
3. ✅ **Mobile-optimized** with touch gestures
4. ✅ **Performance-friendly** (single iframe, lazy loading)
5. ✅ **Accessible** (keyboard navigation, ARIA labels)
6. ✅ **Maintainable** (follows existing patterns)

**Implementation Complexity:** Medium (2-3 days)
**Performance Impact:** Low (optimized with IntersectionObserver)
**User Value:** High (significantly improves UX)

---

## 📝 Next Steps

1. **Review & Approve** this recommendation
2. **Create `VideoPlayerContext`** for global state
3. **Build `FloatingMiniPlayer` component**
4. **Integrate IntersectionObserver** hook
5. **Update `CardMedia`** to connect to context
6. **Test on mobile** devices
7. **Polish animations** and transitions

---

**Ready to implement?** Let me know if you'd like me to proceed with the implementation! 🚀
