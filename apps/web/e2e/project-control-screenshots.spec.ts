import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertAuthMe, getFixtureProjectId } from './helpers';

/**
 * Screenshotهای Fixture Sanitized برای Release Candidate.
 * خروجی: artifacts/project-control/*.png
 * Password/Secret/Token در Screenshot نباید دیده شود.
 */
const OUT = join(process.cwd(), '../../artifacts/project-control');
const editorAuth = join(dirname(fileURLToPath(import.meta.url)), '.auth/editor.json');

async function waitForPaint(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });
  });
}

async function assertNoAuthFailure(page: Page): Promise<void> {
  await expect(page.locator('body')).not.toContainText('Application error');
  await expect(page.getByRole('heading', { name: /ورود به سامانه|دسترسی غیرمجاز|۴۰۳|403/i })).toHaveCount(
    0,
  );
  await expect(page).not.toHaveURL(/\/login/);
}

async function shot(
  page: Page,
  name: string,
  size?: { width: number; height: number },
): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  if (size) await page.setViewportSize(size);
  await waitForPaint(page);
  await page.screenshot({
    path: join(OUT, name),
    fullPage: false,
  });
}

async function assertDashboardLayout(page: Page): Promise<void> {
  await assertNoAuthFailure(page);
  await expect(page.getByTestId('advanced-dashboard')).toBeVisible();
  const titleFa = page.getByTestId('dashboard-project-title');
  await expect(titleFa).toBeVisible();
  const titleFaText = (await titleFa.innerText()).trim();
  expect(titleFaText.length).toBeGreaterThan(0);
  // نباید از ابتدای عبارت لاتین بریده شود (الگوی RTL truncate)
  expect(titleFaText.startsWith('…') || titleFaText.startsWith('...')).toBe(false);
  if (/^[A-Za-z]/.test(titleFaText)) {
    expect(titleFaText.charAt(0)).toMatch(/[A-Za-z]/);
  }

  const titleEn = page.getByTestId('dashboard-project-title-en');
  if (await titleEn.count()) {
    const en = (await titleEn.innerText()).trim();
    expect(en.startsWith('…') || en.startsWith('...')).toBe(false);
    expect(en.charAt(0)).toMatch(/[A-Za-z]/);
  }

  const budgetCard = page.getByTestId('kpi-imported-budget');
  await expect(budgetCard).toBeVisible();
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth > doc.clientWidth + 1;
  });
  expect(overflow, 'body نباید horizontal overflow داشته باشد').toBe(false);

  const budgetBox = await budgetCard.boundingBox();
  expect(budgetBox, 'کارت بودجه باید ابعاد داشته باشد').toBeTruthy();
  if (budgetBox) {
    const valueEl = budgetCard.locator('[data-testid="metric-card-value"]');
    const valueBox = await valueEl.boundingBox();
    expect(valueBox, 'مقدار بودجه باید دیده شود').toBeTruthy();
    if (valueBox) {
      expect(valueBox.x + valueBox.width).toBeLessThanOrEqual(budgetBox.x + budgetBox.width + 1);
      expect(valueBox.y + valueBox.height).toBeLessThanOrEqual(budgetBox.y + budgetBox.height + 1);
    }
  }
}

async function captureGanttEditor(page: Page, projectId: string): Promise<void> {
  const ganttPath = `/admin/projects/${projectId}/control/gantt`;
  await page.goto(ganttPath);
  await assertAuthMe(page, 'editor');
  await expect(page).toHaveURL(new RegExp(`/admin/projects/${projectId}/control/gantt$`));
  await assertNoAuthFailure(page);
  await expect(page.getByTestId('control-tab-gantt')).toBeVisible();
  await expect(page.getByTestId('gantt-editor-root')).toBeVisible();
  await expect(page.getByTestId('gantt-timeline')).toBeVisible();
  const rows = page.getByTestId('gantt-task-row');
  await expect(rows.first()).toBeVisible();
  expect(await rows.count(), 'حداقل یک ردیف فعالیت باید وجود داشته باشد').toBeGreaterThan(0);
  await expect(page.getByText(/فعالیت\s*1|فاز/)).toBeVisible();

  await waitForPaint(page);
  const root = page.getByTestId('gantt-editor-root');
  await root.scrollIntoViewIfNeeded();
  await waitForPaint(page);

  mkdirSync(OUT, { recursive: true });
  const outPath = join(OUT, 'gantt-editor-1920x1080.png');
  await root.screenshot({ path: outPath });

  const size = statSync(outPath).size;
  expect(size, 'Screenshot گانت نباید PNG خالی/ناچیز باشد').toBeGreaterThan(40_000);
}

test.describe('Project Control Screenshots', () => {
  test.use({ storageState: editorAuth });

  test('capture release screenshots', async ({ page }) => {
    test.setTimeout(180_000);
    const projectId = getFixtureProjectId();
    await page.goto(`/dashboard/projects/${projectId}`);
    await assertAuthMe(page, 'editor');
    await expect(page.getByTestId('advanced-dashboard')).toBeVisible({
      timeout: 20_000,
    });

    for (const [name, size] of [
      ['dashboard-1920x1080.png', { width: 1920, height: 1080 }],
      ['dashboard-1366x768.png', { width: 1366, height: 768 }],
      ['dashboard-tablet-768x1024.png', { width: 768, height: 1024 }],
      ['dashboard-mobile-390x844.png', { width: 390, height: 844 }],
    ] as const) {
      await page.setViewportSize(size);
      await waitForPaint(page);
      await assertDashboardLayout(page);
      await shot(page, name, size);
    }

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`/admin/projects/${projectId}/control/overview`);
    await expect(page.getByTestId('control-tabs')).toBeVisible({ timeout: 15_000 });
    await shot(page, 'control-overview-1920x1080.png');

    await page.goto(`/admin/projects/${projectId}/control/wbs`);
    await expect(page.getByTestId('wbs-editor')).toBeVisible({ timeout: 15_000 });
    await shot(page, 'wbs-editor-1920x1080.png');

    await page.goto(`/admin/projects/${projectId}/control/imports`);
    await expect(page.getByTestId('import-wizard')).toBeVisible({ timeout: 15_000 });
    await shot(page, 'import-manifest-1920x1080.png');

    await captureGanttEditor(page, projectId);

    await page.goto(`/dashboard/projects/${projectId}`);
    await expect(page.getByTestId('advanced-dashboard')).toBeVisible({ timeout: 15_000 });
    const ganttSection = page.getByText('گانت پروژه');
    if (await ganttSection.count()) {
      await ganttSection.scrollIntoViewIfNeeded();
    }
    await shot(page, 'gantt-viewer-1920x1080.png');

    const phaseCard = page.getByTestId('phase-card').first();
    if (await phaseCard.count()) {
      await phaseCard.click();
      await expect(page.getByTestId('phase-drilldown')).toBeVisible();
    }
    await shot(page, 'phase-drilldown-1920x1080.png');
  });
});
