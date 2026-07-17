/**
 * Evaluator امن و محدود برای قواعد Conditional Formatting شناخته‌شدهٔ گانت STYLE_BASED.
 * بدون eval / بدون اجرای فرمول دلخواه Excel.
 */
import {
  ImportIssueCode,
  ImportIssueLevel,
  type ImportIssue,
  type ParsedGanttSpan,
  type TimelineClassification,
} from '@ppm/contracts';

export const KNOWN_CF_FORMULAS = [
  'PercentComplete',
  'PercentCompleteBeyond',
  'Actual',
  'ActualBeyond',
  'Plan',
  'O$4=period_selected',
  'MOD(COLUMN(),2)',
  'MOD(COLUMN(),2)=0',
] as const;

export type KnownCfFormula = (typeof KNOWN_CF_FORMULAS)[number];

export interface TaskScheduleScalars {
  sourceRow: number;
  planStart: number | null;
  planDuration: number | null;
  actualStart: number | null;
  actualDuration: number | null;
  percentComplete: number | null;
}

export interface DiscoveredCfRule {
  type: string;
  priority: number | null;
  stopIfTrue: boolean;
  range: string;
  formula: string | null;
  dxfId: number | null;
  semanticMeaning:
    | 'PLANNED'
    | 'ACTUAL'
    | 'PROGRESS'
    | 'DELAY'
    | 'MILESTONE'
    | 'TODAY'
    | 'OTHER';
  known: boolean;
}

export interface StyleGanttEvalResult {
  timelineClassification: TimelineClassification;
  spans: ParsedGanttSpan[];
  derivedGanttSpanCount: number;
  derivedBarCellCount: number;
  conditionalFormattingRuleCount: number;
  knownRuleCount: number;
  unknownRuleCount: number;
  issues: ImportIssue[];
}

function median3(a: number, b: number, c: number): number {
  return [a, b, c].sort((x, y) => x - y)[1]!;
}

