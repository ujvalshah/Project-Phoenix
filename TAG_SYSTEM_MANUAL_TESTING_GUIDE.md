# Tag System Fix - Manual Testing Guide

**Purpose:** Verify the tag case-sensitivity fix works correctly in the browser  
**Time Required:** 5-10 minutes  
**Prerequisites:** 
- Frontend running (`npm run dev`)
- Backend running (`npm run dev:server`)
- User account with some existing nuggets

---

## Test Cases

### Test Case 1: Edit Modal Shows Correct Selection

**Goal:** Verify tags appear selected regardless of casing differences

**Steps:**
1. Open browser to `http://localhost:5173`
2. Log in to your account
3. Find a nugget that has tags (e.g., tags with "AI", "Blockchain")
4. Click the "..." menu → "Edit"
5. Observe the Tags field in the edit modal

**Expected Result:**
- ✅ All tags from the nugget should appear as selected chips above the dropdown
- ✅ All selected tags should have checkmarks (☑) in the dropdown
- ✅ No tags should appear unselected if they're already in the nugget

**Pass Criteria:**
- All existing tags show as selected
- No visual glitches or missing selections

---

### Test Case 2: Tag Deselection Works

**Goal:** Verify clicking "×" removes tags correctly

**Steps:**
1. Open edit modal (from Test Case 1)
2. Click the "×" button on any tag chip
3. Observe the change

**Expected Result:**
- ✅ Tag chip disappears immediately
- ✅ Tag in dropdown changes from ☑ to ☐
- ✅ Can re-add the same tag

**Pass Criteria:**
- Clicking × removes the tag
- No errors in browser console
- UI updates correctly

---

### Test Case 3: Duplicate Prevention (Case-Insensitive)

**Goal:** Verify duplicate tags can't be added with different casing

**Steps:**
1. Open create or edit modal
2. Add tag "AI" (or select existing)
3. Type "ai" (lowercase) in the search box
4. Try to select it from dropdown or press Enter

**Expected Result:**
- ✅ "ai" should show as already selected (☑) in dropdown
- ✅ Pressing Enter should not add a duplicate
- ✅ Only one "AI" chip should exist

**Pass Criteria:**
- Cannot add "ai" when "AI" exists
- No duplicate chips appear

---

### Test Case 4: Tag Search is Case-Insensitive

**Goal:** Verify tag search finds matches regardless of case

**Steps:**
1. Open create or edit modal
2. Click on Tags field to open dropdown
3. Type "ai" (lowercase) in search
4. Observe results

**Expected Result:**
- ✅ Should show "AI", "Ai", or any case variation
- ✅ Should highlight matching tags

**Pass Criteria:**
- Search finds tags regardless of case
- Results are relevant

---

### Test Case 5: Admin Tag Rename + Edit (Advanced)

**Goal:** Verify edit modal works after admin renames a tag

**Prerequisites:** Admin access

**Steps:**
1. Create nugget with tag "AI"
2. Go to Admin Panel → Tags
3. Find "AI" tag and rename it to "Ai"
4. Return to homepage
5. Open edit modal for the nugget from step 1

**Expected Result:**
- ✅ Tag shows as "Ai" (new name)
- ✅ "Ai" appears selected (☑) in dropdown
- ✅ Can deselect and reselect "Ai"

**Pass Criteria:**
- Renamed tag appears correctly
- Edit modal recognizes the tag despite name change

---

### Test Case 6: Create New Tag

**Goal:** Verify creating new tags works normally

**Steps:**
1. Open create nugget modal
2. Click Tags field
3. Type a new tag name (e.g., "TestTag123")
4. Press Enter or click "Create 'TestTag123'"
5. Submit nugget

**Expected Result:**
- ✅ Tag chip appears
- ✅ Tag is added to available tags
- ✅ Nugget saves successfully

**Pass Criteria:**
- New tag creation works
- No errors or glitches

---

## Browser Console Checks

### No Errors

Open browser DevTools (F12) → Console tab

**Expected:**
- ❌ No red errors related to tags
- ❌ No "undefined" or "null" warnings
- ✅ May see info/debug logs (gray/blue) - these are fine

### Check Tag Utilities (Optional)

In browser console, test the utilities:

