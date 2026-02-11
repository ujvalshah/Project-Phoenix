# Multi-Column Grid Expansion: Architecture & Interaction Model

**Date:** February 11, 2026  
**Author:** Senior Frontend Architect & UI/UX Systems Designer  
**Context:** Nugget News Cards in multi-column grid layout

---

## Executive Summary

Inline expansion in multi-column CSS Grid layouts creates **fundamental layout instability** that violates core dashboard UX principles. This document provides a comprehensive diagnosis, pattern evaluation, and recommended architecture for large-screen grid interactions.

**Core Problem:** Inline expansion causes:
- **Uneven row heights** → Grid alignment disruption
- **Layout shift** → Cumulative Layout Shift (CLS) violations
- **Scanability loss** → Broken visual rhythm in dense content grids
- **Reflow cascades** → Performance degradation

**Recommended Solution:** **Side Drawer Pattern for Desktop Multi-Column Grid** + **Keep Inline Expansion for Mobile/Feed Views** - Context-aware solution that preserves grid integrity where it matters.

---

## 1. Problem Diagnosis

### 1.1 CSS Grid Behavior Analysis

#### **Current Implementation**
```css
grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
grid-auto-rows: auto; /* or auto-rows-fr */
gap: 1.5rem;
```

#### **Why Inline Expansion Breaks Grid Layout**

**Root Cause: CSS Grid Auto-Row Behavior**

1. **`grid-auto-rows: auto`** (Current):
   - Each row height = tallest item in that row
   - When one card expands inline:
     - Row height increases dynamically
     - **Adjacent cards in same row stretch** (if using `items-stretch`)
     - **Cards in subsequent rows shift down** (reflow cascade)
     - Grid loses visual alignment

2. **`grid-auto-rows: min-content`** (Alternative):
   - Rows sized to minimum content
   - Expansion still breaks alignment
   - Worse: Cards become misaligned across columns

3. **`grid-auto-rows: 1fr`** (Equal-height attempt):
   - Forces equal row heights
   - **Expansion impossible** without breaking grid
   - Content overflow requires scrollbars (poor UX)

#### **Layout Shift Mechanics**

**Cumulative Layout Shift (CLS) Calculation:**
```
CLS = Σ (impact fraction × distance fraction)
```

When card expands inline:
- **Impact Fraction:** Entire row height change / viewport height
- **Distance Fraction:** Vertical displacement of subsequent rows
- **Result:** High CLS score (poor Core Web Vitals)

**Example:**
- Viewport: 1920px × 1080px
- Row height change: 400px (expanded card)
- Impact fraction: 400/1080 = **0.37**
- 5 rows below shift: Distance fraction: **0.15**
- **CLS contribution: 0.37 × 0.15 = 0.055** (exceeds 0.1 threshold when multiple cards expand)

### 1.2 Reflow Cascade Analysis

**Reflow Sequence (Browser Rendering):**
1. Card expands → Height calculation
2. Row height recalculated → Layout recalculation
3. Subsequent rows repositioned → Paint invalidation
4. Scroll position may shift → User disorientation
5. IntersectionObserver triggers → Infinite scroll may fire prematurely

**Performance Impact:**
- **Layout thrashing:** Multiple reflows per expansion
- **Paint invalidation:** Entire grid repainted
- **Memory pressure:** Expanded DOM nodes retained
- **Scroll jank:** Smooth scrolling disrupted

### 1.3 Scanability Disruption

**Visual Rhythm Breakdown:**

**Before Expansion:**
```
┌─────┬─────┬─────┬─────┐
│ Card│ Card│ Card│ Card│ ← Row 1 (aligned)
├─────┼─────┼─────┼─────┤
│ Card│ Card│ Card│ Card│ ← Row 2 (aligned)
├─────┼─────┼─────┼─────┤
│ Card│ Card│ Card│ Card│ ← Row 3 (aligned)
└─────┴─────┴─────┴─────┘
```

**After Inline Expansion:**
```
┌─────┬─────┬─────┬─────┐
│ Card│ Card│ Card│ Card│ ← Row 1
│     │     │     │     │
│     │     │     │     │ ← Expanded card breaks alignment
│     │     │     │     │
├─────┼─────┼─────┼─────┤
│ Card│ Card│ Card│ Card│ ← Row 2 (shifted down, misaligned)
├─────┼─────┼─────┼─────┤
│ Card│ Card│ Card│ Card│ ← Row 3 (further misaligned)
└─────┴─────┴─────┴─────┘
```

