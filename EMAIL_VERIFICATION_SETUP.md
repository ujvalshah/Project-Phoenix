# Email Verification & Password Reset Setup

This guide explains how email verification and password reset work and how to configure them.

---

## Overview

### Email Verification Flow
1. **Signup** → User is created with `auth.emailVerified: false`. If `RESEND_API_KEY` is set, a verification email is sent (fire-and-forget; signup does not fail if the email fails).
2. **Verification link** → User clicks a link like `{FRONTEND_URL}/verify-email?token=...`. The frontend calls `GET /api/auth/verify-email?token=...`. The backend verifies the JWT, sets `auth.emailVerified = true`, and returns success.
3. **Resend** → User can request a new verification email via `POST /api/auth/resend-verification` with `{ "email": "..." }` (rate-limited: 3 per 15 min per IP).

### Password Reset Flow
1. **Forgot Password** → User submits email at `/forgot-password`. Backend sends reset email (1 hour expiry).
2. **Reset Link** → User clicks link like `{FRONTEND_URL}/reset-password?token=...`.
3. **New Password** → User enters new password. All sessions are revoked after reset.

---

## 1. Email Provider (Resend)

The app uses [Resend](https://resend.com) when `RESEND_API_KEY` is set. If it is not set, verification emails are **not sent** (signup and the verify endpoint still work; you can test verify with a manually crafted token).

### Resend Setup - Development

1. Sign up at [resend.com](https://resend.com).
2. Use the free tier. You can send from `onboarding@resend.dev` to your own email.
3. No domain verification needed for development.

### Resend Setup - Production (Domain Verification)

**Step 1: Add Your Domain**
1. Go to [Resend Dashboard](https://resend.com/domains)
2. Click "Add Domain"
3. Enter your domain (e.g., `nuggetnews.app`)

**Step 2: Add DNS Records**
Resend will show you DNS records to add. You'll need to add these to your DNS provider (e.g., Cloudflare, GoDaddy, Namecheap):

| Type | Name | Value | Purpose |
|------|------|-------|---------|
| TXT | `@` or `nuggetnews.app` | `v=spf1 include:_spf.resend.com -all` | SPF (prevents spoofing) |
| CNAME | `resend._domainkey` | `resend._domainkey.resend.com` | DKIM (email authentication) |
| TXT | `_dmarc` | `v=DMARC1; p=none;` | DMARC policy |

**Step 3: Wait for Verification**
- DNS propagation takes 1-48 hours
- Resend will automatically verify once records are detected
- Status changes from "Pending" to "Verified"

**Step 4: Update Environment Variables**
```env
RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM=Nuggets <noreply@nuggetnews.app>
```

**Step 5: Test Email Delivery**
```bash
# Test from your backend
curl -X POST https://your-api.onrender.com/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com"}'
```

### Troubleshooting Domain Verification

| Issue | Solution |
|-------|----------|
| DNS records not detected | Wait 24-48 hours, check for typos |
| SPF record conflict | Merge with existing SPF (only one SPF record allowed) |
| Emails going to spam | Check DKIM/DMARC are properly set up |
| Still using onboarding@resend.dev | Update `EMAIL_FROM` env var |

### Env vars

Add to `.env`:

```env
# Optional. If unset, verification emails are not sent (verify endpoint still works).
RESEND_API_KEY=re_xxxxxxxxxxxx

# Optional. Default: "Nuggets <onboarding@resend.dev>"
# For production with your domain: "Nuggets <noreply@yourdomain.com>"
EMAIL_FROM=Nuggets <onboarding@resend.dev>
```

- **`RESEND_API_KEY`** – From Resend: **API Keys** → Create. Required only if you want to send emails.
- **`EMAIL_FROM`** – Sender. Must be `onboarding@resend.dev` (or a verified domain) for Resend to accept.

---

## 2. Frontend URL (for verification links)

Verification links use `FRONTEND_URL` so the link works in production.

- **Production:** `FRONTEND_URL` is required (e.g. `https://nuggetnews.app`).
- **Development:** If unset, `http://localhost:5173` is used.

---

## 3. Flow and Behavior

| Step | What happens |
|------|--------------|
| **Signup** | User created with `emailVerified: false`. If `RESEND_API_KEY` is set, an email is sent with `{FRONTEND_URL}/verify-email?token={jwt}`. JWT payload: `{ purpose: 'email_verification', userId, email }`, expires in 24h. |
| **User clicks link** | Browser opens `/verify-email?token=...`. `VerifyEmailPage` calls `GET /api/auth/verify-email?token=...`. |
| **Backend verify** | Validates JWT (purpose, expiry, userId, email), finds user, sets `auth.emailVerified = true`. Idempotent: if already verified, returns 200. |
| **Resend** | `POST /api/auth/resend-verification` with `{ "email": "user@example.com" }`. If user exists, not verified, and provider is `email`, sends a new verification email. If user not found or social-only: same generic 200 to avoid enumeration. |

---

## 4. Rate limiting

- **GET /api/auth/verify-email** – 5 requests per 15 minutes per IP (shared with future password-reset).
- **POST /api/auth/resend-verification** – 3 requests per 15 minutes per IP.

Uses Redis when `REDIS_URL` is set; otherwise in-memory.

---

## 5. Optional: “Resend” in the UI

The backend supports `POST /api/auth/resend-verification`. To add a “Resend verification email” action:

1. Show a banner when `user.auth.emailVerified === false` (e.g. on the feed or account page).
2. Add a “Resend” button that calls:

   ```ts
   await apiClient.post('/auth/resend-verification', { email: user.auth.email });
   ```

3. Handle 429 (rate limit), 400 (already verified), and 503 (email not configured). On 200, show something like “If an account exists with this email, a new link has been sent.”

---

## 6. Optional: Restrict unverified users

Right now, unverified users can use the app. To restrict (e.g. no creating nuggets until verified):

- In the backend: in the create‑nugget (or other) handler, check `user.auth.emailVerified`. If false, return 403 with a message like “Please verify your email first.”
- In the frontend: hide or disable “Create” (and show the verify banner) when `!user.auth.emailVerified`.

---

## 7. Using another provider (e.g. Nodemailer + SMTP)

To switch from Resend to Nodemailer, SendGrid, or SES:

1. **Implement a sender in `server/src/services/emailService.ts`**  
   - Replace or supplement the Resend-based `sendVerificationEmail` (e.g. branch on `SMTP_HOST` or `SENDGRID_API_KEY`).
   - Keep the same function signature: `sendVerificationEmail(to: string, verificationUrl: string): Promise<void>`.

2. **Env**  
   - Use your provider’s env vars (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, etc. or `SENDGRID_API_KEY`).  
   - Optionally add them to `server/src/config/envValidation.ts` as optional.

3. **Condition for sending**  
   - Use the same idea: only send when the relevant env var is set (e.g. `process.env.SMTP_HOST` or `process.env.RESEND_API_KEY`). If none are set, `sendVerificationEmail` remains a no-op.

---

## 8. Files touched

| Path | Role |
|------|-----|
| `server/src/services/emailService.ts` | Sends verification email via Resend when `RESEND_API_KEY` is set. |
| `server/src/utils/jwt.ts` | `generateEmailVerificationToken`, `verifyEmailVerificationToken` (purpose `email_verification`, 24h). |
| `server/src/controllers/authController.ts` | `verifyEmail` (GET), `resendVerification` (POST); signup sends verification email when Resend is configured. |
| `server/src/routes/auth.ts` | `GET /verify-email`, `POST /resend-verification`. |
| `server/src/middleware/rateLimiter.ts` | `resendVerificationLimiter`; `passwordResetLimiter` used for verify-email. |
| `server/src/config/envValidation.ts` | Optional `RESEND_API_KEY`, `EMAIL_FROM`. |
| `src/services/authService.ts` | `verifyEmail(token)` calls `GET /auth/verify-email?token=...`. |
| `src/pages/VerifyEmailPage.tsx` | Unchanged; uses `authService.verifyEmail(token)` and `?token=`. |

---

## 9. Quick test (without Resend)

1. Sign up a user (no email is sent if `RESEND_API_KEY` is unset).
2. Create a token (e.g. in a small script or `node -e`):

   ```js
   const jwt = require('jsonwebtoken');
   const token = jwt.sign(
     { purpose: 'email_verification', userId: '<USER_ID>', email: '<USER_EMAIL>' },
     process.env.JWT_SECRET,
     { expiresIn: '24h', algorithm: 'HS256' }
   );
   console.log(token);
   ```

3. Open `http://localhost:5173/verify-email?token=<TOKEN>`. The page should call the API and show “Email Verified!”.
