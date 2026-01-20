# Production Security Checklist

## Pre-Deployment Verification

### 1. Environment Variables

**Required in Production:**
- [ ] `MONGO_URI` - MongoDB connection string with authentication
- [ ] `JWT_SECRET` - Minimum 32 characters, cryptographically random
- [ ] `NODE_ENV=production`
- [ ] `FRONTEND_URL` - Your production domain (e.g., `https://nuggetnews.app`)
- [ ] `REDIS_URL` - Redis connection with TLS (e.g., `rediss://...`)
- [ ] `RESEND_API_KEY` - For email verification
- [ ] `EMAIL_FROM` - Verified sender domain

**Generate a secure JWT secret:**
```bash
# Option 1: OpenSSL
openssl rand -base64 48

# Option 2: Node.js
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

### 2. Database Security

- [ ] MongoDB Atlas with authentication enabled
- [ ] IP whitelist configured (only your server IPs)
- [ ] Connection string uses `mongodb+srv://` with TLS
- [ ] Database user has minimal required permissions
- [ ] Backup schedule configured

**Verify indexes exist:**
```bash
# Run in MongoDB shell or Compass
db.users.getIndexes()
# Should see: auth.email, profile.username
```

### 3. Redis Security

- [ ] Using `rediss://` (TLS) protocol
- [ ] AUTH password configured
- [ ] `maxmemory-policy` set to `allkeys-lru`
- [ ] Connection from backend server only

### 4. Email Configuration

- [ ] Custom domain verified in Resend dashboard
- [ ] `EMAIL_FROM` uses your verified domain
- [ ] Test email delivery in staging first

---

## Security Features Verification

### Token System
- [ ] Access tokens expire in 15 minutes
- [ ] Refresh tokens expire in 7 days
- [ ] Refresh token rotation is working (new refresh token on each refresh)
- [ ] Token blacklisting works on logout (test by logging out and reusing old token)

**Test token blacklisting:**
```bash
# 1. Login and save the access token
# 2. Make a request with the token (should work)
# 3. Logout with POST /api/auth/logout
# 4. Try the same token again (should get 401 TOKEN_REVOKED)
```

### Account Lockout
- [ ] Account locks after 5 failed login attempts
- [ ] Lockout duration is 15 minutes
- [ ] Successful login clears failed attempts

**Test account lockout:**
```bash
# 1. Try logging in with wrong password 5 times
# 2. 6th attempt should return ACCOUNT_LOCKED with lockoutEndsAt
# 3. Wait 15 minutes or clear Redis key: DEL lock:email@example.com
```

### Rate Limiting
- [ ] Login: 5 requests per 15 minutes per IP
- [ ] Signup: 10 requests per hour per IP
- [ ] Token refresh: 5 requests per 15 minutes per IP
- [ ] Resend verification: 3 requests per 15 minutes per IP

### Email Verification
- [ ] New users receive verification email
- [ ] Verification link works correctly
- [ ] Resend verification respects rate limits
- [ ] `requireEmailVerified` middleware blocks unverified users where needed

---

## Deployment Steps

### For Render.com

1. **Environment Variables in Render Dashboard:**
   ```
   NODE_ENV=production
   MONGO_URI=mongodb+srv://...
   JWT_SECRET=your-secret-min-32-chars
   FRONTEND_URL=https://nuggetnews.app
   REDIS_URL=rediss://...
   RESEND_API_KEY=re_...
   EMAIL_FROM=Nuggets <noreply@nuggetnews.app>
   ```

2. **Build Command:**
   ```bash
   npm ci && npm run build
   ```

3. **Start Command:**
   ```bash
   node server/dist/index.js
   ```

4. **Health Check Path:**
   ```
   /api/health
   ```

### For Vercel (Frontend)

1. **Environment Variables:**
   ```
   VITE_API_URL=https://your-render-app.onrender.com/api
   VITE_ADAPTER_TYPE=rest
   ```

