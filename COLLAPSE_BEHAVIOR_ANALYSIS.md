# Collapse Behavior: Industry Standards & Recommendations

**Date:** February 11, 2026  
**Context:** Inline content expansion/collapse behavior in mobile/feed views

---

## Industry Standard: In-Place Collapse

### **Most Common Pattern: Content Collapses Where It Is**

**Platform Examples:**
- **Twitter/X:** Expanded tweets collapse in place - user stays at current scroll position
- **Reddit:** Expanded comments collapse in place - no scroll adjustment
- **Medium:** Article preview expansions collapse in place
- **Facebook:** Post expansions collapse in place
- **LinkedIn:** Post expansions collapse in place

**Behavior:**
- Content collapses where it currently is
- User's scroll position remains unchanged
- Smooth animation shows content shrinking
- No automatic scrolling occurs

**Why This Works:**
1. **Predictable** - Users know what to expect
2. **Non-disruptive** - Doesn't interrupt reading flow
3. **User control** - User collapses when done, expects to stay where they are
4. **Matches expectations** - Consistent with major platforms

---

## Alternative Patterns (Less Common)

### **Pattern 2: Scroll to Top of Expanded Section**

**When Used:**
- Some accordion implementations
- When expanded content is very long
- When maintaining context is critical

**Behavior:**
- Content collapses
- User scrolls to top of the expanded section (not original card position)
- Maintains visual context

**Trade-offs:**
- ✅ Better context preservation
- ⚠️ Can be disorienting if user was reading lower in expanded content
- ⚠️ More complex implementation

### **Pattern 3: Scroll to Original Card Position**

**When Used:**
- Rarely used in modern UIs
- Some older accordion patterns

**Behavior:**
- Content collapses
- User scrolls back to where card originally was
- Returns to "before expansion" state

**Trade-offs:**
- ✅ Returns to original context
- ⚠️ Very disorienting - user loses their place
- ⚠️ Feels jarring and unexpected
- ❌ Not recommended for inline expansions

---

## Recommendation for This Project

### **Recommended: In-Place Collapse (Industry Standard)**

**Implementation:**
```typescript
const collapseContent = useCallback(() => {
  if (allowExpansion && isExpanded) {
    setIsExpanded(false);
    // No scroll adjustment - content collapses where it is
  }
}, [allowExpansion, isExpanded]);
```

**Rationale:**
1. **Matches user expectations** - Users expect in-place collapse from major platforms
2. **Non-disruptive** - Doesn't interrupt reading flow
3. **Predictable** - Clear, consistent behavior
4. **Simple** - Easiest to implement and maintain
5. **Best UX** - Users collapse when done reading, want to continue from where they are

**When User Collapses:**
- User has finished reading expanded content
- User wants to continue scrolling to next card
- User wants to see more cards in feed
- **Expected behavior:** Content collapses, user stays where they are, can continue scrolling

---

## Edge Case Considerations

### **Scenario 1: User Expanded, Then Scrolled Down**
- **Current behavior:** User scrolls down within expanded content
- **On collapse:** Content collapses in place
- **User position:** Stays at current scroll position
- **Result:** ✅ Good - user can continue scrolling to next card

### **Scenario 2: User Expanded, Read Content, Wants to Collapse**
- **Current behavior:** User reads expanded content
- **On collapse:** Content collapses in place
- **User position:** Stays at current scroll position
- **Result:** ✅ Good - user can continue browsing

### **Scenario 3: Very Long Expanded Content**
- **Current behavior:** User expands very long content, scrolls down significantly
- **On collapse:** Content collapses in place
- **User position:** Stays at current scroll position
- **Result:** ✅ Good - user maintains their place in the feed

---

## Implementation Details

### **Current Implementation (CardContent.tsx)**

```typescript
const collapseContent = useCallback(() => {
  if (allowExpansion && isExpanded) {
    setIsExpanded(false);
    // No scroll adjustment - follows industry standard
  }
}, [allowExpansion, isExpanded]);
```

**Status:** ✅ Already implements in-place collapse (industry standard)

### **Animation Considerations**

**Smooth Transition:**
- Use CSS transitions for height changes
- Animate `max-height` or use `transform: scaleY()` for performance
- Duration: 200-300ms (fast enough to feel responsive, slow enough to be visible)

**Visual Feedback:**
- Content smoothly shrinks to collapsed state
- No jarring jumps or layout shifts
- Button state updates immediately (Expand → Collapse)

---

## Comparison Table

| Pattern | User Experience | Complexity | Industry Usage | Recommendation |
|---------|----------------|------------|----------------|---------------|
| **In-Place Collapse** | ✅ Predictable, non-disruptive | ✅ Simple | ✅ Most common | ✅ **Recommended** |
| Scroll to Top of Section | ⚠️ Can be disorienting | ⚠️ Medium | ⚠️ Less common | ⚠️ Consider for very long content |
| Scroll to Original Position | ❌ Very disorienting | ⚠️ Medium | ❌ Rare | ❌ Not recommended |

---

## Conclusion

**Industry Standard:** **In-place collapse** - content collapses where it is, user stays at current scroll position.

**Current Implementation:** ✅ Already follows industry standard

**Recommendation:** **Keep current implementation** - it matches user expectations from major platforms (Twitter, Reddit, Medium, etc.) and provides the best UX.

**No changes needed** - the current collapse behavior is optimal.

---

**References:**
- Twitter/X: Expanded tweets collapse in place
- Reddit: Expanded comments collapse in place  
- Medium: Article previews collapse in place
- W3C ARIA Accordion Pattern: Focus management, no scroll adjustment
- Nielsen Norman Group: Accordion best practices