**Cognitive Load:**
- **Visual scanning disrupted:** Eye must reorient to find next card
- **Context loss:** Expanded card dominates viewport
- **Spatial memory broken:** User loses track of grid position
- **Comparison difficulty:** Cannot compare cards side-by-side

### 1.4 Financial/News Content Requirements

**Information Density Needs:**
- **Scanability:** Users need to quickly scan multiple nuggets
- **Comparison:** Side-by-side comparison of related content
- **Context preservation:** Grid context must remain visible
- **Progressive disclosure:** Full content available without losing context

**Current Inline Expansion Violates:**
- ✅ Scanability: **BROKEN** (grid alignment lost)
- ✅ Comparison: **BROKEN** (cards misaligned)
- ✅ Context: **PARTIAL** (grid still visible but disrupted)
- ✅ Progressive disclosure: **ACHIEVED** (but at cost of layout)

---

## 2. Pattern Comparison

### 2.1 Pattern Evaluation Matrix

| Pattern | Grid Integrity | Layout Shift | Scanability | Context Preservation | Mobile UX | Implementation Complexity | Performance |
|---------|---------------|--------------|-------------|---------------------|-----------|-------------------------|-------------|
| **Inline Expansion** (Current) | ❌ Broken | ❌ High CLS | ❌ Poor | ⚠️ Partial | ✅ Good | ✅ Low | ⚠️ Reflow issues |
| **Modal** | ✅ Perfect | ✅ Zero | ✅ Perfect | ❌ Lost | ⚠️ Acceptable | ✅ Low | ✅ Excellent |
| **Side Drawer** | ✅ Perfect | ✅ Zero | ✅ Perfect | ✅ Perfect | ✅ Excellent | ⚠️ Medium | ✅ Excellent |
| **Row Expansion** | ⚠️ Partial | ⚠️ Medium | ⚠️ Medium | ✅ Good | ⚠️ Poor | ⚠️ Medium | ⚠️ Reflow |
| **Fixed-Height Preview** | ✅ Perfect | ✅ Zero | ✅ Perfect | ⚠️ Partial | ✅ Good | ⚠️ Medium | ✅ Excellent |
| **Route Navigation** | ✅ Perfect | ✅ Zero | ✅ Perfect | ❌ Lost | ⚠️ Acceptable | ✅ Low | ✅ Excellent |

---

### 2.2 Pattern Deep Dive

#### **Pattern 1: Modal (Full-Screen Overlay)**

**Architecture:**
```
Grid (unchanged) → Click → Modal overlay → Full content
```

**Pros:**
- ✅ **Zero layout shift:** Grid completely unaffected
- ✅ **Perfect scanability:** Grid remains intact
- ✅ **Simple implementation:** Standard modal pattern
- ✅ **Performance:** No reflow, isolated rendering
- ✅ **Mobile-friendly:** Full-screen modal works well

**Cons:**
- ❌ **Context loss:** Grid hidden behind overlay
- ❌ **Navigation cost:** Must close modal to return to grid
- ⚠️ **Desktop UX:** May feel heavy for quick content preview

**Use Case:** Best for **deep-dive reading** when user wants full focus.

**Verdict:** ⭐⭐⭐⭐ (4/5) - Excellent for mobile, acceptable for desktop.

---

#### **Pattern 2: Side Drawer (Recommended) ⭐**

**Architecture:**
```
Grid (unchanged) → Click → Side drawer slides in → Full content
```

**Pros:**
- ✅ **Zero layout shift:** Grid remains visible and stable
- ✅ **Perfect scanability:** Grid alignment preserved
- ✅ **Context preservation:** Grid visible alongside drawer
- ✅ **Progressive disclosure:** Smooth, non-destructive expansion
- ✅ **Mobile-optimized:** Drawer can be full-width on mobile
- ✅ **Desktop-optimized:** Side-by-side view maintains context
- ✅ **Performance:** No reflow, isolated rendering

**Cons:**
- ⚠️ **Implementation complexity:** Requires drawer component + state management
- ⚠️ **Viewport width:** Requires minimum width (not issue for large screens)

**Use Case:** Best for **progressive disclosure** when user wants to read full content while maintaining grid context.

