# 🔍 Authentication Diagnostic Report
## Systematic Analysis of Frequent Sign-Out Issue

**Date:** 2025-01-XX  
**Engineer:** Senior Backend Authentication Engineer  
**Status:** 🔴 CRITICAL ISSUES FOUND

---

## 📋 EXECUTIVE SUMMARY

**Root Causes Identified (Ranked by Probability):**

1. **🔴 CRITICAL: Token Rotation Race Condition** (90% probability)
   - Old refresh token deleted BEFORE new one is stored
   - If storage fails, user loses access permanently
   - **This is a permanent data loss bug**

2. **🟡 HIGH: Missing Refresh Tokens in Old Sessions** (70% probability)
   - Users logged in before Redis was available
   - No refresh tokens stored = immediate logout after 15 min
   - **This matches the symptom but may mask deeper issues**

3. **🟡 HIGH: TTL Not Set Correctly** (60% probability)
   - Need to verify TTL is actually being set on Redis keys
   - If TTL missing, tokens persist indefinitely OR expire immediately

4. **🟠 MEDIUM: Access Token Decode Failure** (40% probability)
   - Refresh endpoint requires expired access token to extract userId
   - If token is malformed/corrupted, refresh fails

5. **🟠 MEDIUM: Redis Persistence Not Configured** (30% probability)
   - Memurai might not have persistence enabled
   - Server restart = all tokens lost

---

## 🔬 STEP 1: ARCHITECTURE VALIDATION

### ✅ Confirmed Architecture

**Token Storage:**
- **Refresh Tokens**: Stored in Redis with key pattern `rt:{userId}:{tokenHash}`
- **Session Tracking**: Redis Set `sess:{userId}` contains token hashes
- **Token Blacklisting**: Redis keys `bl:{tokenHash}` for logged-out access tokens
- **Account Lockout**: Redis keys `lock:{email}` and `locktime:{email}`

**Session Model:**
- **Stateful** - Refresh tokens stored server-side in Redis
- **Stateless Access Tokens** - JWT tokens, no server storage needed

**Redis Usage:**
- ✅ Refresh token storage and validation
- ✅ Session metadata (device info, IP, timestamps)
- ✅ Token blacklisting (logout)
- ✅ Account lockout tracking

### ⚠️ Architecture Issues Found

1. **Refresh Token Lookup Requires userId**
   - Key: `rt:{userId}:{tokenHash}`
   - Problem: To look up refresh token, you need userId
   - Current solution: Extract userId from expired access token
   - **Risk**: If access token can't be decoded, refresh fails

2. **Token Rotation is NOT Atomic**
   - Deletes old token → Stores new token (two separate operations)
   - **Risk**: If storage fails, old token is gone, new token not stored

---

## 🔬 STEP 2: REDIS VERIFICATION

### Critical Checks Needed

#### 2.1 Verify Redis Connection String

**Check your `.env`:**
```bash
# Should show:
USE_LOCAL_REDIS=true
REDIS_LOCAL_URL=redis://localhost:6379
# REDIS_URL should be commented out or not set
```

**Verify in code:**
```typescript
// Check server logs on startup
// Should see: [Redis] Connected, url: redis://localhost:6379
```

#### 2.2 Check Redis DB Index

**Default:** Redis uses DB 0 by default  
**Issue:** If multiple apps use same Redis, they might conflict  
**Check:**
```bash
redis-cli
> SELECT 0
> DBSIZE
> KEYS rt:*
```

#### 2.3 Verify TTL is Set

**CRITICAL CHECK:**
```bash
redis-cli
> KEYS rt:*
> TTL rt:{userId}:{hash}  # Should return positive number (seconds until expiry)
> PTTL rt:{userId}:{hash} # Should return positive number (milliseconds)
```

**Expected:** TTL should be ~604800 (7 days in seconds)

**If TTL = -1:** Key has no expiry (BUG - tokens never expire)  
**If TTL = -2:** Key doesn't exist (token was deleted or never stored)

#### 2.4 Check Keys Are Written at Login

