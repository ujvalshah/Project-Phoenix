# DIAGNOSTIC GUIDE - Missing Nuggets/Data Issue

## Problem
- Can't see nuggets on homepage
- Can't see "The Mine" page (My Space)
- Can't see utility layout
- Data seems to have reverted

## Root Cause Analysis

Your `.env` file shows:
```
VITE_ADAPTER_TYPE=rest
```

This means the frontend is trying to use the **backend API** instead of localStorage.

## Quick Fixes

### Option 1: Use Local Adapter (Quickest Fix)
If you want to see data immediately without backend:

1. Edit `.env` file in project root
2. Change:
   ```
   VITE_ADAPTER_TYPE=rest
   ```
   to:
   ```
   VITE_ADAPTER_TYPE=local
   ```
3. Restart frontend: `npm run dev`
4. Data will load from localStorage (mock data)

### Option 2: Fix Backend Connection (Proper Fix)

If you want to use real backend data:

1. **Start Backend Server:**
   ```bash
   npm run dev:server
   ```
   Should see: `[Server] ✓ Express server listening on http://0.0.0.0:5000`

2. **Check MongoDB Connection:**
   - Backend will try to connect to MongoDB Atlas
   - Look for: `[MongoDB] ✓ Connected to MongoDB`
   - If you see: `[MongoDB] ⚠️ Connection failed` → Backend will use in-memory fallback

3. **Check Seeding:**
   - On first connection, should see: `[Seed] Database seeded`
   - If you see: `[Seed] Skipped (already populated)` → Database already has data

4. **Verify Health Check:**
   - Open: http://localhost:5000/api/health
   - Should return: `{"status":"ok","mongodb":"connected"}` or `"disconnected"`

5. **Check Browser Console:**
   - Open DevTools (F12)
   - Look for errors in Console tab
   - Check Network tab for failed API requests

## Common Issues

### Issue 1: Backend Not Running
**Symptom:** No nuggets showing, console errors about connection refused

**Fix:**
```bash
# Terminal 1
npm run dev:server

# Terminal 2  
npm run dev
```

### Issue 2: MongoDB Not Connected
**Symptom:** Backend running but no data

**Fix:**
- Check `server/.env` has correct `MONGODB_URI`
- Backend will use in-memory fallback (4 articles) if MongoDB fails
- You should still see some data

### Issue 3: Database Empty
**Symptom:** Backend connected but no articles

**Fix:**
- Seed system should run automatically
- If not, check backend logs for `[Seed]` messages
- Manually trigger by restarting backend

### Issue 4: Wrong Adapter Type
**Symptom:** Using rest adapter but backend not running

**Fix:**
- Either start backend OR
- Change to `VITE_ADAPTER_TYPE=local` in `.env`

## Verification Steps

1. ✅ Check `.env` has `VITE_ADAPTER_TYPE=rest` or `local`
2. ✅ Backend running on port 5000
3. ✅ Frontend running on port 3000
4. ✅ Browser console has no red errors
5. ✅ Network tab shows successful API calls (if using rest)
6. ✅ Health check works: http://localhost:5000/api/health

## Expected Behavior

### With `VITE_ADAPTER_TYPE=local`:
- No backend needed
- Data from localStorage
- 4 mock articles should appear

### With `VITE_ADAPTER_TYPE=rest`:
- Backend must be running
- Data from MongoDB (if connected) or in-memory fallback
- 12 articles if MongoDB seeded, 4 if using fallback

## Next Steps

1. Check which adapter is active (browser console will show)
2. Verify backend is running
3. Check MongoDB connection status
4. Verify data is loading (Network tab in DevTools)












