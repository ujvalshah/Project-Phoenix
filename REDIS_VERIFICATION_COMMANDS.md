# Redis Verification Commands

## 🔍 Quick Verification

### 1. Check Redis is Running
```bash
redis-cli ping
# Expected: PONG
```

### 2. Check All Refresh Tokens
```bash
redis-cli KEYS rt:*
redis-cli KEYS sess:*
```

### 3. Verify TTL on a Token
```bash
# Get a key first
redis-cli KEYS rt:*

# Check TTL (replace with actual key)
redis-cli TTL rt:{userId}:{hash}
# Expected: Positive number (~604800 = 7 days)
# -1 = No expiry (BUG)
# -2 = Key doesn't exist
```

### 4. Check Token Data
```bash
redis-cli GET rt:{userId}:{hash}
# Should return JSON with createdAt, expiresAt, etc.
```

### 5. Check Persistence
```bash
redis-cli CONFIG GET save
redis-cli CONFIG GET appendonly
redis-cli CONFIG GET maxmemory-policy
```

### 6. Monitor Real-Time Operations
```bash
redis-cli MONITOR
# Then trigger login/refresh in your app
# Watch for SETEX, DEL, SADD, SREM commands
```

## 🔬 Comprehensive Verification Script

Run the automated verification:
```bash
node verify-token-storage.js
```

This will check:
- ✅ Redis connection
- ✅ Token count
- ✅ TTL on each token
- ✅ Token data structure
- ✅ Persistence configuration
- ✅ Eviction policies

## 📊 After Login - Immediate Check

After logging in, immediately run:
```bash
redis-cli
> KEYS rt:*
> TTL rt:{userId}:{hash}
> GET rt:{userId}:{hash}
```

**Expected Results:**
- At least 1 `rt:*` key exists
- TTL shows positive number (~604800)
- GET returns valid JSON

## 🔄 After Token Refresh - Check

After waiting 15+ minutes and making an API request:
```bash
redis-cli
> KEYS rt:*
# Should still have tokens (old one deleted, new one stored)
> TTL rt:{userId}:{newHash}
# Should show ~604800 (new token with fresh TTL)
```

## 🐛 Troubleshooting

### Issue: No tokens found
**Check:**
1. Is Redis actually being used? (Check server logs)
2. Did login succeed? (Check server logs for "Refresh token stored")
3. Is `isTokenServiceAvailable()` returning true?

### Issue: TTL = -1 (no expiry)
**Problem:** TTL not set during storage  
**Fix:** Already fixed in code - verify with new login

### Issue: TTL = -2 (key doesn't exist)
**Problem:** Token was deleted or never stored  
**Check:** Server logs for storage errors

### Issue: Tokens disappear after restart
**Problem:** Persistence not enabled  
**Fix:** Enable RDB or AOF persistence in Memurai