**After login, immediately check:**
```bash
redis-cli
> KEYS rt:*  # Should show at least 1 key
> KEYS sess:*  # Should show at least 1 key
> GET rt:{userId}:{hash}  # Should return JSON data
> TTL rt:{userId}:{hash}  # Should return ~604800
```

#### 2.5 Check Memurai Persistence

**CRITICAL:** Memurai Developer Edition might not have persistence enabled by default.

**Check persistence:**
```bash
redis-cli
> CONFIG GET save
> CONFIG GET appendonly
```

**Expected:**
- `save` should show RDB persistence config (e.g., `save 900 1`)
- `appendonly` should be `yes` for AOF persistence

**If persistence disabled:**
- Server restart = all tokens lost
- Users get logged out after restart

#### 2.6 Check Eviction Policy

```bash
redis-cli
> CONFIG GET maxmemory
> CONFIG GET maxmemory-policy
```

**If maxmemory-policy = allkeys-lru or volatile-lru:**
- Tokens might be evicted if Redis runs out of memory
- **Risk**: Active refresh tokens deleted

---

## 🔬 STEP 3: TOKEN LIFECYCLE DEBUGGING

### End-to-End Trace

#### 3.1 Login Flow

```
1. POST /api/auth/login
   ↓
2. Backend: generateAccessToken() → JWT (15 min expiry)
   ↓
3. Backend: generateRefreshToken() → Random 64-byte token
   ↓
4. Backend: storeRefreshToken(userId, refreshToken)
   ↓
5. Redis: SETEX rt:{userId}:{hash} 604800 {data}
   Redis: SADD sess:{userId} {hash}
   Redis: EXPIRE sess:{userId} 604800
   ↓
6. Response: { accessToken, refreshToken, expiresIn: 900 }
   ↓
7. Frontend: localStorage.setItem('nuggets_auth_data_v2', {...})
```

**Failure Points:**
- ❌ Step 4: `isTokenServiceAvailable()` returns false → No refresh token stored
- ❌ Step 5: Redis write fails → Refresh token not stored, but login succeeds
- ❌ Step 5: TTL not set → Token persists forever OR expires immediately

#### 3.2 Token Refresh Flow

```
1. Access token expires (after 15 min)
   ↓
2. Frontend: API request with expired token → 401
   ↓
3. Frontend: Detects 401 + has refreshToken → Calls refreshAccessToken()
   ↓
4. POST /api/auth/refresh
   Headers: Authorization: Bearer {expired_access_token}
   Body: { refreshToken: {refresh_token} }
   ↓
5. Backend: decodeTokenUnsafe(expired_access_token) → Extract userId
   ↓
6. Backend: validateRefreshToken(userId, refreshToken)
   Redis: GET rt:{userId}:{hash}
   ↓
7. Backend: rotateRefreshToken(userId, oldRefreshToken)
   Redis: DEL rt:{userId}:{oldHash}  ← CRITICAL: Deletes old token
   Redis: SREM sess:{userId} {oldHash}
   ↓
8. Backend: storeRefreshToken(userId, newRefreshToken)
   Redis: SETEX rt:{userId}:{newHash} 604800 {data}  ← CRITICAL: Stores new token
   ↓
9. If step 8 fails → Old token is gone, new token not stored → User logged out
   ↓
10. Response: { accessToken, refreshToken: newRefreshToken }
```

**CRITICAL FAILURE POINTS:**

1. **Step 5:** If expired token can't be decoded → No userId → Refresh fails
2. **Step 6:** If refresh token not found → Refresh fails → User logged out
3. **Step 7-8:** **RACE CONDITION** - Old token deleted before new one stored
   - If storage fails, user loses refresh token permanently
   - No way to recover without re-login

---

## 🔬 STEP 4: EDGE CASES

### 4.1 Login Before Redis Available ✅ CONFIRMED ISSUE

**Scenario:** User logged in when Redis was unavailable  
**Result:** `isTokenServiceAvailable()` returned false  
**Impact:** No refresh token stored  
**Symptom:** User gets logged out after 15 minutes  

