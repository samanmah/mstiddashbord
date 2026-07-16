/**
 * اعتبارسنجی Manifest اکسل در برابر مقادیر مورد انتظار (source-analysis.md).
 * عدم تطابق ساختاری = خطای CRITICAL و مانع Commit.
 */
import {
  type ExcelManifest,
  EXPECTED_EXCEL_MANIFEST,
  type ImportManifestComparison,
} from '@ppm/contracts';

function cmp(
  key: string,
  expected: string | number | null,
  actual: string | number | null,
): ImportManifestComparison {
  return {
    key,
    expected: expected === null ? '—' : String(expected),
    actual: actual === null ? '—' : String(actual),
    ok: String(expected ?? '—') === String(actual ?? '—'),
  };
}

/**
 * مقایسهٔ Manifest استخراج‌شده با مورد انتظار.
 * پارامتر `expected` برای تست‌ها قابل تزریق است (پیش‌فرض: Manifest فایل واقعی).
 */
export function compareManifest(
  actual: ExcelManifest,
  expected: ExcelManifest = EXPECTED_EXCEL_MANIFEST,
): ImportManifestComparison[] {
  return [
    cmp('phaseCount', expected.phaseCount, actual.phaseCount),
    cmp('break1Count', expected.break1Count, actual.break1Count),
    cmp('sourceRowCount', expected.sourceRowCount, actual.sourceRowCount),
    cmp('perPhaseCounts', expected.perPhaseCounts.join(','), actual.perPhaseCounts.join(',')),
    cmp('periodCount', expected.periodCount, actual.periodCount),
    cmp('totalDays', expected.totalDays, actual.totalDays),
    cmp('totalMonths', expected.totalMonths, actual.totalMonths),
    cmp('budgetRowCount', expected.budgetRowCount, actual.budgetRowCount),
    cmp('budgetTotal', expected.budgetTotal, actual.budgetTotal),
    cmp('ownerCount', expected.ownerCount, actual.ownerCount),
    cmp('dodCount', expected.dodCount, actual.dodCount),
    cmp('progressCount', expected.progressCount, actual.progressCount),
    cmp('startNonEmpty', expected.startNonEmpty, actual.startNonEmpty),
    cmp('startValid', expected.startValid, actual.startValid),
    cmp('finishNonEmpty', expected.finishNonEmpty, actual.finishNonEmpty),
    cmp('finishValid', expected.finishValid, actual.finishValid),
    cmp('dateMin', expected.dateMin, actual.dateMin),
    cmp('dateMax', expected.dateMax, actual.dateMax),
  ];
}

export function manifestIsValid(checks: ImportManifestComparison[]): boolean {
  return checks.every((c) => c.ok);
}
