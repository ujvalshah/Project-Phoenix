# Proactive QA/QC Audit Checklist

**Purpose:** Prevent common bugs before they reach production through systematic code review and development practices.

**When to Use:**
- Before committing new features
- During code reviews
- Before merging PRs
- During refactoring
- When adding new async operations

---

## 🚨 Critical Patterns to Audit

### 1. Component Lifecycle & State Updates

#### ✅ Checklist:
- [ ] **State updates after unmount**: All async operations check `isMounted` before `setState`
- [ ] **useEffect cleanup**: Every `useEffect` with async operations has cleanup function
- [ ] **Memory leaks**: Event listeners, timers, subscriptions are cleaned up
- [ ] **Race conditions**: Multiple rapid state updates are handled correctly

#### 🔍 Pattern to Look For:
```typescript
// ❌ BAD - State update after unmount
const loadData = async () => {
  const data = await fetchData();
  setData(data); // Could crash if component unmounted
};

// ✅ GOOD - Protected state update
const loadData = async (isMounted: { current: boolean }) => {
  const data = await fetchData();
  if (isMounted.current) {
    setData(data);
  }
};
```

#### 📋 Audit Questions:
1. Does every async operation check mount status before updating state?
2. Are all `useEffect` hooks properly cleaned up?
3. Are event listeners removed in cleanup?
4. Are timers/intervals cleared?

---

### 2. Async Operations & Error Handling

#### ✅ Checklist:
- [ ] **Request cancellation**: Cancelled requests are handled gracefully
- [ ] **Error boundaries**: Critical errors don't crash entire app
- [ ] **Loading states**: UI shows loading state during async operations
- [ ] **Error messages**: Users see helpful error messages
- [ ] **Retry logic**: Failed operations can be retried
- [ ] **Timeout handling**: Long-running operations have timeouts

#### 🔍 Pattern to Look For:
```typescript
// ❌ BAD - Unhandled cancellation
try {
  const data = await apiClient.get('/data');
  setData(data);
} catch (e) {
  toast.error("Failed"); // Shows error even for cancellations
}

// ✅ GOOD - Handled cancellation
try {
  const data = await apiClient.get('/data');
  if (isMounted.current) setData(data);
} catch (e: any) {
  if (e?.message === 'Request cancelled') return; // Silent ignore
  if (isMounted.current) toast.error("Failed");
}
```

#### 📋 Audit Questions:
1. Are cancelled requests handled silently?
2. Do error handlers check mount status before showing toasts?
3. Are network errors differentiated from validation errors?
4. Are async operations wrapped in try-catch?

---

### 3. Navigation & Route Changes

#### ✅ Checklist:
- [ ] **Navigation guards**: Prevent navigation during critical operations
- [ ] **Route params validation**: URL params are validated before use
- [ ] **Redirect handling**: Redirects don't cause infinite loops
- [ ] **Deep linking**: Direct URLs work correctly
- [ ] **Back button**: Browser back button works as expected
- [ ] **State preservation**: Important state is preserved during navigation

#### 🔍 Pattern to Look For:
```typescript
// ❌ BAD - Navigation during processing
<button onClick={() => navigate('/home')}>
  Go Back
</button>

// ✅ GOOD - Guarded navigation
<button 
  onClick={() => {
    if (isProcessing) {
      toast.error("Please wait");
      return;
    }
    navigate('/home');
  }}
>
  Go Back
</button>
```

#### 📋 Audit Questions:
1. Can users navigate away during critical operations?
2. Are route params validated before use?
3. Do redirects handle missing data gracefully?
4. Is navigation state cleaned up properly?

---

### 4. Array & Object Safety

#### ✅ Checklist:
- [ ] **Null/undefined checks**: Arrays/objects checked before calling methods
- [ ] **Default values**: Arrays default to `[]`, objects to `{}`
- [ ] **Type guards**: Runtime checks for expected types
- [ ] **Optional chaining**: Used for nested property access
- [ ] **Array methods**: `.filter()`, `.map()`, etc. only called on arrays

#### 🔍 Pattern to Look For:
```typescript
// ❌ BAD - No null check
const items = articles.filter(a => a.visible);

// ✅ GOOD - Defensive check
const safeArticles = Array.isArray(articles) ? articles : [];
const items = safeArticles.filter(a => a.visible);
```

#### 📋 Audit Questions:
1. Are arrays validated before calling `.filter()`, `.map()`, etc.?
2. Are API responses validated before use?
3. Are default values provided for optional data?
4. Is optional chaining used for nested properties?

