import { EXPECTED_EXCEL_MANIFEST, type ExcelManifest } from '@ppm/contracts';
import {
  compareManifest,
  manifestIsValid,
  shouldRunStrictFixtureValidation,
  validateStructural,
} from './manifest-validator';
import { buildWbsTree } from './wbs-tree-builder';
import type { ParsedExcelWorkbook } from '@ppm/contracts';

describe('manifest-validator', () => {
  it('Strict به‌صورت پیش‌فرض خاموش است', () => {
    expect(shouldRunStrictFixtureValidation({})).toBe(false);
    expect(shouldRunStrictFixtureValidation({ strictFixtureManifest: true })).toBe(true);
  });

  it('Manifest منطبق کاملاً معتبر است (Strict)', () => {
    const checks = compareManifest(EXPECTED_EXCEL_MANIFEST);
    expect(manifestIsValid(checks)).toBe(true);
  });

  it('عدم تطابق تعداد فاز را تشخیص می‌دهد', () => {
    const bad: ExcelManifest = { ...EXPECTED_EXCEL_MANIFEST, phaseCount: 6 };
    const checks = compareManifest(bad);
    expect(manifestIsValid(checks)).toBe(false);
    const phaseCheck = checks.find((c) => c.key === 'phaseCount');
    expect(phaseCheck?.ok).toBe(false);
    expect(phaseCheck?.actual).toBe('6');
  });

  it('عدم تطابق جمع بودجه شناسایی می‌شود', () => {
    const bad: ExcelManifest = { ...EXPECTED_EXCEL_MANIFEST, budgetTotal: 1 };
    const checks = compareManifest(bad);
    expect(checks.find((c) => c.key === 'budgetTotal')?.ok).toBe(false);
  });

  it('perPhaseCounts به‌صورت رشته مقایسه می‌شود', () => {
    const bad: ExcelManifest = {
      ...EXPECTED_EXCEL_MANIFEST,
      perPhaseCounts: [13, 18, 12, 13, 64, 10, 11],
    };
    expect(manifestIsValid(compareManifest(bad))).toBe(false);
  });

  it('Structural validation روی فایل غیرFixture با شمارش درست PASS می‌شود', () => {
    const parsed: ParsedExcelWorkbook = {
      fileHash: 'abc',
      parserVersion: 'excel-gantt-1.1.0',
      manifest: {
        phaseCount: 1,
        break1Count: 1,
        sourceRowCount: 1,
        perPhaseCounts: [1],
        periodCount: 0,
        totalDays: null,
        totalMonths: null,
        budgetRowCount: 0,
        budgetTotal: 0,
        ownerCount: 0,
        dodCount: 0,
        progressCount: 0,
        startNonEmpty: 0,
        startValid: 0,
        finishNonEmpty: 0,
        finishValid: 0,
        dateMin: null,
        dateMax: null,
      },
      rows: [
        {
          sourceRow: 5,
          phaseCode: '1',
          phaseTitle: 'فاز',
          break1Code: '1-1',
          break1Title: 'شکست',
          rawTitle: 'فعالیت',
          normalizedTitle: 'فعالیت',
          indent: 0,
          outlineLevel: 0,
          plannedStartJalali: null,
          plannedFinishJalali: null,
          startProvided: false,
          finishProvided: false,
          plannedStartValid: false,
          plannedFinishValid: false,
          budgetAmount: null,
          ownerText: null,
          definitionOfDone: null,
          periodPlanStart: null,
          periodPlanDuration: null,
          periodActualStart: null,
          periodActualDuration: null,
          percentComplete: null,
        },
      ],
      issues: [],
    };
    const tree = buildWbsTree(parsed.rows, 'root');
    const result = validateStructural(parsed, tree);
    expect(result.ok).toBe(true);
    expect(result.orphanCount).toBe(0);
    // اعداد Fixture روی این فایل اعمال نمی‌شود
    expect(manifestIsValid(compareManifest(parsed.manifest))).toBe(false);
    // Strict به‌صورت پیش‌فرض برای فایل عمومی خاموش است
    expect(shouldRunStrictFixtureValidation({ fileHash: 'abc' })).toBe(false);
  });
});