**Verdict:** ⭐⭐⭐⭐⭐ (5/5) - **RECOMMENDED** - Best balance of UX and technical feasibility.

---

#### **Pattern 3: Row-Based Full-Width Expansion**

**Architecture:**
```
Grid → Click → Card expands to full row width → Full content
```

**Pros:**
- ✅ **Context preservation:** Grid still visible
- ✅ **Visual prominence:** Expanded card gets full attention

**Cons:**
- ❌ **Layout shift:** Row height changes, subsequent rows shift
- ❌ **Grid disruption:** Breaks column alignment
- ❌ **Scanability loss:** Visual rhythm disrupted
- ⚠️ **Mobile UX:** Full-width expansion feels cramped

**Use Case:** Not recommended for multi-column grids.

**Verdict:** ⭐⭐ (2/5) - Better than inline, but still causes layout shift.

---

#### **Pattern 4: Fixed-Height Preview + Detail View**

**Architecture:**
```
Grid (fixed heights) → Click → Separate detail view → Full content
```

**Pros:**
- ✅ **Zero layout shift:** Grid heights fixed
- ✅ **Perfect scanability:** Consistent card heights
- ✅ **Performance:** No reflow

**Cons:**
- ❌ **Content truncation:** May hide important information
- ❌ **Navigation cost:** Requires separate view
- ⚠️ **UX complexity:** Two-step navigation (preview → detail)

**Use Case:** Best for **card-heavy** interfaces where consistency > content visibility.

**Verdict:** ⭐⭐⭐ (3/5) - Good for consistency, but sacrifices content visibility.

---

#### **Pattern 5: Route-Based Navigation**

**Architecture:**
```
Grid → Click → Navigate to /article/:id → Full article page
```

**Pros:**
- ✅ **Zero layout shift:** Grid completely unaffected
- ✅ **Perfect scanability:** Grid remains intact
- ✅ **SEO-friendly:** Each article has unique URL
- ✅ **Shareable:** Direct links to articles

**Cons:**
- ❌ **Context loss:** User leaves grid entirely
- ❌ **Navigation cost:** Back button required
- ❌ **State management:** Must preserve grid scroll position
- ⚠️ **Mobile UX:** Page navigation feels heavy

**Use Case:** Best for **article-focused** experiences where each nugget is a full article.

**Verdict:** ⭐⭐⭐ (3/5) - Good for SEO/shareability, but loses context.

---

## 3. Recommended Architecture

### 3.1 Hybrid Pattern: Side Drawer (Desktop Multi-Column Grid) + Keep Inline Expansion (Mobile/Feed)

**Core Principle:** **Progressive disclosure without layout disruption**

**Breakpoint Strategy:**
- **Desktop Multi-Column Grid (≥1024px, grid view):** Side drawer (preserves grid context, prevents layout shift)
- **Tablet Multi-Column Grid (768px-1023px, grid view):** Side drawer (full-width overlay)
- **Mobile Single-Column (<768px) OR Feed View:** **Keep inline expansion** (no grid disruption, works well)

**Rationale:**
- **Multi-column grids** on desktop break with inline expansion → Use side drawer
- **Single-column layouts** (mobile) or **feed view** don't break with inline expansion → Keep current inline expansion
- **Context-dependent:** Solution applies specifically to multi-column grid layouts where alignment matters

---

### 3.2 Interaction Model

#### **Desktop Flow (Side Drawer):**
```
1. User clicks card → Drawer slides in from right (400px width)
2. Grid remains visible (dimmed overlay, 60% opacity)
3. Drawer shows full content (scrollable)
4. User can:
   - Read full content
   - Click other cards (drawer updates, no close)
   - Click overlay/ESC (drawer closes)
   - Scroll grid (drawer stays open)
```

#### **Mobile/Single-Column Flow (Keep Inline Expansion):**
```
1. User clicks "Read more" → Content expands inline
2. Grid remains visible (single column, no alignment issues)
3. Expanded content shows full text
4. User can:
   - Read full content
   - Click "Collapse" to minimize
   - Scroll naturally (no layout disruption)
```

**Note:** Inline expansion works well on mobile/single-column because:
- No multi-column alignment to preserve
- No layout shift (single column expands naturally)
- Context preserved (user sees grid above/below)
- Familiar mobile pattern

