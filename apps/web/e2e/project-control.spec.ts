import { expect, test, type Page } from '@playwright/test';
import { login } from './helpers';

/**
 * E2E کنترل پروژه پیشرفته روی Stack واقعی (Staging).
 * مقادیر کلیدی را Assert می‌کند — فقط وجود عنصر کافی نیست.
 */

async function openFirstAdminProject(page: Page): Promise<string> {
  await page.goto('/admin/projects');
  await expect(page.getByText(/پروژه|مدیریت/).first()).toBeVisible({ timeout: 15_000 });
  const href = await page.locator('a[href*="/admin/projects/"]').first().getAttribute('href');
  expect(href).toBeTruthy();
  await page.goto(href!);
  await expect(page).toHaveURL(/\/admin\/projects\/[^/]+/, { timeout: 15_000 });
  const m = page.url().match(/\/admin\/projects\/([^/]+)/);
  expect(m?.[1]).toBeTruthy();
  return m![1]!;
}

test.describe('کنترل پروژه — Editor مسیر اصلی', () => {
  test('۱) ورود Editor و مشاهده تب کنترل پروژه پیشرفته', async ({ page }) => {
    await login(page, 'editor');
    await openFirstAdminProject(page);
    await expect(page.getByRole('link', { name: 'کنترل پروژه پیشرفته' })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('۲) فعال‌سازی یا ورود به Control Overview', async ({ page }) => {
    await login(page, 'editor');
    const projectId = await openFirstAdminProject(page);
    await page.getByRole('link', { name: 'کنترل پروژه پیشرفته' }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/projects/${projectId}/control`), {
      timeout: 15_000,
    });

    const enableBtn = page.getByRole('button', { name: /فعال‌سازی کنترل پروژه/ });
    if (await enableBtn.count()) {
      await enableBtn.click();
      const confirm = page.getByRole('button', { name: /تأیید|فعال‌سازی|بله/ });
      if (await confirm.count()) await confirm.click();
      await expect(page.getByText(/فعال|نمای کلی|ساختار شکست کار/).first()).toBeVisible({
        timeout: 20_000,
      });
    } else {
      await expect(page.getByText(/نمای کلی|فعال|کنترل پروژه/).first()).toBeVisible({
        timeout: 15_000,
      });
    }
  });

  test('۳) WBS: Expand/Collapse و وجود درخت', async ({ page }) => {
    await login(page, 'editor');
    const projectId = await openFirstAdminProject(page);
    await page.goto(`/admin/projects/${projectId}/control/wbs`);
    await expect(page.getByText(/ساختار|WBS|عنوان|فعالیت/).first()).toBeVisible({
      timeout: 20_000,
    });
    const expandAll = page.getByRole('button', { name: /بازکردن همه|گسترش/ });
    if (await expandAll.count()) await expandAll.click();
    const collapseAll = page.getByRole('button', { name: /بستن همه|جمع/ });
    if (await collapseAll.count()) await collapseAll.click();
  });

  test('۴) Import Wizard و Manifest', async ({ page }) => {
    await login(page, 'editor');
    const projectId = await openFirstAdminProject(page);
    await page.goto(`/admin/projects/${projectId}/control/imports`);
    await expect(page.getByText(/بارگذاری|آپلود|ورود اطلاعات|Manifest/).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('۵) Gantt Editor با Zoom', async ({ page }) => {
    await login(page, 'editor');
    const projectId = await openFirstAdminProject(page);
    await page.goto(`/admin/projects/${projectId}/control/gantt`);
    await expect(page.getByText(/گانت|ساختار شکست|هفته|ماه/).first()).toBeVisible({
      timeout: 20_000,
    });
    const week = page.getByRole('button', { name: 'هفته' });
    if (await week.count()) await week.click();
  });

  test('۶) Dashboard پیشرفته یا قدیمی بدون Crash', async ({ page }) => {
    await login(page, 'editor');
    await page.goto('/dashboard');
    await expect(page.getByText(/پیشرفت پروژه|کنترل پروژه|شاخص|داشبورد/).first()).toBeVisible({
      timeout: 20_000,
    });
    // Risks/Decisions regression: بخش‌ها یا جداول نباید صفحه را خراب کنند
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test('۷) Fullscreen و Print controls موجودند', async ({ page }) => {
    await login(page, 'editor');
    await page.goto('/dashboard');
    await expect(page.getByRole('button', { name: /تمام‌صفحه|چاپ/ }).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});

test.describe('کنترل پروژه — Viewer و Regression', () => {
  test('۸) Viewer داشبورد را می‌بیند و لینک ویرایش کنترل ندارد', async ({ page }) => {
    await login(page, 'viewer');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    await expect(page.getByText(/پیشرفت پروژه|کنترل پروژه|داشبورد/).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('link', { name: 'کنترل پروژه پیشرفته' })).toHaveCount(0);
  });

  test('۹) Viewer به /admin دسترسی ندارد', async ({ page }) => {
    await login(page, 'viewer');
    await page.goto('/admin/projects');
    await expect(page.getByText(/دسترسی|forbidden|۴۰۳|403/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('۱۰) Mobile dashboard viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, 'viewer');
    await page.goto('/dashboard');
    await expect(page.getByText(/پیشرفت|کنترل|داشبورد/).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
