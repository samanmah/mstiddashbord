/**
 * انواع و ثابت‌های مشترک «Importer کنترل پروژه» (Excel + MPP) بین Backend و Frontend/CLI.
 * این فایل هیچ وابستگی به Runtime خاصی ندارد و صرفاً Type/Const است.
 */

// ---------------------------------------------------------------------------
// نسخهٔ Parser (در ImportBatch.parserVersion ثبت می‌شود)
// ---------------------------------------------------------------------------

export const EXCEL_PARSER_VERSION = 'excel-gantt-1.1.0';
export const MPP_ADAPTER_VERSION = 'mpxj-adapter-1.0.0';

// ---------------------------------------------------------------------------
// سطوح و کدهای خطا/هشدار Import
// ---------------------------------------------------------------------------

export const ImportIssueLevel = {
  CRITICAL: 'CRITICAL',
  WARNING: 'WARNING',
  INFO: 'INFO',
} as const;
export type ImportIssueLevel = (typeof ImportIssueLevel)[keyof typeof ImportIssueLevel];

export const ImportIssueCode = {
  // CRITICAL
  MANIFEST_MISMATCH: 'MANIFEST_MISMATCH',
  SHEET_MISSING: 'SHEET_MISSING',
  HEADER_MISSING: 'HEADER_MISSING',
  STRUCTURE_INVALID: 'STRUCTURE_INVALID',
  PARENT_INVALID: 'PARENT_INVALID',
  HIERARCHY_CYCLE: 'HIERARCHY_CYCLE',
  START_AFTER_FINISH: 'START_AFTER_FINISH',
  FILE_UNREADABLE: 'FILE_UNREADABLE',
  // WARNING
  INVALID_DATE: 'INVALID_DATE',
  AMBIGUOUS_OUTLINE: 'AMBIGUOUS_OUTLINE',
  WEIGHT_UNBALANCED: 'WEIGHT_UNBALANCED',
  WEIGHT_DERIVED: 'WEIGHT_DERIVED',
  MISSING_OWNER: 'MISSING_OWNER',
  MISSING_DOD: 'MISSING_DOD',
  DUPLICATE_TITLE: 'DUPLICATE_TITLE',
  BUDGET_UNPARSED: 'BUDGET_UNPARSED',
  PERCENT_SCALE_MIXED: 'PERCENT_SCALE_MIXED',
  // INFO
  MISSING_DATES: 'MISSING_DATES',
  EMPTY_PERIOD: 'EMPTY_PERIOD',
  EMPTY_ROW_SKIPPED: 'EMPTY_ROW_SKIPPED',
} as const;
export type ImportIssueCode = (typeof ImportIssueCode)[keyof typeof ImportIssueCode];

export interface ImportIssue {
  level: ImportIssueLevel;
  code: ImportIssueCode;
  message: string;
  sheet?: string;
  row?: number;
  column?: string;
  value?: string;
}

// ---------------------------------------------------------------------------
// Manifest اکسل (شمارش‌های ساختاری برای Assert)
// ---------------------------------------------------------------------------

export interface ExcelManifest {
  phaseCount: number;
  break1Count: number;
  sourceRowCount: number;
  perPhaseCounts: number[];
  periodCount: number;
  totalDays: number | null;
  totalMonths: number | null;
  budgetRowCount: number;
  /** جمع `budgetAmount` بسته‌های واردشده به تومان (نه بودجهٔ مصوب پروژه به میلیارد ریال). */
  budgetTotal: number;
  ownerCount: number;
  dodCount: number;
  progressCount: number;
  startNonEmpty: number;
  startValid: number;
  finishNonEmpty: number;
  finishValid: number;
  dateMin: string | null; // Jalali YYYY/MM/DD
  dateMax: string | null; // Jalali YYYY/MM/DD
}

/**
 * Manifest مورد انتظار Fixture شناخته‌شده (`artifacts/project-control/gantt-fixture.xlsx`
 * و `buildGanttFixtureBuffer`). فقط برای Strict Fixture Validation استفاده می‌شود —
 * نه برای هر فایل Excel واقعی/عمومی.
 */
export const EXPECTED_EXCEL_MANIFEST: ExcelManifest = {
  phaseCount: 7,
  break1Count: 24,
  sourceRowCount: 142,
  perPhaseCounts: [13, 18, 12, 13, 65, 10, 11],
  periodCount: 147,
  totalDays: 620,
  totalMonths: 21,
  budgetRowCount: 6,
  budgetTotal: 929_875_000_000,
  ownerCount: 65,
  dodCount: 48,
  progressCount: 104,
  /** پنج "-" پس از normalizeCellString → null؛ فقط ۶۰ تاریخ واقعی. */
  startNonEmpty: 60,
  startValid: 60,
  finishNonEmpty: 60,
  finishValid: 60,
  dateMin: '1404/09/01',
  dateMax: '1406/12/10',
};

/** گزینه‌های فعال‌سازی Strict Fixture Manifest Validation. */
export interface StrictFixtureValidationOptions {
  /** صریح از Caller/CLI/تست. */
  strictFixtureManifest?: boolean;
  /** SHA256 فایل برای تطبیق با Fixture شناخته‌شده. */
  fileHash?: string | null;
}

