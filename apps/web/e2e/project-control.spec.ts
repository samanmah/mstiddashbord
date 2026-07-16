import { expect, test } from '@playwright/test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertAuthMe, getFixtureProjectId } from './helpers';

/**
 * E2E کنترل پروژه پیشرفته روی Stack واقعی (Staging).
 * Project ID از artifact قطعی Fixture خوانده می‌شود.
 * Auth از storageState setup (برای اجتناب از RATE_LIMIT ورود).
 */

const e2eDir = dirname(fileURLToPath(import.meta.url));
const editorAuth = join(e2eDir, '.auth/editor.json');
const viewerAuth = join(e2eDir, '.auth/viewer.json');

test.describe('کنترل پروژه — Editor مسیر اصلی', () => {
  test.use({ storageState: editorAuth });

  test('۱) ورود Editor و مشاهده تب کنترل پروژه پیشرفته', async ({ page }) => {
    const projectId = getFixtureProjectId();
    await page.goto(`/admin/projects/${projectId}/general`);
    await assertAuthMe(page, 'editor');
    await expect(page.getByTestId('admin-shell')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('project-control-tab')).toBeVisible({ timeout: 15_000 });
  });

  test('۲) فعال‌سازی یا ورود به Control Overview', async ({ page }) => {
    const projectId = getFixtureProjectId();
    await page.goto(`/admin/projects/${projectId}/control`);
    await assertAuthMe(page, 'editor');
    await expect(page).toHaveURL(new RegExp(`/admin/projects/${projectId}/control`), {
      timeout: 15_000,
    });

    const enableBtn = page.getByRole('button', { name: /فعال‌سازی کنترل پروژه/ });
    if (await enableBtn.count()) {
      await enableBtn.click();
      const confirm = page.getByRole('button', { name: /تأیید|فعال‌سازی|بله/ });
      if (await confirm.count()) await confirm.click();
    }

    await expect(page.getByTestId('control-tabs')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('control-tab-overview')).toBeVisible();
  });

  test('۳) WBS: Expand/Collapse و وجود درخت', async ({ page }) => {
    const projectId = getFixtureProjectId();
    await page.goto(`/admin/projects/${projectId}/control/wbs`);
    await assertAuthMe(page, 'editor');
    await expect(page.getByTestId('wbs-editor')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'باز کردن همه' }).click();
    await page.getByRole('button', { name: 'بستن همه' }).click();
  });

  test('۴) Import Wizard و Manifest', async ({ page }) => {
    const projectId = getFixtureProjectId();
    await page.goto(`/admin/projects/${projectId}/control/imports`);
    await assertAuthMe(page, 'editor');
    await expect(page.getByTestId('import-wizard')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'بارگذاری و تحلیل' })).toBeVisible();
  });

  test('۵) Gantt Editor با Zoom', async ({ page }) => {
    const projectId = getFixtureProjectId();
    await page.goto(`/admin/projects/${projectId}/control/gantt`);
    await assertAuthMe(page, 'editor');
    await expect(page.getByTestId('gantt-chart')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'هفته' }).click();
  });

  test('۶) Dashboard پیشرفته Fixture بدون Crash', async ({ page }) => {
    const projectId = getFixtureProjectId();
    await page.goto(`/dashboard/projects/${projectId}`);
    await assertAuthMe(page, 'editor');
    await expect(page.getByTestId('advanced-dashboard')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'Staging Control Project' })).toBeVisible();
    await expect(page.getByTestId('phase-card')).toHaveCount(7);
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test('۷) Fullscreen و Print controls موجودند', async ({ page }) => {
    const projectId = getFixtureProjectId();
    await page.goto(`/dashboard/projects/${projectId}`);
    await assertAuthMe(page, 'editor');
    const dash = page.getByTestId('advanced-dashboard');
    await expect(dash).toBeVisible({ timeout: 15_000 });
    await expect(dash.getByRole('button', { name: 'تمام‌صفحه' }).first()).toBeVisible();
    await expect(dash.getByRole('button', { name: 'چاپ / PDF' })).toBeVisible();
  });
});

test.describe('کنترل پروژه — Viewer و Regression', () => {
  test.use({ storageState: viewerAuth });

  test('۸) Viewer داشبورد Fixture را می‌بیند و لینک ویرایش کنترل ندارد', async ({ page }) => {
    const projectId = getFixtureProjectId();
    await page.goto(`/dashboard/projects/${projectId}`);
    await assertAuthMe(page, 'viewer');
    await expect(page.getByTestId('advanced-dashboard')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('phase-card')).toHaveCount(7);
    await expect(page.getByTestId('project-control-tab')).toHaveCount(0);
  });

  test('۹) Viewer به /admin دسترسی ندارد', async ({ page }) => {
    await page.goto('/admin/projects');
    await assertAuthMe(page, 'viewer');
    await expect(page.getByTestId('forbidden-notice')).toBeVisible({ timeout: 15_000 });
  });

  test('۱۰) Mobile dashboard viewport', async ({ page }) => {
    const projectId = getFixtureProjectId();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/dashboard/projects/${projectId}`);
    await assertAuthMe(page, 'viewer');
    await expect(page.getByTestId('advanced-dashboard')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('executive-kpis')).toBeVisible();
  });
});
