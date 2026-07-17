import {
  EXPECTED_EXCEL_MANIFEST,
  ImportIssueCode,
  ImportIssueLevel,
  normalizeCellString,
} from '@ppm/contracts';
import {
  buildGanttFixtureBuffer,
  buildSanitizedEdgeFixtureBuffer,
} from './__fixtures__/gantt-fixture';
import { GanttExcelParserService } from './gantt-excel-parser.service';
import {
  compareManifest,
  countOrphans,
  manifestIsValid,
  shouldRunStrictFixtureValidation,
  validateStructural,
} from './manifest-validator';
import { buildWbsTree } from './wbs-tree-builder';

describe('GanttExcelParserService (Fixture کامل)', () => {
  const parser = new GanttExcelParserService();
  let parsed: Awaited<ReturnType<GanttExcelParserService['parse']>>;

  beforeAll(async () => {
    const buffer = await buildGanttFixtureBuffer();
    parsed = await parser.parse(buffer);
  });

  it('Strict Fixture Manifest فقط با option فعال می‌شود و منطبق است', () => {
    expect(shouldRunStrictFixtureValidation({})).toBe(false);
    expect(shouldRunStrictFixtureValidation({ strictFixtureManifest: true })).toBe(true);
    const checks = compareManifest(parsed.manifest);
    const failed = checks.filter((c) => !c.ok);
    expect(failed).toEqual([]);
    expect(manifestIsValid(checks)).toBe(true);
  });

  it('Structural validation بدون Strict PASS است', () => {
    const tree = buildWbsTree(parsed.rows, 'root');
    const structural = validateStructural(parsed, tree);
    expect(structural.ok).toBe(true);
    expect(structural.orphanCount).toBe(0);
  });

  it('شمارش‌های کلیدی Fixture', () => {
    expect(parsed.manifest.phaseCount).toBe(EXPECTED_EXCEL_MANIFEST.phaseCount);
    expect(parsed.manifest.break1Count).toBe(EXPECTED_EXCEL_MANIFEST.break1Count);
    expect(parsed.manifest.sourceRowCount).toBe(142);
    expect(parsed.manifest.perPhaseCounts).toEqual([13, 18, 12, 13, 65, 10, 11]);
    expect(parsed.manifest.periodCount).toBe(147);
    expect(parsed.manifest.totalDays).toBe(620);
    expect(parsed.manifest.totalMonths).toBe(21);
  });

  it('بودجه: شش ردیف (۵ مثبت + صفر) و جمع دقیق', () => {
    expect(parsed.manifest.budgetRowCount).toBe(6);
    expect(parsed.manifest.budgetTotal).toBe(929_875_000_000);
    expect(parsed.rows.some((r) => r.budgetAmount === 0)).toBe(true);
  });

  it('مسئول/DOD/پیشرفت', () => {
    expect(parsed.manifest.ownerCount).toBe(65);
    expect(parsed.manifest.dodCount).toBe(48);
    expect(parsed.manifest.progressCount).toBe(104);
  });

  it('تاریخ‌ها: "-" → null؛ فقط ۶۰ غیرخالی/معتبر', () => {
    expect(normalizeCellString('-')).toBeNull();
    expect(normalizeCellString('—')).toBeNull();
    expect(normalizeCellString('–')).toBeNull();
    expect(parsed.manifest.startNonEmpty).toBe(60);
    expect(parsed.manifest.startValid).toBe(60);
    expect(parsed.manifest.finishNonEmpty).toBe(60);
    expect(parsed.manifest.finishValid).toBe(60);
    expect(parsed.manifest.dateMin).toBe('1404/09/01');
    expect(parsed.manifest.dateMax).toBe('1406/12/10');
  });

  it('Percent صفر حفظ و مقیاس 0..1 → 0..100', () => {
    const zero = parsed.rows.find((r) => r.sourceRow === 7);
    expect(zero?.percentComplete).toBe(0);
    const scaled = parsed.rows.filter((r) => r.percentComplete === 50);
    expect(scaled.length).toBeGreaterThan(0);
  });

  it('عنوان‌های دارای روز/ماه مانع Parse نشده‌اند (ادامه بعد از ردیف ۱۳)', () => {
    expect(parsed.manifest.sourceRowCount).toBe(142);
    expect(parsed.rows.some((r) => r.normalizedTitle.includes('روز'))).toBe(true);
    expect(parsed.rows.some((r) => (r.break1Title ?? '').includes('ماه'))).toBe(true);
  });

  it('Phase/Break merge fill-down صحیح است', () => {
    const withPhase = parsed.rows.filter((r) => r.phaseTitle.length > 0);
    expect(withPhase.length).toBe(142);
    expect(parsed.rows.every((r) => r.break1Code !== null)).toBe(true);
  });

  it('هیچ orphan و CRITICAL ساختاری نیست', () => {
    const tree = buildWbsTree(parsed.rows, 'root');
    expect(countOrphans(tree.nodes)).toBe(0);
    const critical = parsed.issues.filter((i) => i.level === ImportIssueLevel.CRITICAL);
    expect(critical).toEqual([]);
  });

  it('Preview nodes = Phase+Break1+Task hierarchy', () => {
    const tree = buildWbsTree(parsed.rows, 'root');
    expect(tree.phaseCount + tree.break1Count + tree.taskCount).toBe(tree.nodes.length);
    expect(tree.nodes.length).toBeGreaterThan(142);
  });
});

