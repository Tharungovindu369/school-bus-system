import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // Run serially because we interact with a live DB (Google Sheets API) with rate limits
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: 1, // Restrict to 1 worker to avoid race conditions with rate limits
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