#### **Keyboard Navigation:**
- **Tab:** Navigate through cards in grid
- **Enter/Space:** Open drawer/modal
- **Arrow Keys:** Navigate between cards (when drawer open)
- **ESC:** Close drawer/modal
- **Focus Management:** Focus trapped in drawer when open

---

### 3.3 State Management Architecture

**Global State (Context/Store):**
```typescript
interface GridExpansionState {
  expandedCardId: string | null;
  drawerOpen: boolean;
  previousScrollPosition: number; // For restoration
}
```

**Component Hierarchy:**
```
ArticleGrid (manages expansion state)
  ├── NewsCard[] (triggers expansion)
  └── ArticleDrawer (renders expanded content)
      ├── ArticleDetail (full content)
      └── RelatedCards (optional)
```

**State Flow:**
1. User clicks card → `setExpandedCardId(cardId)`
2. Drawer opens → `setDrawerOpen(true)`
3. User clicks another card → `setExpandedCardId(newCardId)` (drawer updates)
4. User closes drawer → `setExpandedCardId(null)`, `setDrawerOpen(false)`

---

### 3.4 Layout Strategy

#### **Grid Container (Unchanged):**
```css
.grid-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  grid-auto-rows: minmax(400px, auto); /* Fixed min-height */
  gap: 1.5rem;
  position: relative; /* For drawer positioning */
}
```

**Key Points:**
- **Fixed min-height:** Prevents collapse, maintains alignment
- **Auto max-height:** Allows natural content sizing
- **No expansion:** Cards never expand beyond max-height

#### **Drawer Container:**
```css
.drawer-container {
  position: fixed;
  top: 0;
  right: 0;
  height: 100vh;
  width: 400px; /* Desktop */
  max-width: 90vw; /* Mobile */
  z-index: 1000;
  transform: translateX(100%); /* Hidden by default */
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.drawer-container.open {
  transform: translateX(0);
}
```

**Key Points:**
- **Fixed positioning:** Doesn't affect grid layout
- **Smooth animation:** CSS transform (GPU-accelerated)
- **Responsive width:** Adapts to viewport

#### **Grid Overlay (When Drawer Open):**
```css
.grid-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 999;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s;
}

.grid-overlay.active {
  opacity: 1;
  pointer-events: auto; /* Clickable to close drawer */
}
```

---

### 3.5 Animation Approach

#### **Drawer Entrance:**
```css
@keyframes drawerSlideIn {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}
```

**Performance Optimizations:**
- **CSS Transforms:** GPU-accelerated (no layout recalculation)
- **Will-change:** `will-change: transform` on drawer element
- **Reduce motion:** Respect `prefers-reduced-motion`

#### **Card Click Feedback:**
```css
.card-clicked {
  transform: scale(0.98);
  transition: transform 0.1s;
}
```

**Purpose:** Visual feedback without layout shift.

---

### 3.6 Performance Considerations

#### **Rendering Strategy:**

1. **Lazy Loading:**
   - Drawer content loads **on-demand** (when opened)
   - Use `React.lazy()` for ArticleDetail component
   - Code-split drawer-related components

2. **Virtualization (If Needed):**
   - For grids with 100+ cards, use `react-window` or `react-virtual`
   - Only render visible cards + buffer
   - Drawer content always rendered (single item)

3. **Memoization:**
   - Memoize card components (`React.memo`)
   - Memoize drawer content (prevents re-render on grid scroll)
   - Use `useMemo` for expensive calculations

4. **Scroll Position Management:**
   - Save grid scroll position when drawer opens
   - Restore on drawer close
   - Use `sessionStorage` for persistence across navigation

#### **Memory Management:**
- **Unmount drawer content** when closed (if memory constrained)
- **Keep drawer content mounted** if user frequently expands cards (better UX)
- **Configurable:** Allow user preference

---

## 4. Technical Guidance

### 4.1 Component Architecture

#### **ArticleDrawer Component:**
```typescript
interface ArticleDrawerProps {
  isOpen: boolean;
  articleId: string | null;
  onClose: () => void;
  onNavigateToCard: (cardId: string) => void; // For arrow key navigation
}
```

**Responsibilities:**
- Render drawer container
- Handle open/close animations
- Manage focus trap
- Handle keyboard navigation
- Render ArticleDetail content