describe('GanttExcelParserService (Edge Fixture)', () => {
  const parser = new GanttExcelParserService();

  it('Sanitized edge fixture تمام ردیف‌های فعالیت را Parse می‌کند', async () => {
    const buffer = await buildSanitizedEdgeFixtureBuffer();
    const parsed = await parser.parse(buffer);
    expect(parsed.manifest.sourceRowCount).toBe(3);
    expect(parsed.manifest.phaseCount).toBe(1);
    expect(parsed.manifest.break1Count).toBe(1);
    expect(parsed.manifest.totalDays).toBe(30);
    expect(parsed.manifest.totalMonths).toBe(1);

    const tree = buildWbsTree(parsed.rows, 'root');
    const structural = validateStructural(parsed, tree);
    expect(structural.ok).toBe(true);
    expect(structural.orphanCount).toBe(0);

    expect(parsed.rows.some((r) => r.normalizedTitle.includes('روز'))).toBe(true);
    expect(parsed.rows.some((r) => r.normalizedTitle.includes('ماه'))).toBe(true);
    expect(parsed.rows.some((r) => r.budgetAmount === 0)).toBe(true);
    expect(parsed.rows.some((r) => r.percentComplete === 0)).toBe(true);
    expect(parsed.rows.some((r) => r.percentComplete === 25)).toBe(true);
    expect(parsed.rows.some((r) => r.percentComplete === 100)).toBe(true);
    expect(parsed.rows.filter((r) => !r.startProvided).length).toBeGreaterThan(0);
  });

  it('مقیاس Percent مخلوط → CRITICAL', async () => {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('گانت');
    ws.getCell(3, 2).value = 'Phase';
    ws.getCell(3, 3).value = 'Break1';
    ws.getCell(3, 4).value = 'Break 2';
    ws.getCell(3, 14).value = 'PERCENT COMPLETE';
    ws.getCell(5, 2).value = 'فاز';
    ws.getCell(5, 3).value = 'شکست';
    ws.getCell(5, 4).value = 'A';
    ws.getCell(5, 14).value = 0.5;
    ws.getCell(6, 4).value = 'B';
    ws.getCell(6, 14).value = 75;
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    const parsed = await parser.parse(buf);
    expect(
      parsed.issues.some((i) => i.code === ImportIssueCode.PERCENT_SCALE_MIXED),
    ).toBe(true);
  });
});