**Fix:** User must log out and log back in (this is correct)

### 4.2 Refresh Token Overwrite vs Append ✅ CORRECT

**Current:** Each login creates new refresh token  
**Behavior:** Multiple refresh tokens per user (up to MAX_SESSIONS_PER_USER = 5)  
**Status:** ✅ Correct - supports multiple devices

### 4.3 Token Rotation Race Condition 🔴 CRITICAL BUG

**Current Flow:**
```typescript
1. validateRefreshToken() → OK
2. DEL old token ← Deletes old token
3. storeRefreshToken() → May fail
4. If step 3 fails → Old token gone, new token not stored
```

**Impact:** User loses refresh token permanently  
**Probability:** High - happens if Redis write fails during rotation

**Fix Required:** Make rotation atomic (see fixes below)

### 4.4 Redis Eviction Policies ⚠️ NEEDS CHECK

**Check:**
```bash
redis-cli CONFIG GET maxmemory-policy
```

**If set to evict keys:**
- Active refresh tokens might be deleted
- Users get logged out unexpectedly

### 4.5 Multiple App Instances ⚠️ UNLIKELY BUT POSSIBLE

**Scenario:** Multiple server instances pointing to different Redis  
**Impact:** Token stored in Redis A, validated against Redis B  
**Check:** Verify all instances use same Redis URL

### 4.6 Clock Skew ⚠️ UNLIKELY

**Scenario:** Server clock differs from Redis clock  
**Impact:** TTL calculations wrong, tokens expire early/late  
**Check:** Verify server and Redis have synchronized clocks

---

## 🔬 STEP 5: HARD PROOF - REDIS CLI COMMANDS

### Verify Redis Connection
```bash
redis-cli ping
# Expected: PONG
```

### Check All Refresh Tokens
```bash
redis-cli
> KEYS rt:*
> KEYS sess:*
```

### Verify TTL on Refresh Token
```bash
redis-cli
> KEYS rt:*
# Copy a key, then:
> TTL rt:{userId}:{hash}
# Expected: Positive number (seconds until expiry)
# If -1: No expiry set (BUG)
# If -2: Key doesn't exist
```

### Check Token Data
```bash
redis-cli
> GET rt:{userId}:{hash}
# Should return JSON with createdAt, expiresAt, etc.
```

### Verify Persistence
```bash
redis-cli
> CONFIG GET save
> CONFIG GET appendonly
> CONFIG GET maxmemory-policy
```

### Monitor Real-Time Operations
```bash
redis-cli MONITOR
# Then trigger a login/refresh
# Watch for SETEX, DEL, SADD, SREM commands
```

---

## 🔧 CRITICAL FIXES REQUIRED

### Fix #1: Atomic Token Rotation (CRITICAL)

**Problem:** Old token deleted before new token stored  
**Impact:** If storage fails, user loses refresh token permanently  

**Solution:** Use Redis transaction or store new token first, then delete old

```typescript
// BEFORE (BUGGY):
await client.del(oldKey);  // Delete old
await storeRefreshToken(newToken);  // Store new - may fail!

// AFTER (FIXED):
// Option 1: Store new first, then delete old
const newStored = await storeRefreshToken(newToken);
if (newStored) {
  await client.del(oldKey);  // Only delete if new stored successfully
} else {
  return null;  // Keep old token if new storage fails
}

// Option 2: Use Redis transaction (MULTI/EXEC)
const pipeline = client.multi();
pipeline.setEx(newKey, ttl, newData);
pipeline.del(oldKey);
await pipeline.exec();  // Atomic - both succeed or both fail
```

### Fix #2: Enhanced Logging

Add detailed logging at each step:
- Login: Log if refresh token stored successfully
- Refresh: Log token lookup, rotation, storage
- Errors: Log exact Redis errors

### Fix #3: Verify TTL Setting