```javascript
// Import utility (if available in dev mode)
import { normalizeTag, tagsMatch, tagsInclude } from '/src/utils/tagUtils';

// Test normalization
normalizeTag("  AI  ");  // Should return: "ai"

// Test matching
tagsMatch("AI", "ai");   // Should return: true

// Test inclusion
tagsInclude(["AI", "Blockchain"], "ai");  // Should return: true
```

---

## Performance Check

### Page Load Time

**Baseline:** Edit modal should open in < 500ms

**Steps:**
1. Click edit on a nugget
2. Observe time until modal fully renders

**Expected:**
- ✅ Modal opens quickly (< 500ms)
- ✅ No visible lag or freezing
- ✅ Tags render immediately

---

## Regression Checks

Verify no regressions in related features:

### Category Bar (Homepage)

1. Go to homepage
2. Click different category filters
3. Observe filtering works

**Expected:**
- ✅ Categories filter correctly
- ✅ Tag names display properly
- ✅ No visual glitches

### Tag Chips on Cards

1. Scroll through feed
2. Observe tag chips on nugget cards
3. Click tag chips to filter

**Expected:**
- ✅ Tags display correctly on cards
- ✅ Clicking tags filters feed
- ✅ No truncation or overflow issues

### Admin Panel Tags

1. Go to Admin Panel → Tags
2. View tag list
3. Try renaming a tag

**Expected:**
- ✅ Tag list loads
- ✅ Tag rename works
- ✅ No errors

---

## Edge Cases

### Empty Tags

**Steps:**
1. Try to create nugget without tags
2. Observe validation message

**Expected:**
- ✅ Shows error: "Please add at least one tag"
- ✅ Cannot submit without tags

### Special Characters

**Steps:**
1. Create tag with special chars (e.g., "C++", "Node.js")
2. Edit nugget with that tag
3. Verify tag appears selected

**Expected:**
- ✅ Special chars preserved
- ✅ Tag matching works

### Long Tag Names

**Steps:**
1. Create tag with long name (e.g., "Very Long Tag Name With Many Words")
2. Verify display in:
   - Tag chip
   - Dropdown
   - Edit modal

**Expected:**
- ✅ Text truncates gracefully
- ✅ No layout breaks

---

## Sign-Off Checklist

Before marking as "tested":

- [ ] ✅ Test Case 1: Edit modal selection - **PASS**
- [ ] ✅ Test Case 2: Tag deselection - **PASS**
- [ ] ✅ Test Case 3: Duplicate prevention - **PASS**
- [ ] ✅ Test Case 4: Case-insensitive search - **PASS**
- [ ] ✅ Test Case 5: Admin rename + edit - **PASS** (if admin)
- [ ] ✅ Test Case 6: Create new tag - **PASS**
- [ ] ✅ Browser console: No errors
- [ ] ✅ Performance: Modal opens quickly
- [ ] ✅ Regression: Category bar works
- [ ] ✅ Regression: Tag chips work
- [ ] ✅ Edge cases: All pass

---

## Reporting Issues

If you find a bug:

1. **Note the exact steps to reproduce**
2. **Check browser console for errors**
3. **Take a screenshot if visual issue**
4. **Check if issue existed before fix** (rollback to test)

**Report Format:**
```
**Test Case:** [Name]
**Browser:** [Chrome/Firefox/Safari + version]
**Steps:**
1. Step 1
2. Step 2

**Expected:** [What should happen]
**Actual:** [What actually happened]
**Console Errors:** [Yes/No - paste errors]
**Screenshot:** [Attach if relevant]
```

---

## Quick Smoke Test (2 minutes)

If time is limited, run this abbreviated test:

1. ✅ Open edit modal → verify tags appear selected
2. ✅ Click × on a tag → verify it removes
3. ✅ Try to add same tag with different case → verify rejected
4. ✅ Check console → verify no errors

**Pass all 4?** → Fix is working ✅

---

## Automated Test Verification

Before manual testing, verify unit tests pass:

```bash
npx vitest run tagUtils
```

**Expected Output:**
```
✓ 29 tests passed
  Test Files  1 passed (1)
      Tests  29 passed (29)
```

If tests fail, do **NOT** proceed to manual testing.

---

**Status:** Ready for Manual Testing  
**Estimated Time:** 5-10 minutes  
**Next Step:** Run through test cases and update TODO status

---

**Note:** This is a **non-destructive** test. All changes are saved to your test database and can be easily undone. No risk to production data.



