import { defineConfig, devices } from '@playwright/test';
import 'dotenv/config';

const BASE_URL = process.env.QA_BASE_URL || 'http://localhost:8100';

export default defineConfig({
  testDir: './specs',
  outputDir: './report/artifacts',
  fullyParallel: false,          // shared seeded DB — keep ordering predictable
  workers: 1,
  forbidOnly: !!process.env.CI,
  // shared mutable DB: a rare transient (lock timeout, checkpoint) can hit one
  // API call - one retry keeps the run stable without masking real failures.
  retries: process.env.CI ? 2 : 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'report/playwright', open: 'never' }],
    ['json', { outputFile: 'report/results.json' }],
    ['./reporters/perf-reporter.ts'],
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
