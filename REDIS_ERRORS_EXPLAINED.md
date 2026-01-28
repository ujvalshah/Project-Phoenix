# Redis Errors Explained & Fixed

## 🔴 Root Causes Identified

### 1. **Upstash Redis Limit Exceeded** (Primary Issue)
- **Error**: `ERR max requests limit exceeded. Limit: 500000, Usage: 500000`
- **Cause**: Your Upstash Redis free tier has hit its monthly limit of 500,000 requests
- **Impact**: All Redis operations fail, app falls back to in-memory storage

### 2. **Double Initialization** (Secondary Issue)
- **Problem**: `initRedisClient()` was being called **twice**:
  - Once in `server/src/index.ts` (line 464)
  - Again in `server/src/services/tokenService.ts` (line 58)
- **Impact**: Multiple connection attempts, wasted requests, error spam

### 3. **Reconnection Loop** (Tertiary Issue)
- **Problem**: When limit exceeded, code kept trying to reconnect
- **Impact**: Each reconnection attempt counts as a request, making the problem worse

### 4. **Local Redis Not Being Used**
- **Problem**: Even though `.env` has `USE_LOCAL_REDIS=true`, it was still connecting to Upstash
- **Cause**: Logic priority issue in `getRedisUrl()` function

---

## ✅ Fixes Applied

### Fix 1: Made `initRedisClient()` Idempotent
- **Before**: Created new connection every time, even if already connected
- **After**: Checks if already initialized before creating new connection
- **File**: `server/src/utils/redisClient.ts`

```typescript
// Now checks if already connected
if (isConnected && redisClient !== null) {
  logger.debug({ msg: '[Redis] Already initialized, skipping' });
  return;
}
```

### Fix 2: Removed Duplicate Initialization
- **Before**: `tokenService.ts` called `initRedisClient()` again
- **After**: Removed duplicate call, relies on initialization in `index.ts`
- **File**: `server/src/services/tokenService.ts`

### Fix 3: Stop Reconnecting When Limit Exceeded
- **Before**: Kept trying to reconnect even after limit error
- **After**: Disables reconnection listeners when limit exceeded
- **File**: `server/src/utils/redisClient.ts`

```typescript
if (isRedisLimitError(err)) {
  isLimitExceeded = true;
  isConnected = false;
  // Disable reconnection when limit exceeded
  if (redisClient) {
    redisClient.removeAllListeners('error');
    redisClient.removeAllListeners('reconnecting');
  }
}
```

### Fix 4: Fixed Local Redis Priority
- **Before**: `USE_LOCAL_REDIS` check happened after other checks
- **After**: `USE_LOCAL_REDIS` is checked **first**, before any other logic
- **File**: `server/src/utils/redisClient.ts`

```typescript
// Priority 1: USE_LOCAL_REDIS takes precedence
if (process.env.USE_LOCAL_REDIS === 'true') {
  return process.env.REDIS_LOCAL_URL || 'redis://localhost:6379';
}
```

---

## 🚀 Next Steps

### Immediate Actions:

1. **Verify Local Redis is Running**
   ```bash
   # Check if Redis is running
   redis-cli ping
   # Should return: PONG
   ```

2. **If Redis is NOT running, start it:**
   ```bash
   # Windows (using Docker - recommended)
   docker run -d -p 6379:6379 --name redis redis:latest
   
   # Or using WSL
   wsl
   sudo apt-get install redis-server
   redis-server
   ```

3. **Verify Environment Variables**
   - Check that `.env` has:
     ```env
     USE_LOCAL_REDIS=true
     REDIS_LOCAL_URL=redis://localhost:6379
     ```
   - Make sure `REDIS_URL` is commented out or removed entirely

4. **Restart Your Server**
   ```bash
   npm run dev:all
   ```

### Expected Behavior After Fix:

- ✅ No more "limit exceeded" errors (using local Redis)
- ✅ Single connection attempt (no double initialization)
- ✅ No reconnection loops (stops immediately on limit error)
- ✅ Logs show: `[Redis] Connected` with `redis://localhost:6379`

---

## 📊 Other Warnings (Non-Critical)

### Mongoose Duplicate Index Warnings
These are **warnings, not errors**. They indicate duplicate index definitions in your schemas:
- `tagIds` index
- `auth.email` index  
- `profile.username` index
- `slug` index
- `id` index
- `cloudinary.publicId` index

**Fix**: Remove duplicate index definitions (either `index: true` in schema OR `schema.index()` call, not both)

### Deprecation Warning
- `util._extend` deprecation is from a dependency, not your code
- Safe to ignore for now

---

## 🎯 Summary

**Main Issue**: Upstash Redis limit exceeded (500K/month)

**Solution**: 
1. ✅ Fixed double initialization
2. ✅ Fixed reconnection loop  
3. ✅ Fixed local Redis priority
4. ⏳ **You need to**: Start local Redis and restart server

**Result**: App will use local Redis (no limits, faster, free) instead of Upstash in development.
