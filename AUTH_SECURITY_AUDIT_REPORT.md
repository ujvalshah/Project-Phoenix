# Auth & Signup Security Audit Report

**App:** Nuggets · **Date:** 2025  
**Scope:** Authentication, signup, JWT, rate limiting, CORS, logging, deployment.

---

## 1. Vulnerabilities and Weaknesses Found

| # | Severity | Finding |
|---|----------|---------|
| 1 | **High** | **JWT in localStorage** – Tokens in `localStorage` are readable by any XSS. Prefer HttpOnly cookies. |
| 2 | **Medium** | **Login user enumeration** – "This account was created with social login" revealed that the email exists and the auth method. |
| 3 | **Medium** | **JWT algorithm not fixed** – `jwt.verify` did not set `algorithms: ['HS256']`, allowing algorithm confusion (e.g. `alg: none`). |
| 4 | **Medium** | **Long access token TTL (7d)** – Access tokens lived 7 days with no refresh; shortened to 1d. |
| 5 | **Medium** | **Sentry / logs could receive passwords** – Global error handler and Sentry `extra` included `req.body` for `/api/auth/*` (login/signup). |
| 6 | **Low** | **PII in auth logs** – `console.log`/`console.error` in signup/login included email, username, `keyValue`, etc. |
| 7 | **Low** | **Email/username not normalized in Zod** – Login/signup did not `.transform` email to lowercase/trim; done ad hoc in handlers. |
| 8 | **Low** | **CORS not env-driven** – `allowedOrigins` was fixed; `FRONTEND_URL` was not used. |
| 9 | **Low** | **No rate limiter for password-reset** – Password reset is not implemented; no limiter was prepared for when it is. |
| 10 | **Info** | **Google OAuth not implemented** – User model supports `google`/`linkedin`; no OAuth routes or logic. Nothing to harden yet. |
| 11 | **Info** | **Unused `server/src/middleware/auth.ts`** – Replaced by `authenticateToken.ts` everywhere; legacy, not a vulnerability. |

---

## 2. Fixes Applied

### Part 1 – Trust boundaries & token storage

- **AuthContext.tsx** – Comment: `// SECURITY: Token in localStorage is vulnerable to XSS. Prefer HttpOnly cookies…`
- **apiClient.ts** – Same comment. No change to behavior; migration path documented.

### Part 2 – Email/password

- **authController.ts**
  - `loginSchema`: `email` → `z.string().email().transform(s => s.toLowerCase().trim())`.
  - `signupSchema`: `email` → `z.string().email().transform(s => s.toLowerCase().trim())`; `username` already had `.transform`.
  - Single generic login failure message: `LOGIN_FAILURE_MSG = 'Invalid email or password'` for: user not found, wrong password, and “social‑only” account (removes enumeration).
  - Comment that `bcrypt.compare` is timing‑safe.
  - Signup: `normalizedEmail`/`normalizedUsername` taken from schema output; removed redundant `$expr` find and PII from logs.
- **Zod** – Used for login and signup; password policy already enforced in signup (length, upper, lower, number, special).

### Part 3 – JWT

- **jwt.ts**
  - `generateToken`: `algorithm: 'HS256'` and default `expiresIn: '1d'` (was `7d`).
  - `verifyToken`: `jwt.verify(..., { algorithms: ['HS256'] })`.

### Part 4 – Google OAuth

- **No implementation found** – Only model enums. No routes, callback, or ID token checks. When OAuth is added: verify ID token (aud, iss, exp), use `state` for CSRF, and avoid open redirects.

### Part 5 – CORS & cookies

