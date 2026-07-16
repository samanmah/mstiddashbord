import { expect, type Page } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { UserRole } from '@ppm/contracts';

export const CREDENTIALS = {
  editor: {
    username: process.env.E2E_EDITOR_USERNAME ?? 'editor',
    password: process.env.E2E_EDITOR_PASSWORD ?? 'Editor@Passw0rd!',
  },
  viewer: {
    username: process.env.E2E_VIEWER_USERNAME ?? 'viewer',
    password: process.env.E2E_VIEWER_PASSWORD ?? 'Viewer@Passw0rd!',
  },
};

const EXPECTED_ROLE = {
  editor: UserRole.PROJECT_EDITOR,
  viewer: UserRole.MANAGER_VIEWER,
} as const;

/**
 * Project ID قطعی Fixture Staging از artifact.
 * مسیر نسبت به cwd=apps/web هنگام اجرای Playwright.
 */
export function getFixtureProjectId(): string {
  const fromEnv = process.env.E2E_FIXTURE_PROJECT_ID?.trim();
  if (fromEnv) return fromEnv;

  const candidates = [
    join(process.cwd(), '../../artifacts/project-control/staging-project-id.txt'),
    join(process.cwd(), 'artifacts/project-control/staging-project-id.txt'),
    join(process.cwd(), '../artifacts/project-control/staging-project-id.txt'),
  ];
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    const id = readFileSync(path, 'utf8').trim();
    if (id) return id;
  }
  throw new Error(
    'Fixture project ID یافت نشد. ابتدا import-fixture.sh را اجرا کنید یا E2E_FIXTURE_PROJECT_ID را تنظیم کنید.',
  );
}

/** Assert قرارداد /auth/me برای نقش فعلی (بدون چاپ Secret/Cookie). */
export async function assertAuthMe(
  page: Page,
  role: 'editor' | 'viewer',
): Promise<void> {
  const creds = CREDENTIALS[role];
  const meResponse = await page.request.get('/api/v1/auth/me');
  expect(meResponse.status(), 'GET /api/v1/auth/me باید 200 باشد').toBe(200);
  const body = (await meResponse.json()) as {
    user?: { username?: string; role?: string };
  };
  expect(body.user, 'پاسخ /auth/me باید شامل user باشد').toBeTruthy();
  expect(body.user?.username).toBe(creds.username);
  expect(body.user?.role).toBe(EXPECTED_ROLE[role]);
}

/**
 * ورود از طریق فرم لاگین.
 * در صورت RATE_LIMITED حداکثر ۲ بار با فاصلهٔ امن Retry می‌کند (throttle بک‌اند ۱۰/دقیقه است).
 */
export async function login(
  page: Page,
  role: 'editor' | 'viewer',
): Promise<void> {
  const creds = CREDENTIALS[role];
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await page.goto('/login');
    await page.getByLabel('نام کاربری').fill(creds.username);
    await page.getByLabel('رمز عبور').fill(creds.password);
    await page.getByRole('button', { name: 'ورود' }).click();

    try {
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
      await assertAuthMe(page, role);
      return;
    } catch (error) {
      lastError = error;
      const alertText = (await page.getByRole('alert').textContent().catch(() => '')) ?? '';
      const rateLimited = /محدود|rate|تعداد درخواست|۴۲۹|429/i.test(alertText);
      if (!rateLimited || attempt === 3) break;
      // صبر تا پنجرهٔ throttle بک‌اند (۶۰s) تمام شود — Secret چاپ نمی‌شود.
      await page.waitForTimeout(65_000);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`ورود ${role} ناموفق بود.`);
}

/** خروج از حساب کاربری. */
export async function logout(page: Page): Promise<void> {
  const logoutBtn = page.getByTestId('logout-button');
  if (await logoutBtn.count()) {
    await logoutBtn.click();
  } else {
    await page.getByRole('button', { name: 'خروج' }).click();
  }
  await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
}
