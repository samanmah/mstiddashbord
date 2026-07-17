/**
 * خواندن و طبقه‌بندی ماتریس دوره‌ای Excel (ستون‌های O+).
 * Pure — مستقل از Nest؛ وابسته به ExcelJS Worksheet.
 */
import {
  ImportIssueCode,
  ImportIssueLevel,
  normalizeText,
  parseNumeric,
  type ImportIssue,
  type ParsedNodePeriodValue,
  type ParsedPeriodColumn,
  type PeriodMatrixStats,
  toLatinDigits,
} from '@ppm/contracts';
import type ExcelJS from 'exceljs';

const FIRST_PERIOD = 15; // O
const GANTT_SHEET = 'گانت';

function colLetter(index: number): string {
  let n = index;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function classifyValueType(
  groupLabel: string | null,
  header: string | null,
): 'PLANNED' | 'ACTUAL' | 'UNKNOWN' {
  const text = `${groupLabel ?? ''} ${header ?? ''}`.toLowerCase();
  if (
    text.includes('actual') ||
    text.includes('واقعی') ||
    text.includes('beyond')
  ) {
    return 'ACTUAL';
  }
  if (
    text.includes('plan') ||
    text.includes('برنامه') ||
    text.includes('period') ||
    text.includes('periods')
  ) {
    return 'PLANNED';
  }
  return 'UNKNOWN';
}

function rawCellValue(cell: ExcelJS.Cell): unknown {
  const v = cell.value;
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    const obj = v as unknown as Record<string, unknown>;
    if ('result' in obj) return obj.result;
    if ('richText' in obj && Array.isArray(obj.richText)) {
      return (obj.richText as Array<{ text: string }>).map((r) => r.text).join('');
    }
    if ('text' in obj) return obj.text;
    if ('formula' in obj) return obj.result ?? null;
  }
  return v;
}

function cellFormula(cell: ExcelJS.Cell): string | null {
  const v = cell.value;
  if (typeof v === 'string' && v.startsWith('=')) return v;
  if (v && typeof v === 'object' && 'formula' in (v as object)) {
    const f = (v as { formula?: string }).formula;
    return f ? `=${f}` : null;
  }
  return null;
}

export interface PeriodMatrixReadResult {
  periodColumns: ParsedPeriodColumn[];
  periodValues: ParsedNodePeriodValue[];
  stats: PeriodMatrixStats;
  issues: ImportIssue[];
}

/**
 * استخراج ستون‌ها و مقادیر غیرخالی ماتریس دوره‌ای برای ردیف‌های فعالیت.
 */