---

### 5. Form Handling & Validation

#### ✅ Checklist:
- [ ] **Input validation**: All inputs validated before submission
- [ ] **Disabled states**: Buttons disabled during submission
- [ ] **Form reset**: Forms reset after successful submission
- [ ] **Error display**: Validation errors shown to users
- [ ] **Loading states**: Forms show loading during submission
- [ ] **Duplicate prevention**: Prevents double-submission

#### 🔍 Pattern to Look For:
```typescript
// ❌ BAD - No validation, can submit multiple times
const handleSubmit = async () => {
  await createArticle(data);
};

// ✅ GOOD - Validated, protected
const handleSubmit = async () => {
  if (isSubmitting || !isValid) return;
  setIsSubmitting(true);
  try {
    await createArticle(data);
    resetForm();
  } finally {
    setIsSubmitting(false);
  }
};
```

#### 📋 Audit Questions:
1. Are forms validated before submission?
2. Are submit buttons disabled during processing?
3. Are forms reset after successful submission?
4. Is double-submission prevented?

---

### 6. API Integration & Data Fetching

#### ✅ Checklist:
- [ ] **Request cancellation**: Previous requests cancelled when new ones start
- [ ] **Error handling**: Network errors handled gracefully
- [ ] **Loading states**: UI shows loading during fetches
- [ ] **Empty states**: Empty data handled gracefully
- [ ] **Pagination**: Large datasets paginated correctly
- [ ] **Cache invalidation**: Stale data refreshed appropriately

#### 🔍 Pattern to Look For:
```typescript
// ❌ BAD - No cancellation, race conditions
const loadData = async () => {
  const data = await apiClient.get('/data');
  setData(data);
};

// ✅ GOOD - Cancellation key, mount check
const loadData = async (isMounted: { current: boolean }) => {
  try {
    const data = await apiClient.get('/data', undefined, 'loadData');
    if (isMounted.current) setData(data);
  } catch (e: any) {
    if (e?.message === 'Request cancelled') return;
    if (isMounted.current) handleError(e);
  }
};
```

#### 📋 Audit Questions:
1. Are duplicate requests cancelled?
2. Are API errors handled with user-friendly messages?
3. Are loading states shown during fetches?
4. Is empty data handled gracefully?

---

### 7. Type Safety & Runtime Validation

#### ✅ Checklist:
- [ ] **TypeScript types**: All functions have proper types
- [ ] **Runtime validation**: API responses validated at runtime
- [ ] **Type guards**: Type narrowing used where needed
- [ ] **Optional types**: Optional properties handled correctly
- [ ] **Union types**: Union types handled exhaustively

#### 🔍 Pattern to Look For:
```typescript
// ❌ BAD - No runtime validation
const processData = (data: any) => {
  return data.items.map(i => i.name);
};

// ✅ GOOD - Runtime validation
const processData = (data: unknown) => {
  if (!data || typeof data !== 'object') return [];
  if (!('items' in data) || !Array.isArray(data.items)) return [];
  return data.items
    .filter((i): i is { name: string } => typeof i === 'object' && 'name' in i)
    .map(i => i.name);
};
```

#### 📋 Audit Questions:
1. Are API responses validated at runtime?
2. Are TypeScript types accurate?
3. Are type guards used for type narrowing?
4. Are optional properties handled safely?

---

### 8. Performance & Optimization

#### ✅ Checklist:
- [ ] **Memoization**: Expensive computations memoized
- [ ] **Debouncing**: Search/input debounced appropriately
- [ ] **Lazy loading**: Heavy components lazy loaded
- [ ] **Code splitting**: Routes code-split
- [ ] **Image optimization**: Images optimized/compressed
- [ ] **Bundle size**: Bundle size monitored

#### 📋 Audit Questions:
1. Are expensive computations memoized?
2. Are search inputs debounced?
3. Are heavy components lazy loaded?
4. Is bundle size reasonable?

---

### 9. Accessibility & UX

#### ✅ Checklist:
- [ ] **Keyboard navigation**: All interactive elements keyboard accessible
- [ ] **Screen readers**: ARIA labels provided
- [ ] **Focus management**: Focus handled correctly
- [ ] **Error announcements**: Errors announced to screen readers
- [ ] **Loading announcements**: Loading states announced

#### 📋 Audit Questions:
1. Can all features be used with keyboard only?
2. Are ARIA labels provided?
3. Is focus managed correctly in modals?
4. Are errors announced to screen readers?

---

### 10. Security & Data Protection

