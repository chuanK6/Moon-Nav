import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  use: { baseURL: 'http://127.0.0.1:8788', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1050 } } }],
  webServer: { command: 'npm run preview', url: 'http://127.0.0.1:8788/api/public/sites', reuseExistingServer: !process.env.CI, timeout: 60_000 },
});
