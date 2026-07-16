import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
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

async function shot(page: import('@playwright/test').Page, name: string, size?: { width: number; height: number }) {
  mkdirSync(OUT, { recursive: true });
  if (size) await page.setViewportSize(size);
  await page.screenshot({
    path: join(OUT, name),
    fullPage: false,
  });
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
    await shot(page, 'dashboard-1920x1080.png', { width: 1920, height: 1080 });
    await shot(page, 'dashboard-1366x768.png', { width: 1366, height: 768 });
    await shot(page, 'dashboard-tablet-768x1024.png', { width: 768, height: 1024 });
    await shot(page, 'dashboard-mobile-390x844.png', { width: 390, height: 844 });

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

    await page.goto(`/admin/projects/${projectId}/control/gantt`);
    await expect(page.getByTestId('gantt-chart')).toBeVisible({ timeout: 15_000 });
    await shot(page, 'gantt-editor-1920x1080.png');

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
      await page.waitForTimeout(500);
    }
    await shot(page, 'phase-drilldown-1920x1080.png');
  });
});