/**
 * Hashهای شناخته‌شدهٔ Fixture (در صورت تغییر Fixture، regenerate و به‌روزرسانی شود).
 * خالی = فقط از option/ENV استفاده می‌شود تا CI به hash ثابت وابسته نباشد.
 */
export const KNOWN_GANTT_FIXTURE_SHA256: readonly string[] = [];

// ---------------------------------------------------------------------------
// نتیجهٔ Parse اکسل (نمایش Preview + Mapping)
// ---------------------------------------------------------------------------

export interface ParsedWbsRow {
  sourceRow: number;
  phaseCode: string; // «1..7»
  phaseTitle: string;
  break1Code: string | null; // «n-m»
  break1Title: string | null;
  rawTitle: string; // با تورفتگی
  normalizedTitle: string;
  indent: number;
  outlineLevel: number; // 0-based نسبت به Break1
  plannedStartJalali: string | null;
  plannedFinishJalali: string | null;
  startProvided: boolean; // ستون تاریخ شروع غیرخالی بود (معتبر یا نامعتبر)
  finishProvided: boolean;
  plannedStartValid: boolean;
  plannedFinishValid: boolean;
  budgetAmount: number | null;
  ownerText: string | null;
  definitionOfDone: string | null;
  periodPlanStart: number | null;
  periodPlanDuration: number | null;
  periodActualStart: number | null;
  periodActualDuration: number | null;
  percentComplete: number | null;
}

export interface ParsedExcelWorkbook {
  fileHash: string;
  parserVersion: string;
  manifest: ExcelManifest;
  rows: ParsedWbsRow[];
  issues: ImportIssue[];
}

// ---------------------------------------------------------------------------
// قرارداد Adapter فایل MPP (پیاده‌سازی MPXJ ایزوله)
// ---------------------------------------------------------------------------

export interface MppEnvironmentStatus {
  javaAvailable: boolean;
  javaVersion: string | null;
  adapterPresent: boolean;
  adapterVersion: string;
  mpxjAvailable: boolean;
  message: string; // پیام فارسی وضعیت
}

export interface MppTaskDto {
  uniqueId: number;
  id: number | null;
  outlineNumber: string | null;
  outlineLevel: number;
  wbs: string | null;
  name: string;
  isSummary: boolean;
  isMilestone: boolean;
  startIso: string | null;
  finishIso: string | null;
  actualStartIso: string | null;
  actualFinishIso: string | null;
  durationMinutes: number | null;
  actualDurationMinutes: number | null;
  remainingDurationMinutes: number | null;
  percentComplete: number | null;
  physicalPercentComplete: number | null;
  cost: number | null;
  companyCost: number | null; // COST2
  financialProgressCost: number | null; // COST1
  weight: number | null; // NUMBER1
  constraintType: string | null;
  constraintDateIso: string | null;
  deadlineIso: string | null;
  calendarName: string | null;
  notes: string | null;
}

export interface MppDependencyDto {
  predecessorUniqueId: number;
  successorUniqueId: number;
  type: 'FS' | 'SS' | 'FF' | 'SF';
  lagMinutes: number;
}

export interface MppAssignmentDto {
  taskUniqueId: number;
  resourceName: string;
  unitsPercent: number | null;
}

export interface MppParseResult {
  parserVersion: string;
  mppFileType: number | null;
  currency: string | null;
  statusDateIso: string | null;
  tasks: MppTaskDto[];
  dependencies: MppDependencyDto[];
  assignments: MppAssignmentDto[];
}

// ---------------------------------------------------------------------------
// Preview / Commit خروجی API + CLI
// ---------------------------------------------------------------------------

export interface ImportManifestComparison {
  key: string;
  expected: string;
  actual: string;
  ok: boolean;
}

export interface ImportConflict {
  sourceRow: number;
  title: string;
  matchedNodeId: string | null;
  reason: string;
}

export interface ControlImportPreview {
  importBatchId: string | null; // null در Dry-Run بدون ثبت
  sourceType: 'EXCEL' | 'MPP';
  fileHash: string;
  parserVersion: string;
  dryRun: boolean;
  manifest: ExcelManifest;
  manifestChecks: ImportManifestComparison[];
  manifestValid: boolean;
  counts: {
    phases: number;
    break1: number;
    tasks: number;
    totalNodes: number;
  };
  conflicts: ImportConflict[];
  issues: ImportIssue[];
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  canCommit: boolean;
}

export interface ControlImportCommitResult {
  importBatchId: string;
  controlPlanId: string;
  createdNodes: number;
  updatedNodes: number;
  status: 'COMPLETED' | 'FAILED';
}

/**
 * پاسخ POST .../imports/upload — فقط شناسهٔ دسته و نوع منبع.
 * با ImportBatchDto (جزئیات کامل دسته در list/get) اشتباه گرفته نشود.
 */
export interface UploadImportResult {
  importBatchId: string;
  sourceType: 'EXCEL' | 'MPP';
}
