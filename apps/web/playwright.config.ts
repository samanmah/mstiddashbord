import { defineConfig, devices } from '@playwright/test';

/**
 * پیکربندی Playwright برای تست‌های End-to-End.
 *
 * پیش‌نیاز اجرا: پشته کامل (PostgreSQL + API + Web) باید در حال اجرا باشد.
 * می‌توانید از `docker compose up` یا اجرای محلی `pnpm dev` استفاده کنید.
 * آدرس پایه از طریق PLAYWRIGHT_BASE_URL قابل تنظیم است (پیش‌فرض http://localhost:3000).
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [['github'], ['list'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'fa-IR',
    timezoneId: 'Asia/Tehran',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } },
      testIgnore: /auth\.setup\.ts/,
    },
  ],
});
