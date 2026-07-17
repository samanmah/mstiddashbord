/* eslint-disable no-console -- فرمان CLI و خروجی استاندارد ترمینال. */
/**
 * فرمان Import کنترل پروژه (Excel + MPP).
 *
 * Dry-Run (پیش‌فرض):
 *   pnpm --filter @ppm/api project-control:import -- \
 *     --project-id <UUID> --excel "<PATH.xlsx>" [--mpp "<PATH.mpp>"] --dry-run
 *
 * Strict Fixture (Smoke/CI):
 *   ... --dry-run --strict-fixture-manifest --report-json
 *
 * Commit:
 *   ... --commit --allow-warnings [--strict-fixture-manifest]
 *
 * قواعد:
 * - پیش‌فرض Dry-Run است؛ بدون --commit هیچ تغییری در دیتابیس ثبت نمی‌شود.
 * - Strict Fixture فقط با --strict-fixture-manifest (یا ENV) فعال می‌شود.
 * - فایل خام یا اطلاعات حساس در Log چاپ نمی‌شود.
 * - Exit Code: 0 موفق، 2 خطای اعتبارسنجی/بحرانی، 1 خطای اجرا.
 */
import { NestFactory } from '@nestjs/core';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { ControlImportSourceType } from '@ppm/contracts';
import { AppModule } from '../../../../app.module';
import { ControlImportService } from '../control-import.service';
import { MPP_ADAPTER, type MppAdapter } from '../mpp/mpp-adapter.interface';
import { buildImportPreviewReport, parseImportCliFlags } from './import-cli-report';

function log(msg: string): void {
  console.log(msg);
}

async function main(): Promise<number> {
  const flags = parseImportCliFlags(process.argv);
  const {
    projectId,
    excelPath,
    mppPath,
    doCommit,
    allowWarnings,
    strictFixtureManifest,
    reportJson,
  } = flags;

  if (!projectId) {
    log('خطا: --project-id الزامی است.');
    return 1;
  }
  if (!excelPath) {
    log('خطا: --excel <PATH> الزامی است.');
    return 1;
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const service = app.get(ControlImportService);
    const mppAdapter = app.get<MppAdapter>(MPP_ADAPTER);
    const ctx = { userId: null, ipAddress: 'cli', userAgent: 'project-control:import' };

    const buffer = await readFile(excelPath);
    const originalname = basename(excelPath);

    log(`حالت: ${doCommit ? 'COMMIT' : 'DRY-RUN'}`);
    if (strictFixtureManifest) {
      log('Strict Fixture Manifest: فعال');
    }
    log('در حال بارگذاری و تجزیهٔ Excel...');
    const { importBatchId } = await service.upload(
      projectId,
      { originalname, buffer },
      ControlImportSourceType.EXCEL,
      ctx,
    );
    const preview = await service.preview(projectId, importBatchId, !doCommit, ctx, {
      strictFixtureManifest,
    });

    // چاپ Manifest
    log('\n=== Manifest ===');
    for (const c of preview.manifestChecks) {
      log(`${c.ok ? '✓' : '✗'} ${c.key}: انتظار ${c.expected} | واقعی ${c.actual}`);
    }
    log(
      `\nنودها: فاز=${preview.counts.phases} Break1=${preview.counts.break1} ` +
        `فعالیت=${preview.counts.tasks} کل=${preview.counts.totalNodes}`,
    );
    log(
      `خطاها: بحرانی=${preview.criticalCount} هشدار=${preview.warningCount} ` +
        `اطلاع=${preview.infoCount} orphan=${preview.orphanCount}`,
    );
    if (preview.conflicts.length > 0) {
      log(`\n=== Conflictها (${preview.conflicts.length}) ===`);
      for (const cf of preview.conflicts.slice(0, 50)) {
        log(`سطر ${cf.sourceRow}: ${cf.reason}`);
      }
    }

    if (reportJson) {
      const report = buildImportPreviewReport(preview);
      log(`IMPORT_PREVIEW_JSON=${JSON.stringify(report)}`);
    }

    // MPP (اختیاری) — بدون Java به‌صورت کنترل‌شده مدیریت می‌شود.
    if (mppPath) {
      const env = await mppAdapter.checkEnvironment();
      log(`\n=== MPP ===\n${env.message}`);
      if (env.javaAvailable && env.mpxjAvailable) {
        try {
          const mpp = await mppAdapter.parse(mppPath);
          log(`Taskهای MPP: ${mpp.tasks.length} | روابط: ${mpp.dependencies.length}`);
        } catch (error) {
          log(`تجزیهٔ MPP انجام نشد: ${error instanceof Error ? error.message : 'نامشخص'}`);
        }
      } else {
        log('MPP نادیده گرفته شد (محیط آماده نیست).');
      }
    }

    if (!doCommit) {
      log('\nDry-Run کامل شد — هیچ داده‌ای در WBS ذخیره نشد.');
      return preview.canCommit ? 0 : 2;
    }

    if (!preview.canCommit) {
      log('\nخطای بحرانی مانع Commit شد.');
      return 2;
    }

    log('\nدر حال Commit اتمیک...');
    const result = await service.commit(projectId, importBatchId, allowWarnings, ctx);
    log(
      `Commit موفق: نودهای ساخته‌شده=${result.createdNodes} ` +
        `ControlPlan=${result.controlPlanId} Batch=${result.importBatchId}`,
    );
    return 0;
  } finally {
    await app.close();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error('اجرای Import با خطا مواجه شد:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