export function readPeriodMatrix(
  ws: ExcelJS.Worksheet,
  headerRow: number,
  activitySourceRows: number[],
): PeriodMatrixReadResult {
  const issues: ImportIssue[] = [];
  const numberingRow = headerRow + 1;
  const maxCol = Math.max(ws.columnCount, ws.actualColumnCount ?? 0);

  // Fill-forward گروه‌های ردیف headerRow-1 (معمولاً ردیف ۲)
  const groupRow = Math.max(1, headerRow - 1);
  let currentGroup: string | null = null;
  const groupByCol = new Map<number, string | null>();
  for (let c = FIRST_PERIOD; c <= maxCol; c += 1) {
    const raw = rawCellValue(ws.getCell(groupRow, c));
    if (raw !== null && raw !== undefined && String(raw).trim() !== '') {
      currentGroup = normalizeText(String(raw));
    }
    groupByCol.set(c, currentGroup);
  }

  const periodColumns: ParsedPeriodColumn[] = [];
  for (let c = FIRST_PERIOD; c <= maxCol; c += 1) {
    const periodIndex = parseNumeric(rawCellValue(ws.getCell(numberingRow, c)));
    if (periodIndex === null) continue;
    const headerRaw = rawCellValue(ws.getCell(headerRow, c));
    const header =
      headerRaw === null || headerRaw === undefined
        ? null
        : normalizeText(String(headerRaw)) || null;
    const periodGroup = groupByCol.get(c) ?? null;
    const valueType = classifyValueType(periodGroup, header);
    periodColumns.push({
      columnIndex: c,
      columnLetter: colLetter(c),
      header,
      periodIndex: Math.round(periodIndex),
      periodLabel: String(Math.round(periodIndex)),
      periodGroup,
      valueType,
      reportingDate: null,
    });
  }

  const colByIndex = new Map(periodColumns.map((c) => [c.columnIndex, c]));
  const periodValues: ParsedNodePeriodValue[] = [];
  let plannedCount = 0;
  let actualCount = 0;
  let unknownCount = 0;
  let explicitZeroCount = 0;
  let formulaCount = 0;
  let formulaWithoutCachedResultCount = 0;
  let blankSkippedCount = 0;
  let numericSum = 0;

  for (const sourceRow of activitySourceRows) {
    for (const col of periodColumns) {
      const cell = ws.getCell(sourceRow, col.columnIndex);
      const formula = cellFormula(cell);
      const raw = rawCellValue(cell);

      if (formula) {
        formulaCount += 1;
        if (raw === null || raw === undefined) {
          formulaWithoutCachedResultCount += 1;
          issues.push({
            level: ImportIssueLevel.WARNING,
            code: ImportIssueCode.EMPTY_PERIOD,
            message: `فرمول بدون مقدار cached در سطر ${sourceRow} ستون ${col.columnLetter}.`,
            sheet: GANTT_SHEET,
            row: sourceRow,
            column: col.columnLetter,
          });
          blankSkippedCount += 1;
          continue;
        }
      }

      if (raw === null || raw === undefined) {
        blankSkippedCount += 1;
        continue;
      }
      if (typeof raw === 'string' && normalizeText(raw).length === 0) {
        blankSkippedCount += 1;
        continue;
      }

      const normalized = parseNumeric(raw);
      if (normalized === null) {
        // مقدار غیرعددی — به‌عنوان raw نگه داشته می‌شود بدون normalized
        periodValues.push({
          sourceRow,
          sourceColumn: col.columnIndex,
          periodIndex: col.periodIndex,
          periodLabel: col.periodLabel,
          reportingDate: null,
          valueType: col.valueType,
          rawValue: String(raw),
          normalizedValue: null,
          formula,
          zeroIsExplicit: false,
        });
        if (col.valueType === 'PLANNED') plannedCount += 1;
        else if (col.valueType === 'ACTUAL') actualCount += 1;
        else unknownCount += 1;
        continue;
      }

      const zeroIsExplicit = normalized === 0;
      if (zeroIsExplicit) explicitZeroCount += 1;
      numericSum += normalized;
      if (col.valueType === 'PLANNED') plannedCount += 1;
      else if (col.valueType === 'ACTUAL') actualCount += 1;
      else unknownCount += 1;

      periodValues.push({
        sourceRow,
        sourceColumn: col.columnIndex,
        periodIndex: col.periodIndex,
        periodLabel: col.periodLabel,
        reportingDate: null,
        valueType: col.valueType,
        rawValue: typeof raw === 'string' ? toLatinDigits(raw) : String(raw),
        normalizedValue: normalized,
        formula,
        zeroIsExplicit,
      });
    }
  }

  // silence unused
  void colByIndex;

  const stats: PeriodMatrixStats = {
    periodColumnCount: periodColumns.length,
    periodSnapshotsParsed: periodValues.length,
    plannedCount,
    actualCount,
    unknownCount,
    explicitZeroCount,
    formulaCount,
    formulaWithoutCachedResultCount,
    blankSkippedCount,
    numericSum,
  };

  return { periodColumns, periodValues, stats, issues };
}

export function emptyPeriodMatrixStats(): PeriodMatrixStats {
  return {
    periodColumnCount: 0,
    periodSnapshotsParsed: 0,
    plannedCount: 0,
    actualCount: 0,
    unknownCount: 0,
    explicitZeroCount: 0,
    formulaCount: 0,
    formulaWithoutCachedResultCount: 0,
    blankSkippedCount: 0,
    numericSum: 0,
  };
}