#### **ArticleGrid Component Updates:**
```typescript
// Add expansion state
const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
const [drawerOpen, setDrawerOpen] = useState(false);

// Handle card click
const handleCardClick = (article: Article) => {
  setExpandedCardId(article.id);
  setDrawerOpen(true);
};

// Handle drawer close
const handleDrawerClose = () => {
  setDrawerOpen(false);
  // Optional: Clear expandedCardId after animation
  setTimeout(() => setExpandedCardId(null), 300);
};
```

---

### 4.2 Accessibility Considerations

#### **Focus Management:**
- **Drawer opens:** Focus moves to drawer content
- **Drawer closes:** Focus returns to triggering card
- **Focus trap:** Tab navigation stays within drawer when open
- **Skip link:** "Skip to grid" link in drawer header

#### **ARIA Attributes:**
```html
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="drawer-title"
  aria-describedby="drawer-content"
>
  <h2 id="drawer-title">Article Title</h2>
  <div id="drawer-content">...</div>
</div>
```

#### **Keyboard Navigation:**
- **ESC:** Close drawer
- **Tab:** Navigate within drawer
- **Arrow Left/Right:** Navigate to previous/next card (when drawer open)
- **Home/End:** Navigate to first/last card

---

### 4.3 Mobile Optimization

#### **Breakpoint Detection:**
```typescript
const isMobile = useMediaQuery('(max-width: 767px)');
const drawerWidth = isMobile ? '100vw' : '400px';
```

#### **Touch Gestures:**
- **Swipe right:** Close drawer (mobile)
- **Swipe left:** Open next card (optional)
- **Pull-to-refresh:** Disabled when drawer open

#### **Safe Area Handling:**
```css
.drawer-container {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}
```

---

### 4.4 State Persistence

#### **URL State (Optional):**
```typescript
// Sync drawer state with URL
useEffect(() => {
  if (expandedCardId) {
    window.history.pushState(
      { expandedCardId },
      '',
      `/grid?expanded=${expandedCardId}`
    );
  } else {
    window.history.replaceState({}, '', '/grid');
  }
}, [expandedCardId]);
```

**Benefits:**
- Shareable URLs (user can share expanded card)
- Browser back/forward navigation
- Deep linking support

**Trade-offs:**
- More complex state management
- Requires route handling

---

## 5. Priority Actions

### 5.1 High Priority (Immediate)

#### **Action 1: Implement Side Drawer Component** 🔴
**Impact:** Eliminates layout shift, preserves grid integrity  
**Effort:** 2-3 days  
**Dependencies:** None

**Tasks:**
1. Create `ArticleDrawer` component
2. Add drawer state management to `ArticleGrid`
3. Implement open/close animations
4. Add focus management and keyboard navigation
5. Test across breakpoints

---

#### **Action 2: Remove Inline Expansion from Grid View** 🔴
**Impact:** Prevents layout disruption  
**Effort:** 1 day  
**Dependencies:** Action 1

**Tasks:**
1. Disable `allowExpansion` prop for grid variant
2. Update "Read more" button to open drawer instead
3. Remove expansion state from grid cards
4. Test grid stability

---

#### **Action 3: Add Grid Overlay (Dim Background)** 🟠
**Impact:** Improves visual hierarchy, indicates drawer state  
**Effort:** 0.5 days  
**Dependencies:** Action 1

**Tasks:**
1. Add overlay component
2. Animate opacity on drawer open/close
3. Make overlay clickable to close drawer
4. Test visual feedback

---

### 5.2 Medium Priority (Short-term)

#### **Action 4: Implement Keyboard Navigation** 🟠
**Impact:** Improves accessibility and power-user UX  
**Effort:** 1 day  
**Dependencies:** Action 1

**Tasks:**
1. Add arrow key navigation (prev/next card)
2. Implement focus trap in drawer
3. Add skip links
4. Test with screen readers

---

#### **Action 5: Preserve Inline Expansion for Mobile/Feed** 🟠
**Impact:** Maintains existing mobile UX that works well  
**Effort:** 0.5 days  
**Dependencies:** Action 1

**Tasks:**
1. Detect view mode (grid vs feed) and breakpoint
2. Keep `allowExpansion={true}` for mobile/feed views
3. Disable `allowExpansion` only for desktop multi-column grid
4. Test that mobile inline expansion still works correctly

---

#### **Action 6: Performance Optimization** 🟠
**Impact:** Improves rendering performance  
**Effort:** 1-2 days  
**Dependencies:** Action 1

