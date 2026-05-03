import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Global setup authenticates once before all tests */
  globalSetup: './tests/e2e/global-setup.ts',
  /* Run tests in files in parallel - disabled to avoid rate limiting on auth */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /** Single retry absorbs cold-cache modal chunk variance without triplicating CI runtime */
  retries: 1,
  /** Single worker keeps smoke sequential and avoids cross-test server contention */
  workers: 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Global timeout for each test */
  timeout: 60000,
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:3000',
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    /* Screenshot on failure */
    screenshot: 'only-on-failure',
    /* Video on failure for debugging */
    video: 'retain-on-failure',
  },

  /**
   * Layered e2e contract:
   * - smoke: fast PR/push gate (default CI blocker)
   * - forensic: geometry/layout audit with raw JSON artifact emission
   */
  projects: [
    {
      name: 'smoke',
      use: { ...devices['Desktop Chrome'] },
      testMatch: [
        '**/home-feed-smoke.spec.ts',
        '**/perf-guards-nugget-modal.spec.ts',
        '**/masonry-toggle.spec.ts',
      ],
    },
    {
      name: 'forensic',
      use: { ...devices['Desktop Chrome'] },
      retries: 0,
      timeout: 120_000,
      testMatch: ['**/home-grid-forensic-audit.spec.ts'],
    },
  ],

  /* Auto-start API + Vite; wait for Mongo-backed `/api/health` (not bare Vite HTML). */
  webServer: {
    command: 'npm run dev:all',
    url: 'http://localhost:3000/api/health',
    reuseExistingServer: !process.env.CI, // Reuse existing server in local dev, don't in CI
    timeout: 240 * 1000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      ...process.env,
      /** Lets Playwright global-setup + establishBrowserAuthSession login without 429 storm */
      E2E_AUTH_RELAXED_LIMITS: '1',
    },
  },
});

