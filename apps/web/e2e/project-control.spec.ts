import { expect, test, type Page } from '@playwright/test';
import { login } from './helpers';

/**
 * تست‌های End-to-End کنترل پروژه پیشرفته (Checkpoint 1).
 *
 * پیش‌نیاز: پشته کامل (PostgreSQL + API + Web) در حال اجرا و حداقل یک پروژه موجود باشد.
 * این تست‌ها با کاربر Editor و Viewer اجرا می‌شوند.
 */

/** یافتن اولین پروژه از فهرست مدیریت پروژه‌ها و بازگرداندن شناسه آن. */
async function openFirstProjectControl(page: Page): Promise<void> {
  await page.goto('/admin/projects');
  const firstProjectLink = page
    .getByRole('link', { name: /مشاهده|ویرایش|جزئیات/ })
    .first();
  await firstProjectLink.click();
  await expect(page).toHaveURL(/\/admin\/projects\/[^/]+/, { timeout: 15_000 });
}

test.describe('کنترل پروژه پیشرفته - ویرایشگر', () => {
  test('۱) ورود Editor و دیدن تب کنترل پروژه پیشرفته', async ({ page }) => {
    await login(page, 'editor');
    await openFirstProjectControl(page);
    await expect(
      page.getByRole('link', { name: 'کنترل پروژه پیشرفته' }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('۲) ورود به بخش کنترل و مشاهده معرفی یا نمای کلی', async ({ page }) => {
    await login(page, 'editor');
    await openFirstProjectControl(page);
    await page.getByRole('link', { name: 'کنترل پروژه پیشرفته' }).click();
    await expect(page).toHaveURL(/\/control(\/overview)?$/, { timeout: 15_000 });
    // یا صفحه فعال‌سازی یا نمای کلی نمایش داده می‌شود
    await expect(
      page.getByText(/فعال‌سازی کنترل پروژه|نمای کلی|کنترل پروژه/).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('۳) دسترسی به Wizard ورود اطلاعات', async ({ page }) => {
    await login(page, 'editor');
    await openFirstProjectControl(page);
    const url = page.url();
    await page.goto(`${url}/control/imports`);
    // یا Wizard آپلود یا صفحه فعال‌سازی
    await expect(
      page.getByText(/بارگذاری|آپلود|فعال‌سازی کنترل پروژه/).first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('کنترل پروژه پیشرفته - مشاهده‌گر', () => {
  test('۴) Viewer نباید لینک ویرایشی کنترل پروژه را ببیند', async ({ page }) => {
    await login(page, 'viewer');
    await page.goto('/admin');
    // Viewer به admin دسترسی ندارد؛ نباید لینک کنترل پروژه پیشرفته دیده شود
    await expect(
      page.getByRole('link', { name: 'کنترل پروژه پیشرفته' }),
    ).toHaveCount(0);
  });

  test('۵) Viewer نمی‌تواند مستقیم به مسیر ویرایش کنترل دسترسی داشته باشد', async ({
    page,
  }) => {
    await login(page, 'viewer');
    await page.goto('/admin/projects');
    await expect(
      page.getByText(/دسترسی|forbidden|۴۰۳|403/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('۶) Viewer داشبورد را می‌بیند (پیشرفته یا قدیمی بدون خطا)', async ({ page }) => {
    await login(page, 'viewer');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    // داشبورد بدون Crash بارگذاری می‌شود؛ عنوان پروژه یا هدر دیده می‌شود
    await expect(
      page.getByText(/پیشرفت پروژه|کنترل پروژهٔ پیشرفته|داشبورد/).first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});
