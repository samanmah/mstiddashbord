/**
 * اعتبارسنجی ساختاری برای همهٔ فایل‌های Excel + Strict Fixture Manifest فقط برای Fixture.
 */
import {
  type ExcelManifest,
  EXPECTED_EXCEL_MANIFEST,
  ImportIssueCode,
  ImportIssueLevel,
  type ImportIssue,
  type ImportManifestComparison,
  KNOWN_GANTT_FIXTURE_SHA256,
  type ParsedExcelWorkbook,
  type StrictFixtureValidationOptions,
} from '@ppm/contracts';
import { type PlannedWbsNode, type WbsTreePlan } from './wbs-tree-builder';

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
 * مقایسهٔ Manifest با Fixture شناخته‌شده.
 * فقط وقتی `shouldRunStrictFixtureValidation` true است فراخوانی شود.
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

/** آیا Strict Fixture Manifest باید اجرا شود؟ */
export function shouldRunStrictFixtureValidation(
  options: StrictFixtureValidationOptions = {},
): boolean {
  if (options.strictFixtureManifest === true) return true;
  if (process.env.STRICT_FIXTURE_MANIFEST === '1') return true;
  const hash = options.fileHash?.trim().toLowerCase();
  if (hash && KNOWN_GANTT_FIXTURE_SHA256.some((h) => h.toLowerCase() === hash)) {
    return true;
  }
  return false;
}

export interface StructuralValidationResult {
  ok: boolean;
  orphanCount: number;
  issues: ImportIssue[];
  checks: ImportManifestComparison[];
}

function structuralCmp(
  key: string,
  ok: boolean,
  expected: string,
  actual: string,
): ImportManifestComparison {
  return { key, expected, actual, ok };
}

/** شمارش نودهایی که parentTempId آن‌ها در درخت نیست (به‌جز root). */
export function countOrphans(nodes: PlannedWbsNode[], rootTempId = 'root'): number {
  const ids = new Set(nodes.map((n) => n.tempId));
  ids.add(rootTempId);
  return nodes.filter((n) => n.parentTempId !== null && !ids.has(n.parentTempId)).length;
}

/**
 * Structural Validation برای همهٔ فایل‌های Excel (نه اعداد ثابت Fixture).
 */
export function validateStructural(
  parsed: ParsedExcelWorkbook,
  tree: WbsTreePlan,
  rootTempId = 'root',
): StructuralValidationResult {
  const issues: ImportIssue[] = [];
  const checks: ImportManifestComparison[] = [];
  const orphanCount = countOrphans(tree.nodes, rootTempId);
  const criticalParser = parsed.issues.filter((i) => i.level === ImportIssueLevel.CRITICAL).length;

  const sheetOk = parsed.rows.length > 0 || parsed.manifest.sourceRowCount >= 0;
  // Sheet/header از قبل در parser به‌صورت CRITICAL ثبت می‌شوند؛ اینجا شمارش‌ها را می‌سنجیم.
  const sourceOk = parsed.manifest.sourceRowCount > 0;
  const phaseOk = parsed.manifest.phaseCount > 0;
  const taskOk = tree.taskCount > 0;
  const orphanOk = orphanCount === 0;
  const criticalOk = criticalParser === 0;

  checks.push(
    structuralCmp('sourceRowCount', sourceOk, '>0', String(parsed.manifest.sourceRowCount)),
    structuralCmp('phaseCount', phaseOk, '>0', String(parsed.manifest.phaseCount)),
    structuralCmp('taskCount', taskOk, '>0', String(tree.taskCount)),
    structuralCmp('orphanCount', orphanOk, '0', String(orphanCount)),
    structuralCmp('criticalParserErrors', criticalOk, '0', String(criticalParser)),
    structuralCmp('readableSheet', sheetOk, 'true', String(sheetOk)),
  );

  if (!sourceOk) {
    issues.push({
      level: ImportIssueLevel.CRITICAL,
      code: ImportIssueCode.STRUCTURE_INVALID,
      message: 'هیچ ردیف فعالیت معتبری در فایل یافت نشد.',
    });
  }
  if (!phaseOk) {
    issues.push({
      level: ImportIssueLevel.CRITICAL,
      code: ImportIssueCode.STRUCTURE_INVALID,
      message: 'حداقل یک Phase لازم است.',
    });
  }
  if (!taskOk) {
    issues.push({
      level: ImportIssueLevel.CRITICAL,
      code: ImportIssueCode.STRUCTURE_INVALID,
      message: 'حداقل یک Task/Summary/Milestone لازم است.',
    });
  }
  if (!orphanOk) {
    issues.push({
      level: ImportIssueLevel.CRITICAL,
      code: ImportIssueCode.PARENT_INVALID,
      message: `تعداد ${orphanCount} نود بدون والد معتبر (orphan) تشخیص داده شد.`,
    });
  }

  const ok = checks.every((c) => c.ok) && issues.length === 0;
  return { ok, orphanCount, issues, checks };
}
