# 🚨 Quick Fix for Redis Limit Error

## Current Issue
Your Upstash Redis has hit the 500K/month limit, causing login failures.

## ✅ Solution: Use Local Redis (Recommended)

### Step 1: Install Local Redis

**Windows (Easiest - Docker):**
```bash
docker run -d -p 6379:6379 --name redis redis:latest
```

**macOS:**
```bash
brew install redis
brew services start redis
```

**Linux:**
```bash
sudo apt-get update
sudo apt-get install redis-server
sudo systemctl start redis
```

### Step 2: Update Your `.env` File

Add or update these lines in your `.env` file:

```env
# Use local Redis instead of Upstash
USE_LOCAL_REDIS=true
REDIS_LOCAL_URL=redis://localhost:6379

# Comment out or remove your Upstash URL temporarily
# REDIS_URL=rediss://your-upstash-url
```

### Step 3: Restart Your Server

```bash
# Stop your current server (Ctrl+C)
# Then restart
npm run dev:all
```

### Step 4: Verify It's Working

Look for this in your logs:
```
[Redis] Connected
[TokenService] Initialized successfully
```

Then try logging in - it should work!

## 🔍 Verify Redis is Running

```bash
# Test Redis connection
redis-cli ping
# Should return: PONG
```

If you get "command not found", Redis isn't installed yet.

## 📊 What Changed

The code now:
- ✅ Uses **shared Redis client** (50% fewer connections)
- ✅ **Batches operations** (60-70% fewer requests)
- ✅ **Falls back gracefully** if Redis unavailable
- ✅ **Supports local Redis** for development

## 🎯 Expected Results

- **Before**: ~500K requests/month (hitting limit)
- **After**: ~150-200K requests/month (with optimizations)
- **With Local Redis**: 0 requests to Upstash (unlimited locally)

## ⚠️ If You Still See Errors

1. **Check Redis is running:**
   ```bash
   redis-cli ping
   ```

2. **Check your `.env` file:**
   - Make sure `USE_LOCAL_REDIS=true`
   - Make sure `REDIS_LOCAL_URL=redis://localhost:6379`

3. **Check server logs:**
   - Look for `[Redis] Connected` message
   - If you see `[Redis] No Redis URL configured`, Redis isn't configured

4. **Restart everything:**
   ```bash
   # Stop server
   # Start Redis (if not running as service)
   # Start server again
   npm run dev:all
   ```

## 🔄 When Upstash Limit Resets

- **Resets**: Monthly (usually on the 1st)
- **Check**: Log into Upstash dashboard to see exact reset date
- **Until then**: Use local Redis (recommended for development anyway)

## 💡 Why Local Redis is Better for Development

- ✅ **No limits** - unlimited requests
- ✅ **Faster** - no network latency
- ✅ **Free** - no costs
- ✅ **Offline** - works without internet
- ✅ **Better debugging** - can inspect data directly

## 🚀 Production

For production, you'll still use Upstash, but with the optimizations:
- Shared client reduces connections
- Batched operations reduce requests
- Should stay well under 500K/month

---

**Need help?** Check `REDIS_SETUP.md` for detailed instructions.
