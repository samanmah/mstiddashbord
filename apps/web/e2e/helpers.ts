import { expect, type Page } from '@playwright/test';

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

/** ورود از طریق فرم لاگین و انتظار برای رسیدن به داشبورد. */
export async function login(
  page: Page,
  role: 'editor' | 'viewer',
): Promise<void> {
  const creds = CREDENTIALS[role];
  await page.goto('/login');
  await page.getByLabel('نام کاربری').fill(creds.username);
  await page.getByLabel('رمز عبور').fill(creds.password);
  await page.getByRole('button', { name: 'ورود' }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
}

/** خروج از حساب کاربری. */
export async function logout(page: Page): Promise<void> {
  await page.getByRole('button', { name: /خروج/ }).first().click();
  await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
}
