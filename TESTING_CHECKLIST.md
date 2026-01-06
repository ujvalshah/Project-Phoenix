# CreateNuggetModal Image Operations - Manual Testing Checklist

**Date:** 2026-01-06  
**Purpose:** Comprehensive manual testing for image deletion, duplication, and masonry toggle features  
**Feature Flag:** `USE_IMAGE_MANAGER: true`

---

## Prerequisites

- [ ] Backend server running (`npm run dev:server`)
- [ ] Frontend dev server running (`npm run dev`)
- [ ] Test user account created and logged in
- [ ] Browser console open (F12) to monitor errors
- [ ] Network tab open to monitor API calls

---

## Test Scenario 1: Image Deletion (Edit Mode)

### Setup
- [ ] Create a nugget/article with at least one image
- [ ] Note the image URL for verification

### Test Steps
1. [ ] Navigate to the article detail page
2. [ ] Click "Edit" button to open edit modal
3. [ ] **Verify:** Image is visible in the "Existing Images" section
4. [ ] Click the delete button (X) on the image
5. [ ] **Verify:** Confirmation dialog appears
6. [ ] Click "OK" to confirm deletion
7. [ ] **Verify:** Image disappears from UI immediately (optimistic update)
8. [ ] **Verify:** No console errors
9. [ ] **Verify:** API call to `/api/articles/:id/images` with DELETE method in Network tab
10. [ ] Click "Save" button
11. [ ] **Verify:** Success message appears
12. [ ] Close the modal
13. [ ] **CRITICAL:** Refresh the browser page (F5)
14. [ ] Open edit modal again
15. [ ] **CRITICAL:** Verify image is STILL gone (not re-appeared)
16. [ ] **Verify:** Image count in UI matches backend state

### Backend Verification
- [ ] Check MongoDB: Article should not have image in `images[]` array
- [ ] Check MongoDB: Article should not have image in `primaryMedia.url`
- [ ] Check MongoDB: Article should not have image in `supportingMedia[]`
- [ ] Check MongoDB: Article should not have image in `media.url`

### Success Criteria
- ✅ Image deleted successfully
- ✅ Image stays deleted after refresh
- ✅ No image reappearance
- ✅ Backend state matches UI state

---

## Test Scenario 2: Image Duplication Detection

### Setup
- [ ] Create article in MongoDB with duplicate image:
  ```javascript
  {
    images: ['https://picsum.photos/400/300'],
    primaryMedia: { type: 'image', url: 'https://picsum.photos/400/300' },
    supportingMedia: [{ type: 'image', url: 'https://picsum.photos/400/300' }]
  }
  ```

### Test Steps
1. [ ] Navigate to the article
2. [ ] Open edit modal
3. [ ] **Verify:** Image appears only ONCE in "Existing Images" section
4. [ ] **Verify:** Image appears only ONCE in masonry toggle section (if applicable)
5. [ ] **Verify:** Total image count in UI = 1 (not 2, not 3)
6. [ ] Count images manually in the UI
7. [ ] **Verify:** Count matches expected (1)

### Edge Cases
- [ ] Test with same image URL but different query params: `?v=1` vs `?v=2`
- [ ] **Verify:** Still shows only once (URL normalization working)

### Success Criteria
- ✅ No duplicate images in UI
- ✅ Deduplication works correctly
- ✅ URL normalization handles query params

---

## Test Scenario 3: Masonry Toggle Persistence

### Setup
- [ ] Create nugget with at least one image

### Test Steps
1. [ ] Open edit modal
2. [ ] **Verify:** Image is visible
3. [ ] Scroll to "Masonry Media Toggle" section
4. [ ] **Verify:** Section is visible (may need to expand)
5. [ ] Find the image in the masonry toggle list
6. [ ] **Verify:** Toggle checkbox is visible
7. [ ] Click toggle to turn ON (if not already on)
8. [ ] **Verify:** Checkbox is checked
9. [ ] Enter masonry title: "Test Masonry Title"
10. [ ] **Verify:** Title input accepts the value
11. [ ] Click "Save" button
12. [ ] **Verify:** Success message appears
13. [ ] Close modal
14. [ ] **CRITICAL:** Refresh the browser page (F5)
15. [ ] Open edit modal again
16. [ ] Navigate to masonry toggle section
17. [ ] **CRITICAL:** Verify toggle is STILL checked
18. [ ] **CRITICAL:** Verify title is STILL "Test Masonry Title"

### Backend Verification
- [ ] Check MongoDB: `supportingMedia[].showInMasonry` should be `true`
- [ ] Check MongoDB: `supportingMedia[].masonryTitle` should be "Test Masonry Title"

### Success Criteria
- ✅ Toggle state persists after save
- ✅ Title persists after save
- ✅ State persists after page refresh
- ✅ Backend state matches UI state

---

## Test Scenario 4: Error Handling