function clampPeriod(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** PeriodInPlan / Plan */
export function isPlanPeriod(
  periodIndex: number,
  planStart: number | null,
  planDuration: number | null,
): boolean {
  if (planStart === null || planDuration === null) return false;
  if (!(planStart > 0) || !(planDuration > 0)) return false;
  return (
    periodIndex ===
    median3(periodIndex, planStart, planStart + planDuration - 1)
  );
}

/** PeriodInActual / ActualBeyond */
export function isActualBeyondPeriod(
  periodIndex: number,
  actualStart: number | null,
  actualDuration: number | null,
): boolean {
  if (actualStart === null || actualDuration === null) return false;
  if (!(actualStart > 0) || !(actualDuration > 0)) return false;
  return (
    periodIndex ===
    median3(periodIndex, actualStart, actualStart + actualDuration - 1)
  );
}

/** Actual = ActualBeyond ∩ Plan */
export function isActualInPlanPeriod(
  periodIndex: number,
  task: TaskScheduleScalars,
): boolean {
  return (
    isActualBeyondPeriod(periodIndex, task.actualStart, task.actualDuration) &&
    isPlanPeriod(periodIndex, task.planStart, task.planDuration)
  );
}

/** PercentCompleteBeyond (sheet-local formula semantics). */
export function isPercentCompleteBeyondPeriod(
  periodIndex: number,
  actualStart: number | null,
  actualDuration: number | null,
  percentComplete: number | null,
): boolean {
  if (
    actualStart === null ||
    actualDuration === null ||
    percentComplete === null
  ) {
    return false;
  }
  if (!(actualStart > 0) || !(percentComplete > 0)) return false;
  const inSpan =
    periodIndex === median3(periodIndex, actualStart, actualStart + actualDuration);
  if (!inSpan) return false;
  const threshold = Math.trunc(actualStart + actualDuration * percentComplete);
  return periodIndex < threshold || periodIndex === actualStart;
}

export function isPercentCompletePeriod(
  periodIndex: number,
  task: TaskScheduleScalars,
): boolean {
  return (
    isPercentCompleteBeyondPeriod(
      periodIndex,
      task.actualStart,
      task.actualDuration,
      task.percentComplete,
    ) && isPlanPeriod(periodIndex, task.planStart, task.planDuration)
  );
}

function makeSpanRange(
  start: number,
  end: number,
  axisMin: number,
  axisMax: number,
): { start: number; end: number } | 'reversed' | null {
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  const s = clampPeriod(Math.round(start), axisMin, axisMax);
  const e = clampPeriod(Math.round(end), axisMin, axisMax);
  if (e < s) return 'reversed';
  return { start: s, end: e };
}

function progressBounds(
  actualStart: number,
  actualDuration: number,
  percentComplete: number,
  axisMin: number,
  axisMax: number,
): { start: number; end: number } | 'reversed' | null {
  if (!(actualStart > 0) || !(percentComplete > 0)) return null;
  const threshold = Math.trunc(actualStart + actualDuration * percentComplete);
  const candidates: number[] = [];
  const lo = actualStart;
  const hi = actualStart + actualDuration;
  for (let p = lo; p <= hi; p += 1) {
    if (p < axisMin || p > axisMax) continue;
    if (p < threshold || p === actualStart) candidates.push(p);
  }
  if (candidates.length === 0) return null;
  return makeSpanRange(
    Math.min(...candidates),
    Math.max(...candidates),
    axisMin,
    axisMax,
  );
}

/**
 * استخراج Spanهای PLANNED / ACTUAL / PROGRESS از اسکالرهای J/K/L/M/N.
 */
export function deriveSpansForTask(
  task: TaskScheduleScalars,
  axisMin: number,
  axisMax: number,
  issues: ImportIssue[],
): ParsedGanttSpan[] {
  const spans: ParsedGanttSpan[] = [];
  const { planStart, planDuration, actualStart, actualDuration, percentComplete } =
    task;

  if (planStart !== null && planDuration !== null && planStart > 0) {
    if (planDuration < 0) {
      issues.push({
        level: ImportIssueLevel.CRITICAL,
        code: ImportIssueCode.STRUCTURE_INVALID,
        message: `بازهٔ Planned معکوس در سطر ${task.sourceRow}.`,
        row: task.sourceRow,
        column: 'J',
      });
    } else if (planDuration > 0) {
      const range = makeSpanRange(
        planStart,
        planStart + planDuration - 1,
        axisMin,
        axisMax,
      );
      if (range === 'reversed') {
        issues.push({
          level: ImportIssueLevel.CRITICAL,
          code: ImportIssueCode.STRUCTURE_INVALID,
          message: `بازهٔ Planned معکوس در سطر ${task.sourceRow}.`,
          row: task.sourceRow,
          column: 'J',
        });
      } else if (range) {
        spans.push({
          sourceRow: task.sourceRow,
          spanType: 'PLANNED',
          startPeriodIndex: range.start,
          endPeriodIndex: range.end,
          progressEndPeriodIndex: null,
          derivationMethod: 'EXCEL_CONDITIONAL_FORMATTING',
        });
      }
    }
  }

  if (
    actualStart !== null &&
    actualDuration !== null &&
    actualStart > 0 &&
    actualDuration > 0
  ) {
    const range = makeSpanRange(
      actualStart,
      actualStart + actualDuration - 1,
      axisMin,
      axisMax,
    );
    if (range === 'reversed') {
      issues.push({
        level: ImportIssueLevel.CRITICAL,
        code: ImportIssueCode.STRUCTURE_INVALID,
        message: `بازهٔ Actual معکوس در سطر ${task.sourceRow}.`,
        row: task.sourceRow,
        column: 'L',
      });
    } else if (range) {
      spans.push({
        sourceRow: task.sourceRow,
        spanType: 'ACTUAL',
        startPeriodIndex: range.start,
        endPeriodIndex: range.end,
        progressEndPeriodIndex: null,
        derivationMethod: 'EXCEL_CONDITIONAL_FORMATTING',
      });
    }
  }

  // صفر Progress حفظ می‌شود: N===0 → بدون Span نوع PROGRESS
  if (
    actualStart !== null &&
    actualDuration !== null &&
    percentComplete !== null &&
    actualStart > 0 &&
    percentComplete > 0
  ) {
    const range = progressBounds(
      actualStart,
      actualDuration,
      percentComplete,
      axisMin,
      axisMax,
    );
    if (range === 'reversed') {
      issues.push({
        level: ImportIssueLevel.CRITICAL,
        code: ImportIssueCode.STRUCTURE_INVALID,
        message: `بازهٔ Progress معکوس در سطر ${task.sourceRow}.`,
        row: task.sourceRow,
        column: 'N',
      });
    } else if (range) {
      spans.push({
        sourceRow: task.sourceRow,
        spanType: 'PROGRESS',
        startPeriodIndex: range.start,
        endPeriodIndex: range.end,
        progressEndPeriodIndex: range.end,
        derivationMethod: 'EXCEL_CONDITIONAL_FORMATTING',
      });
    }
  }

  return spans;
}

/** تعداد سلول‌های نمایشی = اتحاد دوره‌های PLANNED ∪ ACTUAL برای هر Task. */
export function countDerivedBarCells(spans: ParsedGanttSpan[]): number {
  const byRow = new Map<number, Set<number>>();
  for (const span of spans) {
    if (span.spanType !== 'PLANNED' && span.spanType !== 'ACTUAL') continue;
    let set = byRow.get(span.sourceRow);
    if (!set) {
      set = new Set();
      byRow.set(span.sourceRow, set);
    }
    for (let p = span.startPeriodIndex; p <= span.endPeriodIndex; p += 1) {
      set.add(p);
    }
  }
  let total = 0;
  for (const set of byRow.values()) total += set.size;
  return total;
}

export function classifyTimeline(input: {
  periodColumnCount: number;
  explicitPeriodSnapshots: number;
  conditionalFormattingRuleCount: number;
  derivedGanttSpanCount: number;
}): TimelineClassification {
  if (input.explicitPeriodSnapshots > 0) return 'EXPLICIT_VALUES';
  if (
    input.periodColumnCount > 0 &&
    (input.conditionalFormattingRuleCount > 0 || input.derivedGanttSpanCount > 0)
  ) {
    return 'STYLE_BASED_GANTT';
  }
  if (input.periodColumnCount > 0 && input.derivedGanttSpanCount === 0) {
    return 'EMPTY_PERIOD_MATRIX';
  }
  return 'EMPTY_PERIOD_MATRIX';
}

export function semanticForFormula(formula: string | null): DiscoveredCfRule['semanticMeaning'] {
  if (!formula) return 'OTHER';
  const f = formula.trim();
  if (f === 'Plan') return 'PLANNED';
  if (f === 'Actual' || f === 'ActualBeyond') return 'ACTUAL';
  if (f === 'PercentComplete' || f === 'PercentCompleteBeyond') return 'PROGRESS';
  if (f.includes('period_selected')) return 'TODAY';
  if (f.startsWith('MOD(')) return 'OTHER';
  return 'OTHER';
}

export function isKnownCfFormula(formula: string | null): boolean {
  if (!formula) return false;
  const f = formula.trim();
  return (KNOWN_CF_FORMULAS as readonly string[]).includes(f);
}

/**
 * ارزیابی کامل Style-Gantt برای ردیف‌های فعالیت.
 */
export function evaluateStyleGantt(input: {
  tasks: TaskScheduleScalars[];
  periodColumnCount: number;
  axisMin?: number;
  axisMax?: number;
  rules: DiscoveredCfRule[];
}): StyleGanttEvalResult {
  const issues: ImportIssue[] = [];
  const axisMin = input.axisMin ?? 1;
  const axisMax = input.axisMax ?? Math.max(1, input.periodColumnCount);
  const spans: ParsedGanttSpan[] = [];

  for (const task of input.tasks) {
    spans.push(...deriveSpansForTask(task, axisMin, axisMax, issues));
  }

  const knownRuleCount = input.rules.filter((r) => r.known).length;
  const unknownRuleCount = input.rules.filter((r) => !r.known && r.type === 'expression').length;
  for (const rule of input.rules) {
    if (!rule.known && rule.type === 'expression' && rule.formula) {
      issues.push({
        level: ImportIssueLevel.WARNING,
        code: ImportIssueCode.EMPTY_PERIOD,
        message: `قاعدهٔ Conditional Formatting ناشناخته نادیده گرفته شد (${rule.formula.slice(0, 40)}).`,
        column: rule.range,
      });
    }
  }

  const derivedBarCellCount = countDerivedBarCells(spans);
  const timelineClassification = classifyTimeline({
    periodColumnCount: input.periodColumnCount,
    explicitPeriodSnapshots: 0,
    conditionalFormattingRuleCount: input.rules.length,
    derivedGanttSpanCount: spans.length,
  });

  if (timelineClassification === 'STYLE_BASED_GANTT') {
    issues.push({
      level: ImportIssueLevel.INFO,
      code: ImportIssueCode.STYLE_BASED_GANTT,
      message:
        `این فایل دارای محور گانت ${input.periodColumnCount} دوره‌ای است. نوارها از زمان‌بندی فعالیت‌ها و ` +
        'قواعد نمایشی Excel مشتق می‌شوند و مقدار دوره‌ای صریح در سلول‌ها وجود ندارد.',
    });
  }

  return {
    timelineClassification,
    spans,
    derivedGanttSpanCount: spans.length,
    derivedBarCellCount,
    conditionalFormattingRuleCount: input.rules.length,
    knownRuleCount,
    unknownRuleCount,
    issues,
  };
}
