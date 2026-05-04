import { defineConfig, devices } from '@playwright/test';

/**
 * Headless perf collection only — no E2E global auth setup (auth happens inside the spec).
 * Assumes `npm run dev:all` or equivalent is reachable at localhost:3000 + API health.
 *
 * Long timeout: `perf:collect` runs multiple cold passes by default (`PERF_COLLECT_RUNS`, default 3).
 */
export default defineConfig({
  testDir: './tests/perf',
  fullyParallel: false,
  workers: 1,
  timeout: 600_000,
  reporter: [['line']],
  forbidOnly: !!process.env.CI,
  use: {
    baseURL: process.env.PLAYWRIGHT_WEB_ORIGIN || 'http://localhost:3000',
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  /**
   * Performance layer projects:
   * - perf-append: feed append latency / longtask baseline
   * - perf-collect: broader local perf collector
   * - perf-sidebar-guard: focused desktop sidebar perf guard
   * - perf-home-cwv: Lighthouse median gates (LCP/CLS)
   * - perf-home-interaction: INP proxy + CLS + scroll smoothness advisory
   */
  projects: [
    {
      name: 'perf-append',
      use: { ...devices['Desktop Chrome'] },
      testMatch: ['**/home-feed-append.perf.spec.ts'],
    },
    {
      name: 'perf-collect',
      use: { ...devices['Desktop Chrome'] },
      testMatch: ['**/local-perf-collect.spec.ts'],
    },
    {
      name: 'perf-sidebar-guard',
      use: { ...devices['Desktop Chrome'] },
      testMatch: ['**/sidebar-toggle-guard.spec.ts'],
    },
    {
      name: 'perf-home-cwv',
      use: { ...devices['Desktop Chrome'] },
      testMatch: ['**/home-feed-cwv-gates.perf.spec.ts'],
    },
    {
      name: 'perf-home-interaction',
      use: { ...devices['Desktop Chrome'] },
      testMatch: ['**/home-feed-interaction-cls.perf.spec.ts'],
    },
  ],
  webServer: {
    command: 'npm run dev:all',
    url: 'http://localhost:3000/api/health',
    reuseExistingServer: true,
    timeout: 240_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      ...process.env,
      E2E_AUTH_RELAXED_LIMITS: '1',
    },
  },
});
