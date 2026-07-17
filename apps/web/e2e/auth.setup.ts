import { expect, test as setup } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { login } from './helpers';

const AUTH_DIR = join(dirname(fileURLToPath(import.meta.url)), '.auth');

setup('authenticate editor', async ({ page }) => {
  mkdirSync(AUTH_DIR, { recursive: true });
  await login(page, 'editor');
  await page.context().storageState({ path: join(AUTH_DIR, 'editor.json') });
});

setup('authenticate viewer', async ({ page }) => {
  mkdirSync(AUTH_DIR, { recursive: true });
  await login(page, 'viewer');
  await page.context().storageState({ path: join(AUTH_DIR, 'viewer.json') });
  await expect(page).toHaveURL(/\/dashboard/);
});
