import { expect, test } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertAuthMe,
  assertFixtureProject,
  attachImportBatchIdRegressionGuard,
  getFixtureProjectId,
} from './helpers';

/**
 * E2E کنترل پروژه پیشرفته روی Stack واقعی (Staging).
 * Project ID از artifact قطعی Fixture خوانده می‌شود.
 * Auth از storageState setup (برای اجتناب از RATE_LIMIT ورود).
 */

const e2eDir = dirname(fileURLToPath(import.meta.url));
const editorAuth = join(e2eDir, '.auth/editor.json');
const viewerAuth = join(e2eDir, '.auth/viewer.json');
const repoRoot = join(e2eDir, '../../..');

function resolveExcelFixturePath(): string {
  const candidates = [
    join(repoRoot, 'artifacts/project-control/gantt-fixture.xlsx'),
    join(repoRoot, 'references/project-control/ساختار شکست کار بهمراه گانت چارت طرح پیشران نوآوری V03 تاریخ 1450423.xlsx'),
  ];
  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  throw new Error('فایل Excel Fixture برای E2E Upload یافت نشد.');
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

test.describe('کنترل پروژه — Editor مسیر اصلی', () => {
  test.use({ storageState: editorAuth });

  test('۱) ورود Editor و مشاهده تب کنترل پروژه پیشرفته', async ({ page }) => {
    const projectId = getFixtureProjectId();
    await assertFixtureProject(page.request, projectId);
    await page.goto(`/admin/projects/${projectId}/general`);
    await assertAuthMe(page, 'editor');
    await expect(page.getByTestId('admin-shell')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('project-control-tab')).toBeVisible({ timeout: 15_000 });
  });

  test('۲) فعال‌سازی یا ورود به Control Overview', async ({ page }) => {
    const projectId = getFixtureProjectId();
    await assertFixtureProject(page.request, projectId);
    const overviewPath = `/admin/projects/${projectId}/control/overview`;
    await page.goto(overviewPath);
    await assertAuthMe(page, 'editor');
    await expect(page).toHaveURL(new RegExp(`/admin/projects/${projectId}/control/overview$`));
    await expect(page.getByTestId('control-tabs')).toBeVisible();
    const overviewTab = page.getByTestId('control-tab-overview');
    await expect(overviewTab).toBeVisible();
    await expect(overviewTab).toHaveAttribute('href', overviewPath);
  });

  test('۳) WBS: Expand/Collapse و وجود درخت', async ({ page }) => {
    const projectId = getFixtureProjectId();
    await assertFixtureProject(page.request, projectId);
    await page.goto(`/admin/projects/${projectId}/control/wbs`);
    await assertAuthMe(page, 'editor');
    await expect(page.getByTestId('wbs-editor')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'باز کردن همه' }).click();
    await page.getByRole('button', { name: 'بستن همه' }).click();
  });

  test('۴) Import Wizard و Manifest', async ({ page }) => {
    attachImportBatchIdRegressionGuard(page);
    const projectId = getFixtureProjectId();
    await assertFixtureProject(page.request, projectId);
    await page.goto(`/admin/projects/${projectId}/control/imports`);
    await assertAuthMe(page, 'editor');
    await expect(page.getByTestId('import-wizard')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'بارگذاری و تحلیل' })).toBeVisible();
  });

  test('۴ب) Upload واقعی Excel تا مرحله Manifest با UUID معتبر', async ({ page }) => {
    test.setTimeout(90_000);
    attachImportBatchIdRegressionGuard(page);
    const projectId = getFixtureProjectId();
    await assertFixtureProject(page.request, projectId);
    const excelPath = resolveExcelFixturePath();

    const uploadResponsePromise = page.waitForResponse(
      (res) =>
        res.url().includes(`/api/v1/projects/${projectId}/control/imports/upload`) &&
        res.request().method() === 'POST',
    );
    const previewResponsePromise = page.waitForResponse(
      (res) =>
        /\/api\/v1\/projects\/[^/]+\/control\/imports\/[^/]+\/preview/.test(res.url()) &&
        res.request().method() === 'POST',
    );

    await page.goto(`/admin/projects/${projectId}/control/imports`);
    await assertAuthMe(page, 'editor');
    await expect(page.getByTestId('import-wizard')).toBeVisible({ timeout: 15_000 });

    await page.locator('input[type="file"]').setInputFiles(excelPath);
    await page.getByRole('button', { name: 'بارگذاری و تحلیل' }).click();

    const uploadRes = await uploadResponsePromise;
    expect(uploadRes.status(), 'Upload باید 201 باشد').toBe(201);
    const uploadBody = (await uploadRes.json()) as {
      importBatchId?: string;
      sourceType?: string;
    };
    expect(typeof uploadBody.importBatchId).toBe('string');
    expect(uploadBody.importBatchId && UUID_RE.test(uploadBody.importBatchId)).toBe(true);
    expect(uploadBody.sourceType).toBe('EXCEL');

    const previewRes = await previewResponsePromise;
    expect(previewRes.url()).toContain(`/imports/${uploadBody.importBatchId}/preview`);
    expect(previewRes.url()).not.toContain('/imports/undefined/');
    expect(previewRes.url()).not.toContain('/imports/null/');
    expect(previewRes.url()).not.toContain('/imports/\u005bobject Object\u005d/');
    expect(previewRes.ok(), `Preview باید موفق باشد (status=${previewRes.status()})`).toBe(true);

    await expect(
      page.getByText(/Manifest معتبر است|عدم تطابق Manifest/),
    ).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('معیار', { exact: true })).toBeVisible();
    await expect(page.getByText('مقدار واقعی', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'مرحلهٔ بعد' }).click();
    await expect(page.getByText('فازها', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('کل نودها', { exact: true })).toBeVisible();
  });

  test('۵) Gantt Editor با Zoom', async ({ page }) => {
    const projectId = getFixtureProjectId();
    await assertFixtureProject(page.request, projectId);
    await page.goto(`/admin/projects/${projectId}/control/gantt`);
    await assertAuthMe(page, 'editor');
    await expect(page.getByTestId('gantt-editor-root')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('gantt-timeline')).toBeVisible();
    await expect(page.getByTestId('gantt-task-row').first()).toBeVisible();
    await page.getByRole('button', { name: 'هفته' }).click();
  });

  test('۶) Dashboard پیشرفته Fixture بدون Crash', async ({ page }) => {
    const projectId = getFixtureProjectId();
    const fixture = await assertFixtureProject(page.request, projectId);
    await page.goto(`/dashboard/projects/${projectId}`);
    await assertAuthMe(page, 'editor');
    await expect(page.getByTestId('advanced-dashboard')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('dashboard-project-title')).toHaveText(fixture.titleFa);
    await expect(page.getByTestId('phase-card')).toHaveCount(7);
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test('۷) Fullscreen و Print controls موجودند', async ({ page }) => {
    const projectId = getFixtureProjectId();
    await assertFixtureProject(page.request, projectId);
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
    const fixture = await assertFixtureProject(page.request, projectId);
    await page.goto(`/dashboard/projects/${projectId}`);
    await assertAuthMe(page, 'viewer');
    await expect(page.getByTestId('advanced-dashboard')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('dashboard-project-title')).toHaveText(fixture.titleFa);
    await expect(page.getByTestId('phase-card')).toHaveCount(7);
    await expect(page.getByTestId('project-control-tab')).toHaveCount(0);
  });

  test('۹) Viewer به /admin دسترسی ندارد', async ({ page }) => {
    await page.goto('/admin/projects');
    await assertAuthMe(page, 'viewer');
    await expect(page.getByTestId('forbidden-notice')).toBeVisible({ timeout: 15_000 });
  });

  test('۱۰) Responsive dashboard viewports', async ({ page }) => {
    const projectId = getFixtureProjectId();
    await assertFixtureProject(page.request, projectId);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`/dashboard/projects/${projectId}`);
    await assertAuthMe(page, 'viewer');
    await expect(page.getByTestId('advanced-dashboard')).toBeVisible({ timeout: 15_000 });

    const viewports = [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
      { width: 768, height: 1024 },
      { width: 390, height: 844 },
    ] as const;

    for (const vp of viewports) {
      await page.setViewportSize(vp);
      await page.evaluate(async () => {
        await document.fonts.ready;
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });
      });
      await expect(page.getByTestId('executive-kpis')).toBeVisible();

      const titleFa = (await page.getByTestId('dashboard-project-title').innerText()).trim();
      expect(titleFa.startsWith('…') || titleFa.startsWith('...')).toBe(false);
      if (/^[A-Za-z]/.test(titleFa)) {
        expect(titleFa.charAt(0)).toMatch(/[A-Za-z]/);
      }
      const titleEn = page.getByTestId('dashboard-project-title-en');
      if (await titleEn.count()) {
        const en = (await titleEn.innerText()).trim();
        expect(en.startsWith('…') || en.startsWith('...')).toBe(false);
        expect(en.charAt(0)).toMatch(/[A-Za-z]/);
      }

      const budget = page.getByTestId('kpi-imported-budget');
      await expect(budget).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      expect(overflow, `horizontal overflow at ${vp.width}x${vp.height}`).toBe(false);

      const cardBox = await budget.boundingBox();
      const valueBox = await budget.getByTestId('metric-card-value').boundingBox();
      expect(cardBox && valueBox).toBeTruthy();
      if (cardBox && valueBox) {
        expect(valueBox.x + valueBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width + 1);
      }
    }
  });
});
