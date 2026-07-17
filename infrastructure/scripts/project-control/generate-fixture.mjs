/**
 * تولید فایل Excel Fixture Sanitized برای Staging/E2E.
 * خروجی: artifacts/project-control/gantt-fixture.xlsx
 * هیچ دادهٔ محرمانه/واقعی نوشته نمی‌شود.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../../..');
const require = createRequire(join(root, 'apps/api/package.json'));

// مسیر dist پس از build؛ در غیر این صورت از ts-node/register استفاده نمی‌کنیم —
// این اسکریپت انتظار دارد fixture از طریق تست/build قابل دسترسی باشد.
async function main() {
  const outDir = join(root, 'artifacts/project-control');
  await mkdir(outDir, { recursive: true });
  const outFile = join(outDir, 'gantt-fixture.xlsx');

  // بارگذاری از مسیر نسبی TypeScript کامپایل‌شده یا مستقیم از source via dynamic import of built dist
  const distPath = join(
    root,
    'apps/api/dist/modules/project-control/import/__fixtures__/gantt-fixture.js',
  );
  let buildGanttFixtureBuffer;
  try {
    ({ buildGanttFixtureBuffer } = await import(pathToFileURL(distPath).href));
  } catch {
    // Fallback: اجرای مستقیم با require از ts-jest-compiled نیست — از ExcelJS inline minimal استفاده نمی‌کنیم.
    // برای Fallback، از ts-node در اسکریپت shell استفاده شود.
    console.error(
      'dist fixture یافت نشد. ابتدا: pnpm --filter @ppm/api build\n' +
        `مسیر مورد انتظار: ${distPath}`,
    );
    process.exit(1);
  }

  const buf = await buildGanttFixtureBuffer();
  await writeFile(outFile, buf);
  console.log(`Wrote sanitized fixture: ${outFile} (${buf.length} bytes)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
