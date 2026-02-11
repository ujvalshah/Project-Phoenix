# Grid Expansion Recommendation: Clarification

**Date:** February 11, 2026  
**Context:** Clarifying the recommendation for inline expansion vs drawer/modal patterns

---

## Clarification Summary

You are **correct** in your understanding, but let me refine it:

### Current State
- ✅ **Mobile/Single-Column:** Inline expansion works well (no grid disruption)
- ✅ **Feed View:** Inline expansion works well (single column)
- ❌ **Desktop Multi-Column Grid:** Inline expansion breaks grid alignment

### Recommended Solution

**Context-Aware Pattern:**

1. **Desktop Multi-Column Grid (≥1024px, `viewMode === 'grid'`):**
   - ❌ **Remove inline expansion** (causes layout shift)
   - ✅ **Use Side Drawer** (preserves grid integrity)

2. **Mobile/Single-Column (<768px OR `viewMode === 'feed'`):**
   - ✅ **Keep inline expansion** (works perfectly, no disruption)
   - ✅ **No changes needed** (current implementation is good)

---

## Why This Makes Sense

### Mobile/Single-Column: Inline Expansion Works
```
Mobile Layout (Single Column):
┌─────────┐
│  Card 1 │ ← Expandable
│  [exp]  │ ← No alignment issues
├─────────┤
│  Card 2 │ ← Expandable
│  [exp]  │ ← No alignment issues
└─────────┘
```
**No grid disruption** because there's only one column. Expansion is natural and expected.

### Desktop Multi-Column Grid: Inline Expansion Breaks
```
Desktop Grid (4 Columns):
┌─────┬─────┬─────┬─────┐
│ C1  │ C2  │ C3  │ C4  │ ← Row 1
│[exp]│     │     │     │ ← C1 expanded breaks alignment
│     │     │     │     │
├─────┼─────┼─────┼─────┤
│ C5  │ C6  │ C7  │ C8  │ ← Row 2 (misaligned)
└─────┴─────┴─────┴─────┘
```
**Grid disruption** because multiple columns need to stay aligned.

---

## Implementation Strategy

### Conditional Logic

```typescript
// In ArticleGrid or GridVariant component
const isMultiColumnGrid = viewMode === 'grid' && window.innerWidth >= 1024;
const shouldUseDrawer = isMultiColumnGrid;
const allowInlineExpansion = !shouldUseDrawer; // Mobile/feed keeps inline expansion

<CardContent
  allowExpansion={allowInlineExpansion} // false for desktop grid, true for mobile/feed
  // ... other props
/>
```

### Behavior Matrix

| View Mode | Screen Size | Current Behavior | Recommended Behavior |
|-----------|-------------|-----------------|---------------------|
| **Grid** | Desktop (≥1024px) | Inline expansion ❌ | Side Drawer ✅ |
| **Grid** | Tablet (768-1023px) | Inline expansion ❌ | Side Drawer ✅ |
| **Grid** | Mobile (<768px) | Inline expansion ✅ | **Keep inline expansion** ✅ |
| **Feed** | Any size | Inline expansion ✅ | **Keep inline expansion** ✅ |
| **Masonry** | Any size | No expansion | No expansion (unchanged) |

---

## Summary

**Your Understanding:** ✅ Correct
- Modal for mobile
- Side drawer for desktop/laptop

**Refinement:**
- **Side drawer** for **desktop multi-column grid** (where grid alignment matters)
- **Keep inline expansion** for **mobile/feed** (where it works perfectly)

**Rationale:**
- Problem is **specific to multi-column grids** on large screens
- Mobile/single-column doesn't have the alignment problem
- Feed view is single-column, so inline expansion is fine
- Solution is **context-aware**, not one-size-fits-all

---

## Next Steps

1. Implement side drawer for desktop multi-column grid
2. **Preserve** inline expansion for mobile/feed (no changes needed)
3. Add conditional logic to detect view mode + breakpoint
4. Test both patterns work correctly in their respective contexts

---

**Bottom Line:** You're right - drawer for desktop, but we should **keep** the existing inline expansion for mobile/feed since it works well there!