**Tasks:**
1. Lazy-load drawer content
2. Memoize card components
3. Implement scroll position restoration
4. Add virtualization if needed (100+ cards)

---

### 5.3 Low Priority (Long-term)

#### **Action 7: URL State Synchronization** 🟢
**Impact:** Enables shareable links, browser navigation  
**Effort:** 1 day  
**Dependencies:** Action 1

**Tasks:**
1. Sync drawer state with URL query params
2. Handle browser back/forward navigation
3. Add deep linking support
4. Test URL state persistence

---

#### **Action 8: Related Cards in Drawer** 🟢
**Impact:** Enhances content discovery  
**Effort:** 2-3 days  
**Dependencies:** Action 1

**Tasks:**
1. Add "Related Cards" section in drawer
2. Implement card recommendation logic
3. Add navigation between related cards
4. Test recommendation quality

---

#### **Action 9: Drawer Customization** 🟢
**Impact:** Improves user experience  
**Effort:** 1-2 days  
**Dependencies:** Action 1

**Tasks:**
1. Allow user to resize drawer width (desktop)
2. Add drawer position preference (left/right)
3. Persist preferences in localStorage
4. Test customization flow

---

## 6. Implementation Roadmap

### Phase 1: Foundation (Week 1)
- ✅ Implement `ArticleDrawer` component
- ✅ Add drawer state management
- ✅ Remove inline expansion from grid
- ✅ Basic open/close animations

### Phase 2: Polish (Week 2)
- ✅ Grid overlay and visual feedback
- ✅ Keyboard navigation
- ✅ Mobile modal fallback
- ✅ Focus management

### Phase 3: Optimization (Week 3)
- ✅ Performance optimizations
- ✅ Lazy loading
- ✅ Scroll position restoration
- ✅ Accessibility improvements

### Phase 4: Enhancement (Week 4)
- ✅ URL state synchronization
- ✅ Related cards
- ✅ User preferences
- ✅ Testing and refinement

---

## 7. Success Metrics

### Layout Stability
- **CLS Score:** < 0.1 (target: 0.05)
- **Layout Shift Events:** 0 (no grid reflow)
- **Grid Alignment:** 100% consistent (no misalignment)

### User Experience
- **Task Completion Rate:** >95% (users can successfully read full content)
- **Context Preservation:** Users maintain grid awareness
- **Navigation Efficiency:** <2 seconds to open/close drawer

### Performance
- **Drawer Open Time:** <200ms
- **Animation FPS:** 60fps (smooth animations)
- **Memory Usage:** No increase (drawer content lazy-loaded)

---

## 8. Conclusion

**Recommended Solution:** **Side Drawer Pattern** with mobile modal fallback.

**Key Benefits:**
1. ✅ **Zero layout shift** - Grid integrity preserved
2. ✅ **Perfect scanability** - Visual rhythm maintained
3. ✅ **Context preservation** - Grid visible alongside content
4. ✅ **Progressive disclosure** - Smooth, non-destructive expansion
5. ✅ **Performance** - No reflow, GPU-accelerated animations

**Implementation Priority:**
- **High:** Side drawer + remove inline expansion
- **Medium:** Keyboard navigation + mobile optimization
- **Low:** URL state + related cards

**Estimated Total Effort:** 2-3 weeks for complete implementation

**Expected Impact:**
- ✅ Eliminates layout shift (CLS improvement)
- ✅ Improves scanability (faster content discovery)
- ✅ Maintains grid integrity (consistent visual rhythm)
- ✅ Enhances user experience (progressive disclosure)

---

## 9. References

- [CSS Grid Layout - MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Grid_Layout)
- [Cumulative Layout Shift (CLS) - Web.dev](https://web.dev/cls/)
- [Material Design - Navigation Drawer](https://material.io/components/navigation-drawer)
- [Apple Human Interface Guidelines - Modals](https://developer.apple.com/design/human-interface-guidelines/components/presentation/modals/)
- [WCAG 2.1 - Focus Management](https://www.w3.org/WAI/WCAG21/Understanding/focus-order.html)
- [React Aria - Focus Management](https://react-spectrum.adobe.com/react-aria/useFocusRing.html)

---

**Document Status:** Complete  
**Next Steps:** Review and approve architecture, then proceed with Phase 1 implementation
