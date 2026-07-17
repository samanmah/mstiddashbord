import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  chmodSync,
  existsSync,
  readdirSync,
  readFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  assertProductionWritablePaths,
  resolveProductionBackupPaths,
  usesForbiddenVarBackupsDefault,
} from './production-backup-paths.mjs';

const FULL_SHA = '8ca0b95b91781e8eaf7a85db48cf5727ac1cbb78';
const TIMESTAMP = '20260717T120000Z';

describe('production-backup-paths', () => {
  it('BACKUP_ROOT پیش‌فرض زیر DEPLOY_PATH است و absolute است', () => {
    const deployPath = '/opt/ppm';
    const paths = resolveProductionBackupPaths({
      deployPath,
      fullSha: FULL_SHA,
      timestamp: TIMESTAMP,
    });
    assert.equal(paths.backupRoot, '/opt/ppm/backups/production');
    assert.equal(
      paths.backupDir,
      `/opt/ppm/backups/production/${TIMESTAMP}-${FULL_SHA}`,
    );
    assert.equal(
      paths.stateDir,
      `/opt/ppm/releases/state/${FULL_SHA}/${TIMESTAMP}`,
    );
    assert.equal(
      paths.backupFile,
      `/opt/ppm/backups/production/${TIMESTAMP}-${FULL_SHA}/production-${FULL_SHA}.dump`,
    );
    assert.ok(paths.backupRoot.startsWith(deployPath));
    assert.ok(paths.backupFile.startsWith('/'));
    assert.ok(paths.stateDir.startsWith('/'));
  });

  it('مسیر /var/backups در Default استفاده نمی‌شود', () => {
    const paths = resolveProductionBackupPaths({
      deployPath: '/opt/ppm',
      fullSha: FULL_SHA,
      timestamp: TIMESTAMP,
    });
    assert.equal(usesForbiddenVarBackupsDefault(paths.backupRoot), false);
    assert.ok(!paths.backupRoot.includes('/var/backups'));
    assert.throws(
      () =>
        resolveProductionBackupPaths({
          deployPath: '/opt/ppm',
          fullSha: FULL_SHA,
          timestamp: TIMESTAMP,
          backupRoot: '/var/backups/ppm',
        }),
      /\/var\/backups/,
    );
  });

  it('ساخت Backup directory بدون sudo روی DEPLOY_PATH موقت', () => {
    const deployPath = mkdtempSync(join(tmpdir(), 'ppm-deploy-'));
    try {
      const paths = resolveProductionBackupPaths({
        deployPath,
        fullSha: FULL_SHA,
        timestamp: TIMESTAMP,
      });
      const r = spawnSync(
        'bash',
        [
          '-c',
          [
            'set -euo pipefail',
            `install -d -m 700 "${paths.backupRoot}"`,
            `install -d -m 700 "${paths.backupDir}"`,
            `install -d -m 700 "${paths.stateDir}"`,
            `test -d "${paths.backupDir}"`,
            `test -w "${paths.backupRoot}"`,
            `WRITE_TEST="${paths.backupRoot}/.write-test-${FULL_SHA}-$$"`,
            ': > "$WRITE_TEST"',
            'rm -f "$WRITE_TEST"',
            // شبیه‌سازی فایل backup قبلی — نباید حذف شود
            `PREV="${paths.backupRoot}/pre-d817a93-20260716T200250Z.dump"`,
            'echo old > "$PREV"',
            `echo dump > "${paths.backupFile}"`,
            'test -s "$PREV"',
            `test -s "${paths.backupFile}"`,
          ].join('\n'),
        ],
        { encoding: 'utf8' },
      );
      assert.equal(r.status, 0, r.stderr || r.stdout);
      assert.ok(existsSync(join(paths.backupRoot, 'pre-d817a93-20260716T200250Z.dump')));
      assert.ok(existsSync(paths.backupFile));
      // Backup قبلی هنوز هست
      const names = readdirSync(paths.backupRoot);
      assert.ok(names.includes('pre-d817a93-20260716T200250Z.dump'));
      assert.ok(names.includes(`${TIMESTAMP}-${FULL_SHA}`));
    } finally {
      rmSync(deployPath, { recursive: true, force: true });
    }
  });

  it('unwritable BACKUP_ROOT قبل از Deploy Fail می‌شود', () => {
    const deployPath = mkdtempSync(join(tmpdir(), 'ppm-deploy-ro-'));
    try {
      const paths = resolveProductionBackupPaths({
        deployPath,
        fullSha: FULL_SHA,
        timestamp: TIMESTAMP,
      });
      mkdirSync(paths.backupRoot, { recursive: true, mode: 0o700 });
      // فقط روی Unix معنا دارد
      chmodSync(paths.backupRoot, 0o500);
      assert.throws(
        () =>
          assertProductionWritablePaths({
            deployPath,
            backupRoot: paths.backupRoot,
            fullSha: FULL_SHA,
            pid: '99',
            canStatDir: (p) => existsSync(p),
            canWriteFile: (p) => {
              try {
                writeFileSync(p, '');
                return true;
              } catch {
                return false;
              }
            },
            removeFile: () => {},
          }),
        /قابل نوشتن نیست/,
      );
    } finally {
      try {
        chmodSync(join(deployPath, 'backups', 'production'), 0o700);
      } catch {
        /* ignore */
      }
      rmSync(deployPath, { recursive: true, force: true });
    }
  });

  it('Backup قبلی با ایجاد Backup جدید حذف نمی‌شود', () => {
    const deployPath = mkdtempSync(join(tmpdir(), 'ppm-deploy-keep-'));
    try {
      const paths = resolveProductionBackupPaths({
        deployPath,
        fullSha: FULL_SHA,
        timestamp: TIMESTAMP,
      });
      mkdirSync(paths.backupRoot, { recursive: true });
      const previous = join(paths.backupRoot, 'pre-d817a93-20260716T200250Z.dump');
      writeFileSync(previous, 'keep-me');
      mkdirSync(paths.backupDir, { recursive: true });
      writeFileSync(paths.backupFile, 'new-dump');
      assert.equal(readFileSync(previous, 'utf8'), 'keep-me');
      assert.ok(existsSync(previous));
      assert.ok(existsSync(paths.backupFile));
    } finally {
      rmSync(deployPath, { recursive: true, force: true });
    }
  });
});
