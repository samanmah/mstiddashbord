/* eslint-disable no-console -- فرمان CLI و خروجی استاندارد ترمینال. */
/**
 * فرمان تشخیصی محیط MPP.
 * اجرا: pnpm --filter @ppm/api project-control:mpp-check [-- --file <PATH>]
 *
 * بررسی می‌کند: وجود java در PATH، نسخهٔ Java، حضور Adapter، دسترسی فایل، نسخهٔ Parser.
 * هرگز Crash نمی‌کند و همیشه گزارش می‌دهد.
 */
import { access } from 'node:fs/promises';
import { constants as FS } from 'node:fs';
import { MPP_ADAPTER_VERSION } from '@ppm/contracts';
import { checkMppEnvironment } from '../mpp/mpp-environment';

function getFlag(name: string): string | null {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? null;
}

async function main(): Promise<void> {
  const status = await checkMppEnvironment();
  const filePath = getFlag('file');

  let fileAccessible: boolean | null = null;
  if (filePath) {
    try {
      await access(filePath, FS.R_OK);
      fileAccessible = true;
    } catch {
      fileAccessible = false;
    }
  }

  const lines = [
    '=== بررسی محیط MPP (کنترل پروژه) ===',
    `Java در PATH:        ${status.javaAvailable ? 'بله' : 'خیر'}`,
    `نسخهٔ Java:          ${status.javaVersion ?? '—'}`,
    `Adapter حاضر:        ${status.adapterPresent ? 'بله' : 'خیر'}`,
    `نسخهٔ Adapter:       ${status.adapterVersion} (${MPP_ADAPTER_VERSION})`,
    `MPXJ Helper موجود:   ${status.mpxjAvailable ? 'بله' : 'خیر'}`,
    filePath ? `دسترسی فایل:         ${fileAccessible ? 'بله' : 'خیر'} (${filePath})` : null,
    `پیام:                ${status.message}`,
  ].filter(Boolean);

  console.log(lines.join('\n'));

  // Exit code: 0 اگر محیط کامل آماده باشد؛ 3 اگر MPP در دسترس نیست (اما نه خطای اجرا).
  const ready = status.javaAvailable && status.mpxjAvailable && fileAccessible !== false;
  process.exit(ready ? 0 : 3);
}

main().catch((error) => {
  console.error('بررسی محیط MPP با خطا مواجه شد:', error instanceof Error ? error.message : error);
  process.exit(1);
});
