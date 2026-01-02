# Code Review Template

Use this template for every code review to ensure consistency and catch common issues.

---

## 📋 Review Checklist

### 🔴 Critical (Must Fix)
- [ ] No state updates after component unmount
- [ ] All async operations have error handling
- [ ] Arrays validated before calling methods
- [ ] Navigation guarded during operations
- [ ] No memory leaks (subscriptions cleaned up)
- [ ] Request cancellations handled
- [ ] Protected routes require authentication

### 🟡 Important (Should Fix)
- [ ] Loading states shown during async operations
- [ ] Error messages are user-friendly
- [ ] Forms prevent double-submission
- [ ] Empty states handled gracefully
- [ ] TypeScript types are accurate
- [ ] No `any` types (or justified)
- [ ] Code is readable and maintainable

### 🟢 Nice to Have (Consider)
- [ ] Performance optimizations (memoization, debouncing)
- [ ] Accessibility improvements
- [ ] Code comments for complex logic
- [ ] Unit tests added
- [ ] Documentation updated

---

## 🔍 Specific Checks

### Component Lifecycle
```typescript
// ✅ GOOD Example
useEffect(() => {
  const isMounted = { current: true };
  
  const loadData = async () => {
    try {
      const data = await fetchData();
      if (isMounted.current) setData(data);
    } catch (e: any) {
      if (e?.message === 'Request cancelled') return;
      if (isMounted.current) handleError(e);
    }
  };
  
  loadData();
  
  return () => {
    isMounted.current = false;
  };
}, []);
```

### Array Safety
```typescript
// ✅ GOOD Example
const safeItems = Array.isArray(items) ? items : [];
const filtered = safeItems.filter(i => i.active);
```

### Navigation Guards
```typescript
// ✅ GOOD Example
const handleBack = () => {
  if (isProcessing) {
    toast.error("Please wait");
    return;
  }
  navigate('/home');
};
```

### Error Handling
```typescript
// ✅ GOOD Example
try {
  await operation();
} catch (e: any) {
  if (e?.message === 'Request cancelled') return;
  if (isMounted.current) {
    toast.error("Operation failed");
  }
}
```

---

## 📝 Review Comments Template

### For Critical Issues:
```
🔴 CRITICAL: [Issue description]

Problem: [What's wrong]
Impact: [What happens if not fixed]
Fix: [How to fix it]

Example:
🔴 CRITICAL: State update after unmount

Problem: setData() called after component unmounts
Impact: React warnings, potential crashes
Fix: Add isMounted check before setData()
```

### For Suggestions:
```
💡 SUGGESTION: [Suggestion]

Current: [What it does now]
Better: [What could be improved]
Benefit: [Why it's better]
```

---

## ✅ Approval Criteria

Code can be approved when:
- ✅ All critical issues fixed
- ✅ All important issues addressed or justified
- ✅ Code follows project patterns
- ✅ No console errors/warnings
- ✅ Works in tested scenarios
- ✅ TypeScript compiles without errors

---

## 🚫 Common Rejection Reasons

Code will be rejected if:
- ❌ State updates after unmount
- ❌ No error handling for async operations
- ❌ Array methods called on non-arrays
- ❌ Memory leaks present
- ❌ Security vulnerabilities
- ❌ Breaking changes without migration plan












