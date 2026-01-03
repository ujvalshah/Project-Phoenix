# Deployment Fixes Checklist - Project Nuggets

## Executive Summary

Your application is failing in production due to 2 critical issues:

1. ✅ **FIXED**: `tsx` dependency was in devDependencies (not available in production)
2. ⚠️ **ACTION REQUIRED**: Missing `FRONTEND_URL` environment variable on Render (causes immediate crash)

CORS configuration is **already correct** - no changes needed there.

---

## Issues Found & Fixes

### 1. ✅ FIXED: tsx Dependency Issue

**Problem:**
- Start script uses: `node --import tsx server/src/index.ts`
- `tsx` was in devDependencies, so Render doesn't install it in production
- Error: "Cannot find package 'tsx'"

**Solution Applied:**
- Moved `tsx` from devDependencies to dependencies in package.json
- This fix is already committed and ready to deploy

**Files Modified:**
- `package.json` - moved `"tsx": "^4.7.0"` to dependencies

---

### 2. ⚠️ ACTION REQUIRED: Missing FRONTEND_URL Environment Variable

**Problem:**
- Server requires `FRONTEND_URL` in production mode (see server/src/config/envValidation.ts:79-86)
- Without this variable, server crashes immediately with:
  ```
  ❌ PRODUCTION CONFIGURATION ERROR
  FRONTEND_URL is required in production mode.
  ```
- Server calls `process.exit(1)` and shuts down

**Solution:**
Add environment variable to Render:
- Variable: `FRONTEND_URL`
- Value: `https://nugget-cyan.vercel.app`

---

### 3. ✅ VERIFIED: CORS Configuration

**Status:** Already configured correctly - no action needed!

**Current Configuration** (server/src/index.ts:84-87):
```javascript
origin: [
  'http://localhost:5173',
  'https://nugget-cyan.vercel.app',  // ✅ Already included
  /\.vercel\.app$/  // ✅ Allows all Vercel deployments
],
```

CORS is properly configured and should work once the backend is running.

---

### 4. ✅ VERIFIED: API Base URLs

**Status:** Correctly configured

**Frontend Configuration:**
- File: `.env.production`
- Contains: `VITE_API_URL=https://nuggets-zhih.onrender.com`
- Frontend normalizes this to: `https://nuggets-zhih.onrender.com/api`

This matches the Render backend URL and will work correctly.

---

## Deployment Checklist

### Part A: Code Changes (✅ Already Done)

- [x] Move `tsx` from devDependencies to dependencies
- [x] Verify CORS configuration includes Vercel domain
- [x] Verify .env.production has correct API URL

### Part B: Render Backend Configuration (⚠️ YOU MUST DO THIS)

Go to your Render dashboard for the backend service and add these environment variables:

#### Required Variables:
1. **FRONTEND_URL**
   - Value: `https://nugget-cyan.vercel.app`
   - **CRITICAL**: Server will crash without this!

2. **NODE_ENV**
   - Value: `production`

3. **MONGO_URI**
   - Value: Your MongoDB connection string
   - Format: `mongodb+srv://username:password@cluster.mongodb.net/database`

4. **JWT_SECRET**
   - Value: Your JWT secret (minimum 32 characters)
   - Example: Generate with `openssl rand -base64 32`

5. **PORT** (Optional)
   - Value: `5000` (or leave unset, defaults to 5000)

#### Optional Variables (for full functionality):

6. **CLOUDINARY_CLOUD_NAME**
   - Value: Your Cloudinary cloud name
   - Needed for: Image uploads

7. **CLOUDINARY_API_KEY**
   - Value: Your Cloudinary API key
   - Needed for: Image uploads

8. **CLOUDINARY_API_SECRET**
   - Value: Your Cloudinary API secret
   - Needed for: Image uploads

9. **API_KEY** (Gemini)
   - Value: Your Google Gemini API key
   - Needed for: AI features

10. **SENTRY_DSN** (Optional)
    - Value: Your Sentry DSN
    - Needed for: Error tracking

### Part C: Render Build Configuration

Verify your Render service has these settings:

**Build Settings:**
- **Root Directory**: Leave empty (uses root of repo)
- **Build Command**: `npm install`
- **Start Command**: `npm run start`

**Important Notes:**
- Render should install from the root package.json
- Since we moved `tsx` to dependencies, it will now be installed
- The start command runs: `node --import tsx server/src/index.ts`

### Part D: Vercel Frontend Configuration

**Environment Variable:**
- Go to Vercel project settings → Environment Variables
- Verify: `VITE_API_URL=https://nuggets-zhih.onrender.com`

**Build Settings:**
- Should already be configured for Vite

---

## Deployment Steps (In Order)

### Step 1: Push Code Changes
```bash
# Commit the package.json changes
git add package.json
git commit -m "fix: move tsx to production dependencies for Render deployment"
git push origin main
```

### Step 2: Configure Render Environment Variables

1. Go to: https://dashboard.render.com
2. Select your backend service (nuggets-zhih)
3. Go to: Environment tab
4. Add/verify these variables:
   - `FRONTEND_URL=https://nugget-cyan.vercel.app` ⚠️ **CRITICAL**
   - `NODE_ENV=production`
   - `MONGO_URI=<your-mongodb-uri>`
   - `JWT_SECRET=<your-jwt-secret>`
   - Add Cloudinary variables if using image uploads