#### ✅ Checklist:
- [ ] **Input sanitization**: User input sanitized
- [ ] **XSS prevention**: No dangerous HTML injection
- [ ] **CSRF protection**: Forms protected against CSRF
- [ ] **Authentication**: Protected routes require auth
- [ ] **Authorization**: Users can only access authorized data
- [ ] **Sensitive data**: Sensitive data not logged

#### 📋 Audit Questions:
1. Is user input sanitized?
2. Are protected routes properly guarded?
3. Can users access unauthorized data?
4. Is sensitive data logged anywhere?

---

## 🔄 Pre-Commit Checklist

Before committing code, verify:

- [ ] All async operations check mount status
- [ ] All errors are handled gracefully
- [ ] Arrays/objects validated before use
- [ ] Navigation is guarded during operations
- [ ] Forms prevent double-submission
- [ ] Request cancellations handled
- [ ] No console errors in browser
- [ ] No TypeScript errors
- [ ] No memory leaks (check React DevTools)
- [ ] Works with slow network (throttle in DevTools)

---

## 🧪 Testing Checklist

### Manual Testing:
- [ ] Test with slow 3G network
- [ ] Test rapid navigation (click back/forward quickly)
- [ ] Test with empty/null data
- [ ] Test error scenarios (disconnect network)
- [ ] Test on mobile devices
- [ ] Test keyboard navigation
- [ ] Test screen reader (if applicable)

### Automated Testing:
- [ ] Unit tests for critical functions
- [ ] Integration tests for user flows
- [ ] E2E tests for critical paths
- [ ] Error boundary tests

---

## 📊 Code Review Template

When reviewing code, check:

### Function/Component Level:
1. ✅ Are all async operations protected?
2. ✅ Are errors handled appropriately?
3. ✅ Are edge cases handled?
4. ✅ Is the code readable and maintainable?

### Integration Level:
1. ✅ Does it work with existing code?
2. ✅ Are there any breaking changes?
3. ✅ Is state management correct?
4. ✅ Are API calls optimized?

### User Experience:
1. ✅ Is loading state shown?
2. ✅ Are errors user-friendly?
3. ✅ Is navigation smooth?
4. ✅ Is the UI responsive?

---

## 🛠️ Tools & Automation

### Recommended Tools:
- **ESLint**: Catch common mistakes
- **TypeScript**: Type safety
- **React DevTools**: Debug components
- **React Query DevTools**: Debug data fetching
- **Lighthouse**: Performance audit
- **Accessibility DevTools**: A11y audit

### ESLint Rules to Enable:
```json
{
  "rules": {
    "react-hooks/exhaustive-deps": "warn",
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-non-null-assertion": "warn",
    "no-console": ["warn", { "allow": ["warn", "error"] }]
  }
}
```

---

## 📝 Common Bug Patterns & Solutions

### Pattern 1: State Update After Unmount
**Symptom:** Console warnings, crashes
**Solution:** Use `isMountedRef` pattern

### Pattern 2: Array Method on Non-Array
**Symptom:** `TypeError: X.filter is not a function`
**Solution:** Always validate arrays before use

### Pattern 3: Unhandled Promise Rejection
**Symptom:** Uncaught promise errors in console
**Solution:** Handle cancellations and errors

### Pattern 4: Memory Leak
**Symptom:** Performance degrades over time
**Solution:** Clean up subscriptions, timers, listeners

### Pattern 5: Race Condition
**Symptom:** Stale data displayed
**Solution:** Cancel previous requests, use cancellation keys

---

## 🎯 Quick Reference: Red Flags

Watch out for these patterns:

- ❌ `setState()` in async without mount check
- ❌ `.filter()` without array validation
- ❌ `navigate()` without guards
- ❌ `await` without try-catch
- ❌ `useEffect` without cleanup
- ❌ Event listeners without removal
- ❌ Timers without clearing
- ❌ API calls without cancellation

---

## 📚 Best Practices Summary

1. **Always check mount status** before state updates in async operations
2. **Always validate arrays** before calling array methods
3. **Always handle errors** gracefully with user-friendly messages
4. **Always clean up** subscriptions, timers, listeners
5. **Always guard navigation** during critical operations
6. **Always validate API responses** at runtime
7. **Always use cancellation keys** for duplicate requests
8. **Always provide loading states** for async operations
9. **Always handle empty states** gracefully
10. **Always test edge cases** (empty, null, error scenarios)

---

**Last Updated:** 2025-01-XX  
**Maintained By:** Development Team  
**Review Frequency:** Before each release