### Network Failure Test
1. [ ] Open browser DevTools → Network tab
2. [ ] Set throttling to "Offline" or block `/api/articles/:id/images`
3. [ ] Open edit modal with an image
4. [ ] Try to delete the image
5. [ ] **Verify:** Error message is shown to user
6. [ ] **Verify:** Image is STILL visible (rollback worked)
7. [ ] **Verify:** No console errors (graceful error handling)
8. [ ] Re-enable network
9. [ ] Try to delete again
10. [ ] **Verify:** Deletion works correctly

### API Error Test
1. [ ] Stop backend server
2. [ ] Try to delete image
3. [ ] **Verify:** Error message shown
4. [ ] **Verify:** Image still visible (rollback)
5. [ ] Start server again
6. [ ] Try again
7. [ ] **Verify:** Works correctly

### Success Criteria
- ✅ Errors are handled gracefully
- ✅ User sees error message
- ✅ Rollback works on error
- ✅ No crashes or console errors

---

## Test Scenario 5: Create Mode Image Upload

### Test Steps
1. [ ] Open create modal (new nugget)
2. [ ] Add image via URL input: `https://picsum.photos/400/300`
3. [ ] **Verify:** Image appears in UI
4. [ ] Add another image URL
5. [ ] **Verify:** Both images appear
6. [ ] **Verify:** No duplicates
7. [ ] Toggle masonry for one image
8. [ ] Add masonry title
9. [ ] Fill in title and content
10. [ ] Click "Save"
11. [ ] **Verify:** Article created successfully
12. [ ] **Verify:** Images are saved correctly
13. [ ] Open edit modal for the new article
14. [ ] **Verify:** All images are present
15. [ ] **Verify:** Masonry toggle state is preserved

### Success Criteria
- ✅ Images can be added in create mode
- ✅ No duplicates
- ✅ Masonry toggle works in create mode
- ✅ Images persist after save

---

## Test Scenario 6: Feature Flag Rollback

### Test Steps
1. [ ] Open `src/constants/featureFlags.ts`
2. [ ] Set `USE_IMAGE_MANAGER: false`
3. [ ] Save file (hot reload should apply)
4. [ ] Open edit modal with an image
5. [ ] **Verify:** Legacy code path is used (check console logs)
6. [ ] Try to delete image
7. [ ] **Verify:** Deletion works (legacy path)
8. [ ] Set `USE_IMAGE_MANAGER: true` again
9. [ ] **Verify:** New code path is used

### Success Criteria
- ✅ Feature flag rollback works
- ✅ Legacy code path still functional
- ✅ No breaking changes

---

## Test Scenario 7: Performance & Re-renders

### Test Steps
1. [ ] Open React DevTools → Profiler
2. [ ] Start recording
3. [ ] Open edit modal with 5+ images
4. [ ] Delete one image
5. [ ] Stop recording
6. [ ] **Verify:** Re-render count is reasonable (< 5 re-renders)
7. [ ] **Verify:** No unnecessary re-renders of sibling components

### Success Criteria
- ✅ Performance is acceptable
- ✅ No excessive re-renders
- ✅ UI remains responsive

---

## Test Scenario 8: Browser Compatibility

### Test in Multiple Browsers
- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari (if on Mac)

### For Each Browser
1. [ ] Test image deletion
2. [ ] Test image duplication
3. [ ] Test masonry toggle
4. [ ] **Verify:** All features work correctly
5. [ ] **Verify:** No browser-specific errors

### Success Criteria
- ✅ Works in all major browsers
- ✅ No browser-specific bugs

---

## Test Scenario 9: Edge Cases

### Empty State
- [ ] Create article with no images
- [ ] Open edit modal
- [ ] **Verify:** "No images" message or empty state shown
- [ ] **Verify:** No errors

### Single Image
- [ ] Create article with exactly one image
- [ ] Delete the image
- [ ] **Verify:** Empty state shown correctly
- [ ] **Verify:** No errors

### Very Long Image URLs
- [ ] Add image with very long URL (500+ characters)
- [ ] **Verify:** UI handles it gracefully
- [ ] **Verify:** No layout breaks

### Special Characters in URLs
- [ ] Add image URL with special characters
- [ ] **Verify:** URL is handled correctly
- [ ] **Verify:** Image loads

### Success Criteria
- ✅ Edge cases handled gracefully
- ✅ No crashes
- ✅ User-friendly error messages

---

## Summary Checklist

After completing all scenarios, verify:

- [ ] All test scenarios completed
- [ ] All success criteria met
- [ ] No console errors
- [ ] No network errors (except intentional ones)
- [ ] Backend state matches UI state
- [ ] Performance is acceptable
- [ ] Works in all tested browsers
- [ ] Edge cases handled

---

## Issues Found

Document any issues found during testing:

1. **Issue:** [Description]
   - **Steps to reproduce:** [Steps]
   - **Expected:** [Expected behavior]
   - **Actual:** [Actual behavior]
   - **Severity:** [Critical/High/Medium/Low]

---

## Sign-off

- [ ] **Tester Name:** ________________
- [ ] **Date:** ________________
- [ ] **Status:** ✅ Pass / ❌ Fail / ⚠️ Pass with Issues
- [ ] **Notes:** [Any additional notes]

---

**End of Testing Checklist**

