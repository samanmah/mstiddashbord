import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { login } from './helpers';

/**
 * Screenshotهای Fixture Sanitized برای Release Candidate.
 * خروجی: artifacts/project-control/*.png
 * Password/Secret/Token در Screenshot نباید دیده شود.
 */
const OUT = join(process.cwd(), '../../artifacts/project-control');

async function shot(page: import('@playwright/test').Page, name: string, size?: { width: number; height: number }) {
  mkdirSync(OUT, { recursive: true });
  if (size) await page.setViewportSize(size);
  await page.screenshot({
    path: join(OUT, name),
    fullPage: false,
  });
}

test.describe('Project Control Screenshots', () => {
  test('capture release screenshots', async ({ page }) => {
    test.setTimeout(180_000);
    await login(page, 'editor');

    // Dashboard
    await page.goto('/dashboard');
    await expect(page.getByText(/پیشرفت پروژه|کنترل پروژه|داشبورد/).first()).toBeVisible({
      timeout: 20_000,
    });
    await shot(page, 'dashboard-1920x1080.png', { width: 1920, height: 1080 });
    await shot(page, 'dashboard-1366x768.png', { width: 1366, height: 768 });
    await shot(page, 'dashboard-tablet-768x1024.png', { width: 768, height: 1024 });
    await shot(page, 'dashboard-mobile-390x844.png', { width: 390, height: 844 });

    // Admin projects → control
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/admin/projects');
    const link = page.getByRole('link').filter({ hasText: /مشاهده|جزئیات|ویرایش/ }).first();
    if (await link.count()) {
      await link.click();
    } else {
      // fallback: first project row link
      await page.locator('a[href*="/admin/projects/"]').first().click();
    }
    await expect(page).toHaveURL(/\/admin\/projects\/[^/]+/, { timeout: 15_000 });

    const controlTab = page.getByRole('link', { name: 'کنترل پروژه پیشرفته' });
    if (await controlTab.count()) {
      await controlTab.click();
      await page.waitForTimeout(1000);

      // Overview
      if (page.url().includes('/control')) {
        await page.goto(page.url().replace(/\/control.*/, '/control/overview'));
        await page.waitForTimeout(800);
        await shot(page, 'control-overview-1920x1080.png');

        await page.goto(page.url().replace(/\/control.*/, '/control/wbs'));
        await page.waitForTimeout(800);
        await shot(page, 'wbs-editor-1920x1080.png');

        await page.goto(page.url().replace(/\/control.*/, '/control/imports'));
        await page.waitForTimeout(800);
        await shot(page, 'import-manifest-1920x1080.png');

        await page.goto(page.url().replace(/\/control.*/, '/control/gantt'));
        await page.waitForTimeout(1000);
        await shot(page, 'gantt-editor-1920x1080.png');
      }
    }

    // Viewer gantt / dashboard gantt
    await page.goto('/dashboard');
    await page.waitForTimeout(1000);
    const ganttSection = page.getByText('گانت پروژه');
    if (await ganttSection.count()) {
      await ganttSection.scrollIntoViewIfNeeded();
      await shot(page, 'gantt-viewer-1920x1080.png');
    } else {
      await shot(page, 'gantt-viewer-1920x1080.png');
    }

    // Phase drilldown if available
    const phaseCard = page.getByRole('button').filter({ hasText: /فاز|Phase/ }).first();
    if (await phaseCard.count()) {
      await phaseCard.click();
      await page.waitForTimeout(500);
      await shot(page, 'phase-drilldown-1920x1080.png');
    } else {
      await shot(page, 'phase-drilldown-1920x1080.png');
    }
  });
});
