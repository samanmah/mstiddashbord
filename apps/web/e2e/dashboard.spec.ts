import { expect, test } from '@playwright/test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertAuthMe,
  assertFixtureProject,
  CREDENTIALS,
  getFixtureProjectId,
  logout,
} from './helpers';

const e2eDir = dirname(fileURLToPath(import.meta.url));
const viewerAuth = join(e2eDir, '.auth/viewer.json');
const editorAuth = join(e2eDir, '.auth/editor.json');

test.describe('احراز هویت و دسترسی مشاهده‌گر', () => {
  test.use({ storageState: viewerAuth });

  test('۱-۲) ورود Viewer و مشاهده داشبورد Fixture', async ({ page }) => {
    const projectId = getFixtureProjectId();
    const fixture = await assertFixtureProject(page.request, projectId);
    await page.goto(`/dashboard/projects/${projectId}`);
    await assertAuthMe(page, 'viewer');
    await expect(page.getByTestId('advanced-dashboard')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('dashboard-project-title')).toHaveText(fixture.titleFa);
    await expect(page.getByTestId('executive-kpis')).toBeVisible();
    await expect(page.getByText('پیشرفت برنامه‌ای', { exact: true })).toBeVisible();
    await expect(page.getByText('پیشرفت واقعی', { exact: true })).toBeVisible();
    await expect(page.getByTestId('phase-card')).toHaveCount(7);
  });

  test('۳) Viewer به /admin دسترسی ندارد', async ({ page }) => {
    await page.goto('/admin');
    await assertAuthMe(page, 'viewer');
    await expect(page.getByTestId('forbidden-notice')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('admin-shell')).toHaveCount(0);
  });

  test('Viewer دکمه ویرایش داشبورد را نمی‌بیند و دسترسی مستقیم کنترل ممنوع است', async ({
    page,
  }) => {
    const projectId = getFixtureProjectId();
    await assertFixtureProject(page.request, projectId);
    await page.goto(`/dashboard/projects/${projectId}`);
    await assertAuthMe(page, 'viewer');
    await expect(page.getByTestId('advanced-dashboard')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('executive-kpis')).toBeVisible();
    await expect(page.getByTestId('edit-project-button')).toHaveCount(0);
    await expect(page.getByTestId('edit-project-footer-link')).toHaveCount(0);

    await page.goto(`/admin/projects/${projectId}/control`);
    await assertAuthMe(page, 'viewer');
    await expect(page.getByTestId('forbidden-notice')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('admin-shell')).toHaveCount(0);
  });

  test('۱۰) خروج از حساب', async ({ page }) => {
    await page.goto('/dashboard');
    await assertAuthMe(page, 'viewer');
    await logout(page);
    await expect(page.getByLabel('نام کاربری')).toBeVisible();
  });
});

test.describe('ورود ناموفق', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

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
  test.use({ storageState: editorAuth });

  test('۴) ورود Editor و دیدن پنل مدیریت', async ({ page }) => {
    await page.goto('/admin');
    await assertAuthMe(page, 'editor');
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByTestId('admin-shell')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('forbidden-notice')).toHaveCount(0);
    await expect(page.getByTestId('admin-nav').getByText('پنل مدیریت')).toBeVisible();
  });

  test('۵-۶) فعالیت‌های پروژه Fixture در پنل مدیریت', async ({ page }) => {
    const projectId = getFixtureProjectId();
    await assertFixtureProject(page.request, projectId);
    await page.goto(`/admin/projects/${projectId}/activities`);
    await assertAuthMe(page, 'editor');
    await expect(page.getByTestId('admin-shell')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('link', { name: 'فعالیت‌ها' })).toBeVisible();
    await expect(page.getByText(/وزن|مجموع وزن|فعالیت/).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('Editor از داشبورد پیشرفته با دکمه ویرایش پروژه وارد کنترل می‌شود', async ({ page }) => {
    const projectId = getFixtureProjectId();
    await assertFixtureProject(page.request, projectId);
    await page.goto(`/dashboard/projects/${projectId}`);
    await assertAuthMe(page, 'editor');
    await expect(page.getByTestId('advanced-dashboard')).toBeVisible({ timeout: 20_000 });

    const editBtn = page.getByTestId('edit-project-button');
    await expect(editBtn).toBeVisible();
    await expect(editBtn).toHaveAccessibleName('ویرایش پروژه');
    await expect(editBtn).toHaveText('ویرایش پروژه');
    await editBtn.click();

    await expect(page).toHaveURL(new RegExp(`/admin/projects/${projectId}/control$`));
    await expect(page.getByTestId('admin-shell')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('forbidden-notice')).toHaveCount(0);
  });
});
