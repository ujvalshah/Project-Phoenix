# Fix: Frequent Sign-Out Issue

## 🔍 Root Cause

You're experiencing frequent sign-outs because:

1. **Access tokens expire after 15 minutes** (security best practice)
2. **Refresh tokens should automatically renew access tokens** when they expire
3. **BUT** - If refresh tokens aren't stored properly in Redis, or if the refresh mechanism fails, you get logged out

## ✅ Why This Happens

### Scenario 1: Old Sessions (Before Redis Was Installed)
- If you logged in **before** Redis was installed, your session doesn't have a refresh token
- When your access token expires (15 min), there's no refresh token to renew it
- Result: You get logged out

### Scenario 2: Refresh Token Storage Failed
- If Redis was unavailable during login, refresh tokens weren't stored
- Even though Redis is working now, old sessions still don't have refresh tokens

### Scenario 3: Refresh Mechanism Not Working
- The refresh endpoint might be failing
- Or refresh tokens might be expiring/lost

## 🚀 Solution

### Step 1: Verify Refresh Tokens Are Being Stored

Run this diagnostic:
```bash
node diagnose-auth.js
```

This will show:
- How many refresh tokens are stored in Redis
- If your current session has a refresh token

### Step 2: Log Out and Log Back In

**Important:** Since Redis is now working, you need to:
1. **Log out** completely
2. **Log back in** - this will create a new session with a refresh token stored in Redis
3. Your new session should persist for 7 days (refresh token lifetime)

### Step 3: Verify It's Working

After logging in again:
1. Check browser console for any errors
2. Wait 15+ minutes
3. Make an API request - it should automatically refresh your token
4. You should NOT get logged out

## 🔧 Technical Details

### How It Should Work:

1. **Login** → Access token (15 min) + Refresh token (7 days) stored in Redis
2. **After 15 min** → Access token expires
3. **Next API request** → Frontend detects expired token
4. **Auto-refresh** → Calls `/auth/refresh` with refresh token
5. **New tokens** → Gets new access token + rotated refresh token
6. **Continue** → Request succeeds, user stays logged in

### Why It Might Fail:

- ❌ No refresh token stored (old session)
- ❌ Refresh token expired (after 7 days)
- ❌ Redis unavailable (refresh token can't be validated)
- ❌ Refresh endpoint error

## 📊 Expected Behavior After Fix

- ✅ **Stay logged in for 7 days** (refresh token lifetime)
- ✅ **Automatic token refresh** every 15 minutes (transparent to user)
- ✅ **No frequent sign-outs** (unless refresh token expires after 7 days)

## 🐛 If Still Getting Signed Out

1. **Check server logs** for refresh token errors
2. **Check browser console** for refresh failures
3. **Run diagnostic**: `node diagnose-auth.js`
4. **Verify Redis is running**: `redis-cli ping`

## 💡 Quick Fix

**Just log out and log back in** - your new session will have refresh tokens stored in Redis and should work properly!

---

**Note:** The 15-minute access token expiry is a security feature. Refresh tokens allow you to stay logged in for 7 days without re-entering credentials.