- **index.ts** – `allowedOrigins` built from `env.FRONTEND_URL` (when set) plus fixed production domains.
- Auth uses **Bearer in `Authorization`**, not cookies, so HttpOnly/SameSite are N/A for current auth. CSRF risk is low while tokens are in headers only; main residual risk is XSS + `localStorage` (see #1).

### Part 6 – Rate limiting

- **rateLimiter.ts** – `passwordResetLimiter` (5/15min per IP, Redis if `REDIS_URL`). **Apply it to** `POST /auth/forgot-password` and any reset/verify-by-email when those routes exist.
- **auth.ts** – `loginLimiter` and `signupLimiter` already on `/login` and `/signup`; Redis used when `REDIS_URL` is set.

### Part 7 – Deployment & env

- **envValidation** – `validateEnv()` and `getEnv()` already; `JWT_SECRET` min 32 chars; `FRONTEND_URL` required in production. No change.
- **loadEnv** – `dotenv` from project root; no `.env` in production code paths.

### Part 8 – Logging & monitoring

- **authController.ts**
  - Replaced `console.error`/`console.log` with `createRequestLogger` and structured `{ msg, err: { message, name } }`; no passwords, no email/username in logs.
  - Duplicate‑key logs: only field names (`auth.email`, `profile.username`) and hint to run `npm run fix-indexes`; no PII.
- **index.ts** – For `req.path.startsWith('/api/auth')`, `captureException(..., extra: { method })` only; **no `body` or `query`** to avoid passwords in Sentry.

---

## 3. Production-ready?

**Yes, with one important caveat.**

- Email/password: Zod, bcrypt (10 rounds), timing‑safe compare, generic login errors, normalized email/username.  
- JWT: HS256 only, 1d TTL, verification with `algorithms: ['HS256']`.  
- Rate limiting: login, signup; Redis when `REDIS_URL` is set; in‑memory fallback.  
- CORS: `FRONTEND_URL` + fixed origins; `credentials: true`; no wildcard with creds.  
- Logging/Sentry: no auth PII or `req.body` for `/api/auth/*`.  
- Env: required vars validated at startup; `JWT_SECRET` length; `FRONTEND_URL` in prod.

**Caveat:** JWT in `localStorage` remains the main residual risk. For production, plan migration to **HttpOnly cookies** (Set-Cookie on login/signup, `credentials: 'include'`, drop `Authorization` and `localStorage` for tokens).

---

## 4. Optional / follow‑up

1. **HttpOnly cookie migration** – Set-Cookie on login/signup; `Secure` in prod; `SameSite=Strict` or `Lax`; `credentials: 'include'` and no token in `localStorage`/headers.
2. **Refresh tokens** – 1d access TTL may force daily re‑login; add short‑lived access + HttpOnly refresh for better UX and security.
3. **bcrypt rounds** – Consider 12 (or env `BCRYPT_ROUNDS`) if you want stronger hashing.
4. **Password‑reset & OAuth** – When added: use `passwordResetLimiter`; implement OAuth with server‑side ID token verification, `state`, and no open redirects.
5. **Remove or merge `server/src/middleware/auth.ts`** – Dead code; all routes use `authenticateToken.ts`.

---

## 5. Breaking changes

- **JWT TTL: 7d → 1d** – Users will need to sign in again after 1 day of inactivity. If too strict, increase to `2d`/`3d` or introduce refresh tokens.
- **Login “social‑only”** – Message is now the same as wrong password: `"Invalid email or password"`. UX is slightly less specific; security (no enumeration) is improved.

All other edits are backward‑compatible (CORS, logging, Zod transforms, rate limiters, Sentry `extra`).

---

## 6. Files touched

| Path | Changes |
|------|---------|
| `src/context/AuthContext.tsx` | Comment: prefer HttpOnly over `localStorage` |
| `src/services/apiClient.ts` | Comment: same |
| `server/src/controllers/authController.ts` | Zod transforms, generic login message, structured logging, no PII, `createRequestLogger` |
| `server/src/utils/jwt.ts` | `algorithm: 'HS256'`, `algorithms: ['HS256']`, `expiresIn: '1d'` |
| `server/src/index.ts` | CORS from `FRONTEND_URL`; Sentry `extra` without `body`/`query` for `/api/auth/*` |
| `server/src/middleware/rateLimiter.ts` | `passwordResetLimiter` and Redis store for future reset routes |
