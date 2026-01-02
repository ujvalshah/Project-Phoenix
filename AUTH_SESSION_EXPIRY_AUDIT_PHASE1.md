# Auth Session Expiry Audit - Phase 1 Observations

**Date:** 2024  
**Status:** ✅ PHASE 1 COMPLETE - Root Cause Identified

---

## PHASE 1 — OBSERVATIONS (NO CHANGES)

### 1. Auth Flow Trace

#### Token Issuance
- **File:** `server/src/controllers/authController.ts` (Line 71)
- **Expiry:** `expiresIn: '7d'` (7 days)
- **Payload:** `{ userId: string }`
- **Generated on:** Login and Signup

#### Token Storage
- **Location:** `localStorage`
- **Key:** `'nuggets_auth_data_v2'`
- **Format:** `{ user: ModularUser, token: string }`
- **No cookie storage**

#### Token Usage
- **File:** `src/services/apiClient.ts` (Lines 27-42)
- **Method:** Reads from localStorage, attaches as `Authorization: Bearer ${token}`
- **Applied to:** All API requests (no distinction between public/protected)

#### Token Validation (Backend)
- **File:** `server/src/middleware/authenticateToken.ts`
- **Method:** `jwt.verify(token, JWT_SECRET)`
- **On Expiry:** Returns 401 with `{ message: 'Token expired' }`
- **On Invalid:** Returns 401 with `{ message: 'Invalid token' }`
- **On Missing:** Returns 401 with `{ message: 'Access token required' }`

#### Logout Trigger
- **File:** `src/services/apiClient.ts` (Lines 106-118)
- **Condition:** ANY 401 response triggers logout
- **Actions:**
  1. Clears localStorage (`AUTH_STORAGE_KEY`)
  2. Redirects to `/login` (`window.location.href = '/login'`)
  3. Throws error: `'Your session has expired. Please sign in again.'`

---

### 2. "Session Expired" Message Generation

**Location:** `src/services/apiClient.ts` (Line 118)

```typescript
if (response.status === 401) {
  // Clear auth data
  localStorage.removeItem(AUTH_STORAGE_KEY);
  // Redirect to login
  window.location.href = '/login';
  throw new Error('Your session has expired. Please sign in again.');
}
```

**Trigger:** ANY 401 response, regardless of:
- Endpoint (public vs protected)
- Reason (expired token vs invalid credentials vs missing token)
- Context (login attempt vs authenticated request)

---

### 3. Logout Trigger Conditions

The logout is triggered on **ANY** 401 response, including:

**A. Expired Token** ✅ (Should logout)
- Protected endpoint with expired JWT
- Backend returns: `{ message: 'Token expired' }`

**B. Invalid Credentials** ❌ (Should NOT logout)
- `/api/auth/login` with wrong password
- `/api/auth/signup` with existing email
- Backend returns: `{ message: 'Invalid email or password' }` or `{ message: 'Email already registered' }`

**C. Missing Token** ❌ (Should NOT logout for public endpoints)
- Public endpoint called without token (should be allowed)
- Protected endpoint called without token (should show error, not logout)

**D. Invalid Token Format** ✅ (Should logout)
- Malformed JWT
- Backend returns: `{ message: 'Invalid token' }`

---

### 4. Public vs Protected Endpoints

#### Public Endpoints (NO authentication required)
- `POST /api/auth/login` - Returns 401 for invalid credentials
- `POST /api/auth/signup` - Returns 401 for invalid credentials
- `GET /api/articles` - Public read access
- `GET /api/articles/:id` - Public read access
- `GET /api/collections` - Public read access
- `GET /api/collections/:id` - Public read access
- `GET /api/users` - Public read access
- `GET /api/users/:id` - Public read access
- `GET /api/categories` - Public read access
- `GET /api/legal/*` - Public read access
- `POST /api/moderation/reports` - Public submission
- `POST /api/feedback` - Public submission
- `POST /api/unfurl` - Public service
- `POST /api/ai/summarize` - Public service
- `POST /api/ai/takeaways` - Public service

#### Protected Endpoints (Authentication required)
- All others using `authenticateToken` middleware

---

### 5. JWT Expiry Details

**Token Expiry:** 7 days (`expiresIn: '7d'`)

**No Token Refresh:** No refresh token mechanism exists

**No Expiry Check:** Frontend does not check token expiry before making requests

**No Graceful Handling:** No prompt for re-login before expiry

---

## CRITICAL ISSUE IDENTIFIED

### Root Cause: Overly Aggressive 401 Handler

**Problem:** The `apiClient.ts` logs out on **ANY** 401 response, including:
1. Invalid credentials during login/signup (should NOT logout)
2. Public endpoints that may return 401 (should NOT logout)
3. Expired tokens on protected endpoints (SHOULD logout)

**Impact:**
- Users get logged out when entering wrong password during login
- Users get logged out when signup fails (email already exists)
- Users get logged out on any transient 401 error
- No distinction between "session expired" and "invalid credentials"

**Current Behavior:**
```
Any 401 → Clear localStorage → Redirect to /login → Show "Session expired"
```

**Expected Behavior:**
```
401 on /auth/login or /auth/signup → Show error, DON'T logout
401 on protected endpoint with expired token → Logout, show "Session expired"
401 on protected endpoint with invalid token → Logout, show "Session expired"
401 on public endpoint → Show error, DON'T logout (unless truly expired)
```

---

## Phase 1 Complete - Ready for Phase 2

**Next Steps:**
1. Fix 401 handler to distinguish between public/protected endpoints
2. Only logout on authenticated 401s (expired/invalid tokens)
3. Never logout on public endpoint 401s (invalid credentials)
4. Add proper error messages for different 401 scenarios












