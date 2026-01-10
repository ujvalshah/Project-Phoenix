# CreateNuggetModal Testing & Bug Fixes - Execution Plan

**Date:** 2026-01-06  
**Status:** Ready to Execute  
**Overall Progress:** 75% Complete

---

## Execution Steps

### Step 1: Verify Integration Tests ✅ (Already Complete)
**Status:** ✅ PASSING (4/4 tests)

Integration tests are already passing according to `TEST_EXECUTION_SUMMARY.md`. No action needed.

---

### Step 2: Execute E2E Tests ⏳ (In Progress)

**Prerequisites:**
1. Backend server must be running on `http://localhost:5000`
2. Frontend dev server must be running on `http://localhost:5173`
3. Test user account must exist (or set `TEST_USER_EMAIL` and `TEST_USER_PASSWORD` env vars)

**Commands to Run:**

```bash
# Terminal 1: Start Backend
npm run dev:server

# Terminal 2: Start Frontend  
npm run dev

# Terminal 3: Run E2E Tests
npm run test:e2e

# Or run in headed mode to see browser:
npm run test:e2e:headed

# Or run in UI mode for interactive testing:
npm run test:e2e:ui
```

**Expected Tests:**
- `tests/e2e/image-deletion.spec.ts` (2 tests)
- `tests/e2e/image-duplication.spec.ts` (2 tests)  
- `tests/e2e/masonry-toggle.spec.ts` (1 test)

**Success Criteria:**
- [ ] All 5 tests pass
- [ ] Tests pass 10/10 runs (no flakiness)
- [ ] No console errors in test output

---

### Step 3: Execute Manual Testing ⏳ (Pending)

**File:** `TESTING_CHECKLIST.md`

**Scenarios to Test:**
1. Image Deletion (Edit Mode) - Lines 19-54
2. Image Duplication Detection - Lines 57-86
3. Masonry Toggle Persistence - Lines 89-120
4. Error Handling - Lines 123-150
5. Create Mode Image Upload - Lines 153-180
6. Feature Flag Rollback - Lines 183-210

**Action Required:**
- Open `TESTING_CHECKLIST.md`
- Execute each test scenario
- Check off each checkbox as you complete it
- Document any issues found

**Success Criteria:**
- [ ] All checkboxes in TESTING_CHECKLIST.md are checked
- [ ] All scenarios pass without issues
- [ ] Any issues documented

---

### Step 4: Staging Deployment ⏳ (Pending)

**Prerequisites:**
- E2E tests passing
- Manual testing complete

**Action Required:**
- Deploy to staging environment
- Ensure `USE_IMAGE_MANAGER: true` feature flag is enabled
- Verify deployment successful

**Success Criteria:**
- [ ] Deployed to staging
- [ ] Feature flag enabled
- [ ] Application loads without errors

---

### Step 5: Staging Monitoring ⏳ (Pending)

**Duration:** 1 week

**Action Required:**
- Monitor staging environment daily
- Track any image-related bugs
- Monitor performance metrics (re-render counts)
- Document any issues

**Success Criteria:**
- [ ] 1 week monitoring period complete
- [ ] Zero image-related bugs reported
- [ ] Performance metrics acceptable

---

### Step 6: Phase 9 - Legacy Code Removal ⏳ (Blocked)

**Prerequisites:**
- ✅ All E2E tests pass consistently
- ✅ Manual testing complete
- ✅ 1 week staging validation with no issues

**Code to Remove:**

#### A. Legacy State Variables
- `_legacyExistingImages` (line 111)
- `_legacyMasonryMediaItems` (line 115)
- `_legacyExplicitlyDeletedImages` (line 153)

#### B. Conditional Logic
- Remove all `useNewImageManager ? ... : ...` conditionals
- Remove feature flag checks

#### C. Legacy Initialization Code
- Remove else block in initialization (lines 237-256)

#### D. Legacy deleteImage() Code Path
- Remove legacy deletion code (lines 780-909)
- Keep only imageManager path

#### E. Legacy Masonry Handlers
- Remove legacy paths in `handleMasonryMediaToggle` (lines 1101-1108)
- Remove legacy paths in `handleMasonryTitleChange` (lines 1190-1195)

#### F. Feature Flag References
- Remove `useNewImageManager` constant
- Remove `isFeatureEnabled('USE_IMAGE_MANAGER')` usage

**Estimated Impact:**
- Component size: ~2,365 lines → <500 lines
- Code simplification: Single code path

---

### Step 7: Documentation Updates ⏳ (Pending)

**Files to Update:**
- `CREATENUGGETMODAL_REFACTOR_CHECKPOINT_PHASE1.md` - Mark Phases 6-9 complete
- Remove feature flag documentation
- Update architecture docs

---

## Current Status

| Step | Status | Notes |
|------|--------|-------|
| Step 1: Integration Tests | ✅ Complete | 4/4 tests passing |
| Step 2: E2E Tests | ⏳ In Progress | Requires dev servers |
| Step 3: Manual Testing | ⏳ Pending | Checklist ready |
| Step 4: Staging Deployment | ⏳ Pending | Blocked by Steps 2-3 |
| Step 5: Staging Monitoring | ⏳ Pending | Blocked by Step 4 |
| Step 6: Legacy Code Removal | ⏳ Blocked | Blocked by Steps 2-5 |
| Step 7: Documentation | ⏳ Pending | Blocked by Step 6 |

---

## Next Immediate Actions

1. **Start dev servers** (if not already running)
2. **Run E2E tests** using `npm run test:e2e`
3. **Execute manual testing checklist**
4. **Document results**

---

## Notes

- Integration tests are already passing ✅
- E2E tests are written and ready to execute
- Manual testing checklist is comprehensive
- Legacy code removal is the final step after validation


