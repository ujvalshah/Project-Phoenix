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
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
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
