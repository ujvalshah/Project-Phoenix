/**
 * Global Setup for E2E Tests
 *
 * Authenticates once before all tests run to avoid rate limiting.
 * Tries the Vite dev origin `/api/*` proxy first (matches browser traffic when only
 * `npm run dev` is up alongside the API), then falls back to `PLAYWRIGHT_API_BASE`.
 *
 * **Important:** `loginLimiter` allows only **5** POST `/auth/login` per IP per 15 minutes.
 * We use **one** primary API base and **minimal** login attempts so bootstrap + browser
 * `establishBrowserAuthSession` stay under the limit.
 */

import { FullConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { waitForBackendHealthy } from './helpers/backend-health';

/** Direct backend base, e.g. http://localhost:5000/api */
const DIRECT_API_FALLBACK =
  process.env.PLAYWRIGHT_API_BASE || 'http://localhost:5000/api';

function stripTrailingSlashes(base: string): string {
  return base.replace(/\/+$/, '');
}

function collectLoginApiBases(): string[] {
  const ordered: string[] = [];

  const explicitLogin = process.env.PLAYWRIGHT_LOGIN_API_BASE;
  if (explicitLogin) {
    ordered.push(stripTrailingSlashes(explicitLogin));
  }

  const webOrigin = stripTrailingSlashes(
    process.env.PLAYWRIGHT_WEB_ORIGIN || 'http://localhost:3000',
  );
  ordered.push(`${webOrigin}/api`);

  ordered.push(stripTrailingSlashes(DIRECT_API_FALLBACK));

  return [...new Set(ordered)];
}

// ES module compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AUTH_FILE = path.join(__dirname, '.auth-state.json');

function writeAuthFile(token: string, email: string): void {
  fs.writeFileSync(
    AUTH_FILE,
    JSON.stringify({
      token,
      authenticated: !!token,
      email,
      timestamp: Date.now(),
    }),
  );
}

async function globalSetup(_config: FullConfig) {
  /** Smoke-only flows that authenticate inside the browser (see `establishBrowserAuthSession`). */
  if (process.env.PLAYWRIGHT_SKIP_GLOBAL_AUTH === '1') {
    console.log(
      '[Global Setup] Skipped (PLAYWRIGHT_SKIP_GLOBAL_AUTH=1 — no Node-side login).',
    );
    fs.writeFileSync(AUTH_FILE, JSON.stringify({ token: '', authenticated: false }));
    return;
  }

  const webOrigin = process.env.PLAYWRIGHT_WEB_ORIGIN || 'http://localhost:3000';
  await waitForBackendHealthy(webOrigin);
  console.log('[Global Setup] /api/health reports Mongo ready');

  const email = process.env.TEST_USER_EMAIL || 'test@example.com';
  const password = process.env.TEST_USER_PASSWORD || 'TestPassword123!';
  const bases = collectLoginApiBases();
  /** Single base — avoids burning the login rate limit by probing :3000 and :5000 back-to-back. */
  const primary = bases[0];
  const loginUrl = `${primary}/auth/login`;
  const signupUrl = `${primary}/auth/signup`;

  async function tryLogin(): Promise<boolean> {
    try {
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        console.warn(
          `[Global Setup] Login HTTP ${response.status} at ${loginUrl} (${response.statusText})`,
        );
        return false;
      }

      const data = (await response.json()) as { token?: string };
      const token = data.token || '';
      writeAuthFile(token, email);
      console.log(`[Global Setup] Authentication successful via ${loginUrl}`);
      return true;
    } catch (error) {
      console.warn(`[Global Setup] Login unreachable at ${loginUrl}:`, error);
      return false;
    }
  }

  if (await tryLogin()) {
    return;
  }

  console.log('[Global Setup] Login failed; attempting signup at', signupUrl);
  try {
    const signupRes = await fetch(signupUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'E2E Test User',
        email,
        password,
      }),
    });

    const signupBody = (await signupRes.json().catch(() => ({}))) as {
      token?: string;
    };

    if (signupRes.ok && signupBody.token) {
      writeAuthFile(signupBody.token, email);
      console.log('[Global Setup] Authentication via signup token');
      return;
    }

    const bodyPreview = JSON.stringify(signupBody).slice(0, 300);
    console.warn(
      `[Global Setup] Signup HTTP ${signupRes.status} body preview:`,
      bodyPreview,
    );
  } catch (e) {
    console.warn('[Global Setup] Signup failed:', e);
  }

  if (await tryLogin()) {
    return;
  }

  console.error('[Global Setup] Could not obtain auth token (login rate limit or wrong credentials).');
  fs.writeFileSync(AUTH_FILE, JSON.stringify({ token: '', authenticated: false }));
}

export default globalSetup;
