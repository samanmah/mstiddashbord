/**
 * مسیرهای Backup/State برای Deploy Production — بدون Side-effect.
 * Default زیر DEPLOY_PATH است؛ /var/backups استفاده نمی‌شود.
 */
import { isAbsolute, join, resolve } from 'node:path';

/**
 * @param {{
 *   deployPath: string,
 *   fullSha: string,
 *   timestamp: string,
 *   backupRoot?: string | null,
 * }} args
 */
export function resolveProductionBackupPaths(args) {
  const deployPath = resolve(String(args.deployPath || ''));
  if (!deployPath) {
    throw new Error('DEPLOY_PATH لازم است.');
  }
  const fullSha = String(args.fullSha || '');
  if (!/^[0-9a-f]{40}$/i.test(fullSha)) {
    throw new Error('FULL_SHA باید ۴۰ کاراکتر hex باشد.');
  }
  const timestamp = String(args.timestamp || '');
  if (!/^\d{8}T\d{6}Z$/.test(timestamp)) {
    throw new Error('TIMESTAMP باید قالب YYYYMMDDTHHMMSSZ داشته باشد.');
  }

  const backupRoot = args.backupRoot
    ? resolve(String(args.backupRoot))
    : join(deployPath, 'backups', 'production');

  if (backupRoot === '/var/backups' || backupRoot.startsWith('/var/backups/')) {
    throw new Error('BACKUP_ROOT پیش‌فرض نباید زیر /var/backups باشد.');
  }

  const backupDir = join(backupRoot, `${timestamp}-${fullSha}`);
  const stateDir = join(deployPath, 'releases', 'state', fullSha, timestamp);
  const backupFile = join(backupDir, `production-${fullSha}.dump`);

  for (const p of [backupRoot, backupDir, stateDir, backupFile]) {
    if (!isAbsolute(p)) {
      throw new Error(`مسیر باید absolute باشد: ${p}`);
    }
  }

  return {
    deployPath,
    backupRoot,
    backupDir,
    stateDir,
    backupFile,
  };
}

/**
 * Assert نوشتن روی DEPLOY_PATH و BACKUP_ROOT قبل از هر تغییر Production.
 * @param {{
 *   deployPath: string,
 *   backupRoot: string,
 *   canStatDir: (p: string) => boolean,
 *   canWriteFile: (p: string) => boolean,
 *   removeFile: (p: string) => void,
 *   fullSha: string,
 *   pid?: number | string,
 * }} args
 */
export function assertProductionWritablePaths(args) {
  if (!args.canStatDir(args.deployPath)) {
    throw new Error(`DEPLOY_PATH موجود یا قابل دسترسی نیست: ${args.deployPath}`);
  }
  // Writable directory: write-test file under backup root (پس از ایجاد والد در caller)
  const marker = join(
    args.backupRoot,
    `.write-test-${args.fullSha}-${args.pid ?? '0'}`,
  );
  if (!args.canWriteFile(marker)) {
    throw new Error(
      `BACKUP_ROOT قابل نوشتن نیست — Deploy قبل از هر تغییر متوقف شد: ${args.backupRoot}`,
    );
  }
  args.removeFile(marker);
  return { writeTestPath: marker, ok: true };
}

/** آیا مسیر پیش‌فرض ممنوع /var/backups است؟ */
export function usesForbiddenVarBackupsDefault(backupRoot) {
  const p = resolve(String(backupRoot || ''));
  return p === '/var/backups' || p.startsWith('/var/backups/');
}
