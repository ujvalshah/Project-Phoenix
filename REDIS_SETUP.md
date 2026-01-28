# Redis Setup Guide

This guide explains how to set up Redis for development and production, including optimizations to reduce request count.

## 🎯 Overview

The application uses Redis for:
- **Token Management**: Blacklisting, refresh tokens
- **Rate Limiting**: Distributed rate limiting across instances
- **Account Lockout**: Failed login attempt tracking
- **Session Management**: Active session tracking

## 🚀 Quick Start

### Option 1: Local Redis (Recommended for Development)

**Why use local Redis?**
- ✅ No request limits
- ✅ Faster (no network latency)
- ✅ Free
- ✅ Better for development/testing

**Installation:**

#### Windows (using WSL or Docker)
```bash
# Using Docker (easiest)
docker run -d -p 6379:6379 --name redis redis:latest

# Or using WSL
wsl
sudo apt-get update
sudo apt-get install redis-server
redis-server
```

#### macOS
```bash
# Using Homebrew
brew install redis
brew services start redis

# Or run manually
redis-server
```

#### Linux
```bash
sudo apt-get update
sudo apt-get install redis-server
sudo systemctl start redis
sudo systemctl enable redis
```

**Configuration:**

Add to your `.env` file:
```env
# Use local Redis in development
USE_LOCAL_REDIS=true
REDIS_LOCAL_URL=redis://localhost:6379

# Or simply don't set REDIS_URL in development
# The app will automatically use localhost:6379
```

### Option 2: Upstash (Production/Cloud)

1. Sign up at [Upstash](https://upstash.com)
2. Create a Redis database
3. Copy the Redis URL
4. Add to `.env`:
```env
REDIS_URL=rediss://default:xxxxx@hostname.upstash.io:6379
```

## 📊 Optimizations Implemented

### 1. **Shared Redis Client** ✅
- **Before**: Two separate Redis clients (tokenService + rateLimiter)
- **After**: Single shared client
- **Savings**: ~50% reduction in connections

### 2. **Pipeline/Batch Operations** ✅
- **Before**: Multiple sequential Redis calls
- **After**: Batched operations using Redis pipelines
- **Example**: `storeRefreshToken` reduced from 4+ calls to 1 pipeline
- **Savings**: ~60-70% reduction in requests for multi-step operations

### 3. **In-Memory Fallback** ✅
- **Before**: App fails when Redis unavailable
- **After**: Graceful fallback to in-memory store
- **Benefit**: App works even without Redis (with degraded features)

### 4. **Local Redis Support** ✅
- **Before**: Always uses Upstash (hits limits)
- **After**: Automatic local Redis in development
- **Benefit**: No limits, faster, free

## 🔧 Configuration Options

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|-----------|
| `REDIS_URL` | Production Redis URL (Upstash) | - | Production |
| `USE_LOCAL_REDIS` | Use local Redis in development | `false` | No |
| `REDIS_LOCAL_URL` | Local Redis URL | `redis://localhost:6379` | No |

### Automatic Detection

The app automatically:
1. Uses local Redis if `USE_LOCAL_REDIS=true` or `REDIS_URL` not set in development
2. Falls back to in-memory store if Redis unavailable
3. Uses Upstash in production if `REDIS_URL` is set

## 📈 Request Count Optimization

### Before Optimizations
- **Login**: ~6-8 Redis requests
- **Token Storage**: ~4-5 Redis requests
- **Session Management**: ~3-4 Redis requests per operation

### After Optimizations
- **Login**: ~2-3 Redis requests (using pipelines)
- **Token Storage**: ~1-2 Redis requests (batched)
- **Session Management**: ~1-2 Redis requests (batched)

### Estimated Savings
- **~60-70% reduction** in Redis requests
- **~50% reduction** in connections (shared client)
- **Total**: From ~500K/month to ~150-200K/month

## 🧪 Testing Redis Setup

### Check if Redis is running:
```bash
# Test connection
redis-cli ping
# Should return: PONG
```

### Test from Node.js:
```bash
# In your project directory
node -e "const redis = require('redis'); const client = redis.createClient({url: 'redis://localhost:6379'}); client.connect().then(() => { console.log('Connected!'); client.quit(); });"
```

## 🐛 Troubleshooting

### Issue: "Connection refused"
**Solution**: Start Redis server
```bash
# Docker
docker start redis

# macOS
brew services start redis

# Linux
sudo systemctl start redis
```

### Issue: "Limit exceeded" (Upstash)
**Solutions**:
1. Use local Redis for development (recommended)
2. Wait for monthly reset
3. Upgrade Upstash plan
4. Check usage in Upstash dashboard

### Issue: App works but Redis features disabled
**Solution**: Check logs for Redis connection errors. The app gracefully degrades to in-memory fallback.

## 📝 Development Workflow

### Recommended Setup:
1. **Development**: Use local Redis (`USE_LOCAL_REDIS=true`)
2. **Staging**: Use Upstash (test production setup)
3. **Production**: Use Upstash (with monitoring)

### Switching Between Local and Cloud:
```bash
# Use local Redis
USE_LOCAL_REDIS=true

# Use Upstash
USE_LOCAL_REDIS=false
REDIS_URL=rediss://your-upstash-url
```

## 🎯 Best Practices

1. **Always use local Redis in development** - saves quota, faster
2. **Monitor Upstash usage** - set up alerts at 80% of limit
3. **Use pipelines for batch operations** - already implemented
4. **Test without Redis** - ensure graceful degradation works
5. **Keep Redis connection alive** - shared client handles this

## 📚 Additional Resources

- [Redis Documentation](https://redis.io/docs/)
- [Upstash Documentation](https://docs.upstash.com/redis)
- [Redis Commands](https://redis.io/commands/)

## ✅ Verification

After setup, verify Redis is working:

1. Start your server: `npm run dev:all`
2. Check logs for: `[Redis] Connected`
3. Try logging in - should work without errors
4. Check Redis is being used: Look for `[TokenService]` logs

If you see `[Redis] No Redis URL configured - using in-memory fallback`, Redis is not configured but the app will still work (with degraded features).