2. **Build Settings:**
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`

---

## Monitoring Setup

### Sentry Configuration

1. **Backend (server/.env):**
   ```
   SENTRY_DSN=https://xxx@sentry.io/xxx
   ```

2. **Frontend (Vite env):**
   ```
   VITE_SENTRY_DSN=https://xxx@sentry.io/xxx
   ```

### Health Monitoring

Set up external monitoring (e.g., UptimeRobot, Pingdom):
- **URL:** `https://your-api.onrender.com/api/health`
- **Expected Response:** `{"status":"ok"}`
- **Alert on:** Non-200 response or timeout

### Key Metrics to Track

1. **Authentication:**
   - Login success/failure rate
   - Account lockout frequency
   - Token refresh frequency
   - Logout events

2. **Email:**
   - Verification email delivery rate
   - Resend request frequency

3. **Security Events:**
   - 401/403 error frequency
   - Rate limit hits
   - Suspicious IP patterns

---

## Post-Deployment Verification

### Manual Tests

1. **Registration Flow:**
   - [ ] Create new account
   - [ ] Receive verification email
   - [ ] Click verification link
   - [ ] `emailVerified` is `true` after verification

2. **Login Flow:**
   - [ ] Login with correct credentials works
   - [ ] Token stored correctly
   - [ ] Can access protected routes

3. **Logout Flow:**
   - [ ] Logout clears local storage
   - [ ] Old token rejected (TOKEN_REVOKED)
   - [ ] Redirect to home/login page

4. **Token Refresh:**
   - [ ] Access token refreshes automatically
   - [ ] No user-visible interruption

5. **Security:**
   - [ ] Wrong password shows generic error
   - [ ] Rate limits work
   - [ ] Account lockout triggers after 5 failures

### API Testing

```bash
# Health check
curl https://your-api.onrender.com/api/health

# Login (should work)
curl -X POST https://your-api.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPassword123!"}'

# Test rate limiting (run 6 times quickly)
for i in {1..6}; do
  curl -X POST https://your-api.onrender.com/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}'
done
# Last one should return 429 or ACCOUNT_LOCKED
```

---

## Emergency Procedures

### If Account Is Compromised

1. **Revoke all sessions:**
   ```bash
   # Call from authenticated user's browser or use admin tool
   POST /api/auth/logout-all
   ```

2. **In Redis (if needed):**
   ```bash
   # Delete all refresh tokens for a user
   redis-cli KEYS "rt:USER_ID:*" | xargs redis-cli DEL
   redis-cli DEL "sess:USER_ID"
   ```

### If Under Attack (Brute Force)

1. **Increase rate limits temporarily** in `rateLimiter.ts`
2. **Block specific IPs** at reverse proxy level
3. **Monitor logs** for patterns

### If Email Service Is Down

1. **Users can still register** (emailVerified will be false)
2. **Admin can manually verify** users in MongoDB:
   ```javascript
   db.users.updateOne(
     { 'auth.email': 'user@example.com' },
     { $set: { 'auth.emailVerified': true } }
   )
   ```

---

## Security Contacts

- **Sentry Alerts:** [Configure in Sentry dashboard]
- **UptimeRobot:** [Configure webhook or email alerts]
- **Render:** [Enable Slack/email notifications]

---

## Compliance Notes

### GDPR Considerations

- [ ] Privacy policy updated for email collection
- [ ] Users can delete their account (if implemented)
- [ ] Email preferences are configurable
- [ ] No sensitive data logged

### Data Retention

- [ ] Refresh tokens expire after 7 days (auto-cleanup)
- [ ] Blacklisted tokens auto-expire with access token TTL
- [ ] Failed login attempts clear after 15 minutes
- [ ] Consider implementing unverified account cleanup (7 days)

---

## Version History

| Date | Change | Author |
|------|--------|--------|
| 2025-01-19 | Initial security audit implementation | Claude |