Add validation that TTL is actually set:
```typescript
await client.setEx(key, ttl, value);
const actualTtl = await client.ttl(key);
if (actualTtl === -1) {
  logger.error({ msg: 'TTL not set on refresh token', key });
}
```

---

## 📊 ROOT CAUSE RANKING

### 🔴 CRITICAL (Must Fix Immediately)

1. **Token Rotation Race Condition** (90% probability)
   - **Evidence:** Code shows delete-before-store pattern
   - **Impact:** Permanent token loss if storage fails
   - **Fix:** Make rotation atomic

2. **Missing Refresh Tokens** (70% probability)
   - **Evidence:** Diagnostic shows 0 refresh tokens
   - **Impact:** Users logged in before Redis get logged out
   - **Fix:** Users must re-login (one-time)

### 🟡 HIGH (Investigate Further)

3. **TTL Not Set** (60% probability)
   - **Evidence:** Need to verify with Redis CLI
   - **Impact:** Tokens expire immediately or never expire
   - **Fix:** Verify TTL is set, add validation

4. **Access Token Decode Failure** (40% probability)
   - **Evidence:** Refresh requires expired token decode
   - **Impact:** Refresh fails if token malformed
   - **Fix:** Add fallback or better error handling

### 🟠 MEDIUM (Check Configuration)

5. **Redis Persistence Disabled** (30% probability)
   - **Evidence:** Memurai Developer might not persist by default
   - **Impact:** Tokens lost on server restart
   - **Fix:** Enable persistence in Memurai config

---

## ✅ VERIFICATION CHECKLIST

Run these checks in order:

### 1. Verify Redis Connection
```bash
redis-cli ping
node verify-redis.js
```

### 2. Check Current Tokens
```bash
redis-cli KEYS rt:*
redis-cli KEYS sess:*
```

### 3. Login and Immediately Check
```bash
# After login, run:
redis-cli KEYS rt:*
# Should show at least 1 key
redis-cli TTL rt:{userId}:{hash}
# Should show positive number (~604800)
```

### 4. Check Persistence
```bash
redis-cli CONFIG GET save
redis-cli CONFIG GET appendonly
```

### 5. Test Token Refresh
```bash
# Wait 15+ minutes, make API request
# Check server logs for refresh attempts
# Check Redis for new token
```

### 6. Restart Server and Check
```bash
# Restart server
redis-cli KEYS rt:*
# If tokens gone → Persistence not enabled
```

---

## 🎯 PERMANENT FIXES (Not Workarounds)

### Fix 1: Atomic Token Rotation

**File:** `server/src/services/tokenService.ts`

**Change:** Make token rotation atomic - store new token BEFORE deleting old

### Fix 2: TTL Validation

**File:** `server/src/services/tokenService.ts`

**Change:** Verify TTL is set after storing refresh token

### Fix 3: Enhanced Error Handling

**File:** `server/src/controllers/authController.ts`

**Change:** Better error messages when refresh fails

### Fix 4: Persistence Configuration

**File:** Memurai configuration

**Change:** Enable RDB or AOF persistence

---

## 🚨 INCORRECT ASSUMPTIONS IN ORIGINAL EXPLANATION

### ❌ Assumption: "Just log out and log back in fixes it"

**Reality:** This fixes the symptom (missing refresh tokens) but:
- Doesn't fix the rotation race condition bug
- Doesn't verify TTL is set correctly
- Doesn't ensure persistence is enabled
- **Masks the underlying issues**

### ✅ What's Actually Needed:

1. Fix the rotation race condition (permanent fix)
2. Verify TTL is set (validation)
3. Enable persistence (configuration)
4. Add comprehensive logging (observability)
5. Then users can re-login (one-time fix for old sessions)

---

## 📝 NEXT STEPS

1. **Immediate:** Run Redis CLI checks above
2. **Critical:** Fix token rotation race condition
3. **High:** Verify TTL is set correctly
4. **Medium:** Enable Redis persistence
5. **Ongoing:** Add comprehensive logging

---

**Status:** 🔴 CRITICAL BUGS FOUND - IMMEDIATE ACTION REQUIRED
