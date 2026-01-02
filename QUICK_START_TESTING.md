# Quick Start Testing Guide

**For:** Immediate validation of integration  
**Time:** 15-20 minutes  
**Priority:** HIGH

---

## STEP 1: Start Services (2 minutes)

### Backend
```bash
cd server
npm run dev
```
**Verify:** See "✓ Connected to MongoDB" and "Server running on port 5000"

### Frontend
```bash
npm run dev
```
**Verify:** Browser opens to http://localhost:5173 (or similar)

---

## STEP 2: Quick Smoke Test (5 minutes)

### 2.1 Login
- [ ] Go to home page
- [ ] Click login/signup
- [ ] Login with existing user OR create new account
- [ ] **Check:** No console errors, user data loads

### 2.2 Main App
- [ ] Verify articles load on home page
- [ ] Click on an article - verify details load
- [ ] Go to collections page - verify collections load
- [ ] **Check:** All data comes from backend (not static)

### 2.3 Admin Panel (Critical Test)
- [ ] Navigate to `/admin` or `/admin/dashboard`
- [ ] **CRITICAL:** Check browser console for errors
- [ ] **CRITICAL:** Check Network tab - verify API calls to `/api/*`
- [ ] Verify dashboard metrics load (may take 2-3 seconds)
- [ ] **Check:** Data is real (not mock data)

---

## STEP 3: Admin Panel Deep Test (10 minutes)

### Test Each Admin Page

#### Admin Users
- [ ] Go to `/admin/users`
- [ ] **Verify:** Users list loads from backend
- [ ] **Check Console:** No errors
- [ ] **Check Network:** Calls to `/api/users`
- [ ] Try search - verify it works
- [ ] Try to delete a user (if you have permission)

#### Admin Nuggets
- [ ] Go to `/admin/nuggets`
- [ ] **Verify:** Nuggets load (may be slow - 2 API calls)
- [ ] **Check Console:** No errors
- [ ] **Check Network:** Calls to `/api/articles` and `/api/moderation/reports`
- [ ] Try filter - verify it works

#### Admin Moderation
- [ ] Go to `/admin/moderation`
- [ ] **Verify:** Reports load (if any exist)
- [ ] **Check Console:** No 401 errors (if logged in as admin)
- [ ] **Check Network:** Calls to `/api/moderation/reports`

#### Admin Feedback
- [ ] Go to `/admin/feedback`
- [ ] **Verify:** Feedback loads (if any exists)
- [ ] **Check Console:** No errors
- [ ] **Check Network:** Calls to `/api/feedback`

---

## STEP 4: Error Scenarios (3 minutes)

### Test Error Handling
- [ ] **Stop backend server**
- [ ] Try to load admin dashboard
- [ ] **Verify:** Error message shows (not blank page)
- [ ] **Verify:** App doesn't crash
- [ ] **Restart backend**
- [ ] **Verify:** App recovers and works again

### Test Auth
- [ ] **Clear localStorage** (remove token)
- [ ] Try to access `/admin/users`
- [ ] **Verify:** Redirects to login OR shows error
- [ ] **Verify:** No crash

---

## CRITICAL CHECKS

### ✅ Must See (Success Indicators)
- [ ] Admin dashboard shows real numbers (not all zeros if data exists)
- [ ] Browser console has NO red errors
- [ ] Network tab shows API calls to `/api/*` (not localhost:5000 directly)
- [ ] All admin pages load data (not empty/mock)
- [ ] Auth token is in localStorage after login

### ❌ Must NOT See (Failure Indicators)
- [ ] Console errors about "Cannot read property"
- [ ] Console errors about "MOCK_" or "mockData"
- [ ] Network errors (401, 500) without handling
- [ ] Blank pages or crashes
- [ ] Mock data in admin panels

---

## IF TESTS FAIL

### Common Issues & Quick Fixes

#### Issue: "Cannot read property 'profile' of undefined"
**Fix:** User data shape mismatch - check `mapUserToAdminUser` mapper

#### Issue: "401 Unauthorized" on admin pages
**Fix:** Token not being sent - check `apiClient.getAuthHeader()`

#### Issue: Admin pages show empty/zero data
**Fix:** Backend may not have data - seed database or check API responses

#### Issue: Slow page loads
**Fix:** Expected for admin nuggets (2 API calls) - consider optimization later

#### Issue: "updateUserStatus not supported"
**Fix:** Expected - backend doesn't support this feature yet

---

## SUCCESS CRITERIA

### ✅ Integration is WORKING if:
- Admin dashboard loads with real data
- All admin pages load from backend
- No console errors
- Auth tokens work
- Error handling is graceful

### ⚠️ Integration has ISSUES if:
- Admin pages show mock data
- Console has red errors
- Pages crash or show blank screens
- API calls fail with unhandled errors

---

## NEXT STEPS AFTER TESTING

### If Tests Pass ✅
1. Mark integration as **COMPLETE**
2. Document any performance issues for future optimization
3. Note limitations (status updates, etc.) for backend enhancement

### If Tests Fail ❌
1. Document specific failures
2. Fix critical issues immediately
3. Re-test after fixes
4. Update integration summary

---

**Ready to Test:** ✅ YES  
**Start Here:** Run backend and frontend, then follow Step 2

---

*End of Quick Start Testing Guide*











