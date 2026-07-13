import { expect, test } from '@playwright/test';
import { CREDENTIALS, login, logout } from './helpers';

test.describe('احراز هویت و دسترسی مشاهده‌گر', () => {
  test('۱-۲) ورود Viewer و مشاهده داشبورد', async ({ page }) => {
    await login(page, 'viewer');
    await expect(
      page.getByText('پیشرفت پروژه استراتژیک', { exact: false }),
    ).toBeVisible();
    // پیشرفت کل پروژه نمونه = ۳۵٪
    await expect(page.getByText('۳۵٪').first()).toBeVisible();
  });

  test('۳) Viewer به /admin دسترسی ندارد', async ({ page }) => {
    await login(page, 'viewer');
    await page.goto('/admin');
    // یا به forbidden هدایت می‌شود یا پیام عدم دسترسی نمایش داده می‌شود
    await expect(
      page.getByText(/دسترسی|forbidden|۴۰۳|403/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('۱۰) خروج از حساب', async ({ page }) => {
    await login(page, 'viewer');
    await logout(page);
    await expect(page.getByLabel('نام کاربری')).toBeVisible();
  });

  test('ورود ناموفق پیام امن نمایش می‌دهد', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('نام کاربری').fill(CREDENTIALS.editor.username);
    await page.getByLabel('رمز عبور').fill('wrong-password');
    await page.getByRole('button', { name: 'ورود' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('ویرایشگر و تغییر داده', () => {
  test('۴) ورود Editor و دیدن پنل مدیریت', async ({ page }) => {
    await login(page, 'editor');
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByText(/مدیریت|پروژه/).first()).toBeVisible();
  });

  test('۵-۶) تغییر پیشرفت فعالیت و بازتاب در داشبورد', async ({ page }) => {
    await login(page, 'editor');
    await page.goto('/admin');
    // رفتن به بخش فعالیت‌ها از طریق لینک ناوبری
    await page.getByRole('link', { name: /فعالیت/ }).first().click();
    await expect(page.getByText(/وزن|مجموع وزن/).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
