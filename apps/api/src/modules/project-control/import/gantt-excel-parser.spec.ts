import { EXPECTED_EXCEL_MANIFEST, ImportIssueCode, ImportIssueLevel } from '@ppm/contracts';
import { buildGanttFixtureBuffer } from './__fixtures__/gantt-fixture';
import { GanttExcelParserService } from './gantt-excel-parser.service';
import { compareManifest, manifestIsValid } from './manifest-validator';

describe('GanttExcelParserService (Fixture کامل)', () => {
  const parser = new GanttExcelParserService();
  let manifest: Awaited<ReturnType<GanttExcelParserService['parse']>>;

  beforeAll(async () => {
    const buffer = await buildGanttFixtureBuffer();
    manifest = await parser.parse(buffer);
  });

  it('Manifest دقیقاً با مقادیر مورد انتظار منطبق است', () => {
    const checks = compareManifest(manifest.manifest);
    const failed = checks.filter((c) => !c.ok);
    expect(failed).toEqual([]);
    expect(manifestIsValid(checks)).toBe(true);
  });

  it('شمارش‌های کلیدی', () => {
    expect(manifest.manifest.phaseCount).toBe(EXPECTED_EXCEL_MANIFEST.phaseCount);
    expect(manifest.manifest.break1Count).toBe(EXPECTED_EXCEL_MANIFEST.break1Count);
    expect(manifest.manifest.sourceRowCount).toBe(142);
    expect(manifest.manifest.perPhaseCounts).toEqual([13, 18, 12, 13, 65, 10, 11]);
    expect(manifest.manifest.periodCount).toBe(147);
    expect(manifest.manifest.totalDays).toBe(620);
    expect(manifest.manifest.totalMonths).toBe(21);
  });

  it('بودجه: ۵ ردیف و جمع دقیق', () => {
    expect(manifest.manifest.budgetRowCount).toBe(5);
    expect(manifest.manifest.budgetTotal).toBe(929_875_000_000);
  });

  it('مسئول/DOD/پیشرفت', () => {
    expect(manifest.manifest.ownerCount).toBe(65);
    expect(manifest.manifest.dodCount).toBe(48);
    expect(manifest.manifest.progressCount).toBe(104);
  });

  it('تاریخ‌ها: غیرخالی/معتبر و بازه', () => {
    expect(manifest.manifest.startNonEmpty).toBe(65);
    expect(manifest.manifest.startValid).toBe(60);
    expect(manifest.manifest.finishNonEmpty).toBe(65);
    expect(manifest.manifest.finishValid).toBe(60);
    expect(manifest.manifest.dateMin).toBe('1404/09/01');
    expect(manifest.manifest.dateMax).toBe('1406/12/10');
  });

  it('۱۰ هشدار تاریخ نامعتبر ثبت می‌شود (۵ شروع + ۵ پایان)', () => {
    const invalid = manifest.issues.filter((i) => i.code === ImportIssueCode.INVALID_DATE);
    expect(invalid).toHaveLength(10);
    expect(invalid.every((i) => i.level === ImportIssueLevel.WARNING)).toBe(true);
  });

  it('هیچ خطای بحرانی ساختاری وجود ندارد', () => {
    const critical = manifest.issues.filter((i) => i.level === ImportIssueLevel.CRITICAL);
    expect(critical).toEqual([]);
  });
});