5. Click "Save Changes"

### Step 3: Trigger Render Deployment

Option A (Automatic):
- Render should auto-deploy when you push to main

Option B (Manual):
- In Render dashboard, click "Manual Deploy" → "Deploy latest commit"

### Step 4: Monitor Deployment

**Watch Render Logs:**
1. Go to Render dashboard → Logs tab
2. Look for successful startup:
   ```
   [Env] Environment variables loaded from .env
   Server started on port 5000
   Database connected
   ```

**If you see errors:**
- Check that all required environment variables are set
- Verify MONGO_URI is correct
- Check logs for specific error messages

### Step 5: Test Backend

1. Test health endpoint:
   ```bash
   curl https://nuggets-zhih.onrender.com/api/health
   ```

   Expected response:
   ```json
   {
     "status": "ok",
     "database": "connected",
     "uptime": 123
   }
   ```

2. If health check fails:
   - Check Render logs for errors
   - Verify all environment variables are set
   - Verify MongoDB connection string is correct

### Step 6: Test Frontend

1. Go to: https://nugget-cyan.vercel.app
2. Open browser console (F12)
3. Try to use the application
4. Check for:
   - ✅ No CORS errors
   - ✅ API requests going to correct URL
   - ✅ Data loading successfully

**If you see CORS errors:**
- Check that `FRONTEND_URL` is set correctly on Render
- Restart Render service to pick up environment variable changes

---

## Troubleshooting

### Backend Won't Start

**Error: "FRONTEND_URL is required"**
- Solution: Add `FRONTEND_URL=https://nugget-cyan.vercel.app` to Render env vars

**Error: "Cannot find package 'tsx'"**
- Solution: Verify package.json has `tsx` in dependencies (not devDependencies)
- Trigger new deployment to reinstall dependencies

**Error: "MONGO_URI is required"**
- Solution: Add `MONGO_URI` environment variable with your MongoDB connection string

**Error: "JWT_SECRET must be at least 32 characters"**
- Solution: Generate stronger secret: `openssl rand -base64 32`

### CORS Errors in Browser

**Error: "Access blocked by CORS policy"**
- Verify `FRONTEND_URL=https://nugget-cyan.vercel.app` is set on Render
- Restart Render service to pick up changes
- Clear browser cache and reload

### API Requests Failing

**Frontend can't connect to backend:**
1. Check Vercel env var: `VITE_API_URL=https://nuggets-zhih.onrender.com`
2. Trigger Vercel redeploy to pick up env var changes
3. Test backend health endpoint directly
4. Check browser network tab for actual request URL

---

## Post-Deployment Verification

### Backend Health Check:
```bash
# Should return 200 OK with status: "ok"
curl https://nuggets-zhih.onrender.com/api/health
```

### Frontend API Connection:
1. Open https://nugget-cyan.vercel.app
2. Open browser console (F12)
3. Check for console log: "API Base URL (runtime): https://nuggets-zhih.onrender.com/api"
4. Verify no CORS errors
5. Verify data loads successfully

### Test User Flow:
1. Try to sign up / log in
2. Create a new nugget
3. Upload an image (if Cloudinary is configured)
4. Verify everything works

---

## Environment Variables Reference

### Render Backend (Required):
```
FRONTEND_URL=https://nugget-cyan.vercel.app
NODE_ENV=production
MONGO_URI=mongodb+srv://...
JWT_SECRET=<min-32-chars>
```

### Render Backend (Optional):
```
PORT=5000
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
API_KEY=<gemini-api-key>
SENTRY_DSN=https://...
```

### Vercel Frontend:
```
VITE_API_URL=https://nuggets-zhih.onrender.com
```

---

## Summary of Changes Made

### Files Modified:
1. **package.json**
   - Moved `tsx` from devDependencies to dependencies
   - Ensures tsx is available in production on Render

2. **.env.production**
   - Cleaned up file encoding
   - Contains: `VITE_API_URL=https://nuggets-zhih.onrender.com`

3. **DEPLOYMENT_FIXES_CHECKLIST.md** (this file)
   - Complete deployment guide and troubleshooting

### Configuration Verified (No Changes Needed):
- ✅ CORS configuration (already includes Vercel domain)
- ✅ API base URL normalization (works correctly)
- ✅ Environment validation logic (working as designed)

---

## Next Steps

1. **Immediate Actions (DO THIS NOW):**
   - [ ] Commit and push package.json changes
   - [ ] Add `FRONTEND_URL` environment variable to Render
   - [ ] Verify all required environment variables are set on Render
   - [ ] Trigger Render deployment

2. **After Deployment:**
   - [ ] Monitor Render logs for successful startup
   - [ ] Test backend health endpoint
   - [ ] Test frontend at https://nugget-cyan.vercel.app
   - [ ] Verify no CORS errors in browser console

3. **If Issues Persist:**
   - Check Render logs for specific error messages
   - Verify all environment variables are set correctly
   - Review troubleshooting section above
   - Check MongoDB connection is working

---

## Support

If you encounter issues not covered in this checklist:
1. Check Render logs for specific error messages
2. Check browser console for frontend errors
3. Verify all environment variables match the reference section
4. Test each component individually (MongoDB, backend health, frontend)

Good luck with your deployment! 🚀
