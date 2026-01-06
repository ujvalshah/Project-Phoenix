/**
 * Global Setup for E2E Tests
 *
 * Authenticates once before all tests run to avoid rate limiting
 */

import { FullConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const API_BASE = process.env.PLAYWRIGHT_API_BASE || 'http://localhost:5000/api';

// ES module compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AUTH_FILE = path.join(__dirname, '.auth-state.json');

async function globalSetup(config: FullConfig) {
  const email = process.env.TEST_USER_EMAIL || 'test@example.com';
  const password = process.env.TEST_USER_PASSWORD || 'TestPassword123!';

  console.log(`[Global Setup] Authenticating as ${email}...`);

  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      console.warn(`[Global Setup] Failed to authenticate: ${response.status} ${response.statusText}`);
      // Write empty auth state - tests will skip auth-required operations
      fs.writeFileSync(AUTH_FILE, JSON.stringify({ token: '', authenticated: false }));
      return;
    }

    const data = await response.json();
    const token = data.token || '';

    // Store auth state for tests to use
    fs.writeFileSync(
      AUTH_FILE,
      JSON.stringify({
        token,
        authenticated: !!token,
        email,
        timestamp: Date.now(),
      })
    );

    console.log(`[Global Setup] Authentication ${token ? 'successful' : 'failed'}`);
  } catch (error) {
    console.error(`[Global Setup] Authentication error:`, error);
    fs.writeFileSync(AUTH_FILE, JSON.stringify({ token: '', authenticated: false }));
  }
}

export default globalSetup;
