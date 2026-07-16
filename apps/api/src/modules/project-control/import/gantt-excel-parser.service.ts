import { Injectable } from '@nestjs/common';
import {
  EXCEL_PARSER_VERSION,
  type ExcelManifest,
  type ImportIssue,
  ImportIssueCode,
  ImportIssueLevel,
  normalizeCellString,
  normalizeText,
  parseNumeric,
  type ParsedExcelWorkbook,
  type ParsedWbsRow,
} from '@ppm/contracts';
import ExcelJS from 'exceljs';
import { createHash } from 'node:crypto';
import {
  computeOutlineLevels,
  countLeadingSpaces,
  parseBudgetToman,
  tryParseJalali,
} from './gantt-parse-utils';

const GANTT_SHEET = 'گانت';

// شمارهٔ ستون‌ها (1-based) در Sheet «گانت».
const COL = {
  phase: 2, // B
  break1: 3, // C
  break2: 4, // D
  start: 5, // E
  finish: 6, // F
  budget: 7, // G
  owner: 8, // H
  dod: 9, // I
  periodPlanStart: 10, // J
  periodPlanDuration: 11, // K
  periodActualStart: 12, // L
  periodActualDuration: 13, // M
  percent: 14, // N
  firstPeriod: 15, // O
} as const;

interface RawRow {
  rowNumber: number;
  phaseMasterRow: number;
  phaseTitle: string;
  break1MasterRow: number | null;
  break1Title: string | null;
  rawTitle: string;
  normalizedTitle: string;
  indent: number;
  startRaw: string | null;
  finishRaw: string | null;
  budgetRaw: unknown;
  ownerRaw: string | null;
  dodRaw: string | null;
  periodPlanStart: number | null;
  periodPlanDuration: number | null;
  periodActualStart: number | null;
  periodActualDuration: number | null;
  percent: number | null;
}

@Injectable()
export class GanttExcelParserService {
  readonly parserVersion = EXCEL_PARSER_VERSION;

  /** خواندن مقدار خام سلول (فرمول/RichText). بدون Normalize. */
  private rawCell(cell: ExcelJS.Cell): unknown {
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
    }
    return v;
  }

  /** سطر Master یک سلول در صورت Merge بودن (برای Fill-Down)؛ وگرنه خود سطر. */
  private masterRow(cell: ExcelJS.Cell): number {
    const anyCell = cell as unknown as { isMerged?: boolean; master?: ExcelJS.Cell };
    if (anyCell.isMerged && anyCell.master) {
      return Number(anyCell.master.row);
    }
    return Number(cell.row);
  }

  /** مقدار مؤثر سلول با در نظر گرفتن Merge Master (Fill-Down). */
  private mergedValue(ws: ExcelJS.Worksheet, row: number, col: number): unknown {
    const cell = ws.getCell(row, col);
    const anyCell = cell as unknown as { isMerged?: boolean; master?: ExcelJS.Cell };
    if (anyCell.isMerged && anyCell.master) {
      return this.rawCell(anyCell.master);
    }
    return this.rawCell(cell);
  }

  async parse(buffer: Buffer): Promise<ParsedExcelWorkbook> {
    const issues: ImportIssue[] = [];
    const fileHash = createHash('sha256').update(buffer).digest('hex');
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    } catch {
      issues.push({
        level: ImportIssueLevel.CRITICAL,
        code: ImportIssueCode.FILE_UNREADABLE,
        message: 'فایل Excel قابل خواندن نیست یا خراب است.',
      });
      return this.emptyResult(fileHash, issues);
    }

    const ws = this.findGanttSheet(wb);
    if (!ws) {
      issues.push({
        level: ImportIssueLevel.CRITICAL,
        code: ImportIssueCode.SHEET_MISSING,
        message: `شیت «${GANTT_SHEET}» یافت نشد.`,
        sheet: GANTT_SHEET,
      });
      return this.emptyResult(fileHash, issues);
    }

    const headerRow = this.detectHeaderRow(ws);
    if (headerRow === null) {
      issues.push({
        level: ImportIssueLevel.CRITICAL,
        code: ImportIssueCode.HEADER_MISSING,
        message: 'سطر سربرگ Sheet گانت یافت نشد.',
        sheet: GANTT_SHEET,
      });
      return this.emptyResult(fileHash, issues);
    }

    const { totalDays, totalMonths } = this.readTotals(ws, headerRow);
    const periodCount = this.countPeriods(ws, headerRow);
    const rawRows = this.readDataRows(ws, headerRow, issues);
    const rows = this.buildRows(rawRows, issues);
    const manifest = this.buildManifest(rows, periodCount, totalDays, totalMonths);

    this.emitDataQualityIssues(rows, issues);

    return { fileHash, parserVersion: this.parserVersion, manifest, rows, issues };
  }

  private emptyResult(fileHash: string, issues: ImportIssue[]): ParsedExcelWorkbook {
    return {
      fileHash,
      parserVersion: this.parserVersion,
      manifest: {
        phaseCount: 0,
        break1Count: 0,
        sourceRowCount: 0,
        perPhaseCounts: [],
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
      rows: [],
      issues,
    };
  }

  private findGanttSheet(wb: ExcelJS.Workbook): ExcelJS.Worksheet | null {
    const target = normalizeText(GANTT_SHEET);
    for (const ws of wb.worksheets) {
      if (normalizeText(ws.name) === target) return ws;
    }
    return null;
  }

  /** یافتن سطر سربرگ با جست‌وجوی ستون‌های شناخته‌شده در ۸ سطر اول. */
  private detectHeaderRow(ws: ExcelJS.Worksheet): number | null {
    for (let r = 1; r <= Math.min(ws.rowCount, 8); r += 1) {
      const b = normalizeText(String(this.rawCell(ws.getCell(r, COL.phase)) ?? ''));
      const c = normalizeText(String(this.rawCell(ws.getCell(r, COL.break1)) ?? ''));
      const d = normalizeText(String(this.rawCell(ws.getCell(r, COL.break2)) ?? ''));
      const hasPhase = b.toLowerCase().includes('phase') || b.includes('فاز');
      const hasBreak = c.toLowerCase().includes('break') || c.includes('شکست');
      const hasBreak2 =
        d.toLowerCase().includes('break') || d.includes('شکست') || d.includes('فعالیت');
      if (hasPhase && hasBreak && hasBreak2) return r;
    }
    return null;
  }

  /** خواندن ردیف‌های جمع «روز»/«ماه» در ستون Break1. */
  private readTotals(
    ws: ExcelJS.Worksheet,
    headerRow: number,
  ): { totalDays: number | null; totalMonths: number | null } {
    let totalDays: number | null = null;
    let totalMonths: number | null = null;
    for (let r = headerRow + 1; r <= ws.rowCount; r += 1) {
      const label = normalizeCellString(this.rawCell(ws.getCell(r, COL.break1)));
      if (!label) continue;
      const value = parseNumeric(this.rawCell(ws.getCell(r, COL.break2)));
      if (label.includes('روز') && totalDays === null) totalDays = value;
      if (label.includes('ماه') && totalMonths === null) totalMonths = value;
    }
    return { totalDays, totalMonths };
  }

  /** شمارش ستون‌های دوره‌ای از روی سطر شماره‌گذاری (headerRow+1). */
  private countPeriods(ws: ExcelJS.Worksheet, headerRow: number): number {
    const numberingRow = headerRow + 1;
    let count = 0;
    const maxCol = Math.max(ws.columnCount, ws.actualColumnCount ?? 0);
    for (let c = COL.firstPeriod; c <= maxCol; c += 1) {
      const v = parseNumeric(this.rawCell(ws.getCell(numberingRow, c)));
      if (v !== null) count += 1;
    }
    return count;
  }

  /** آیا این سطر یک سطر جمع/راهنما است (نه فعالیت منبع)؟ */
  private isTotalsRow(ws: ExcelJS.Worksheet, r: number): boolean {
    const label = normalizeCellString(this.rawCell(ws.getCell(r, COL.break1)));
    if (label && (label.includes('روز') || label.includes('ماه') || label.startsWith('جمع'))) {
      return true;
    }
    return false;
  }

  private readDataRows(
    ws: ExcelJS.Worksheet,
    headerRow: number,
    issues: ImportIssue[],
  ): RawRow[] {
    const rows: RawRow[] = [];
    // ردیف headerRow+1 = شماره‌گذاری دوره‌ها؛ داده از headerRow+2 شروع می‌شود.
    const firstData = headerRow + 2;
    for (let r = firstData; r <= ws.rowCount; r += 1) {
      if (this.isTotalsRow(ws, r)) break;

      const break2Cell = ws.getCell(r, COL.break2);
      const break2Raw = this.rawCell(break2Cell);
      const rawTitleFull = break2Raw === null ? '' : String(break2Raw);
      const normalizedTitle = normalizeText(rawTitleFull);
      if (normalizedTitle.length === 0) {
        // سطر خالی — نادیده گرفته می‌شود (INFO).
        issues.push({
          level: ImportIssueLevel.INFO,
          code: ImportIssueCode.EMPTY_ROW_SKIPPED,
          message: `سطر ${r} فاقد عنوان فعالیت است و نادیده گرفته شد.`,
          sheet: GANTT_SHEET,
          row: r,
        });
        continue;
      }

      const phaseTitle = normalizeText(
        String(this.mergedValue(ws, r, COL.phase) ?? ''),
      );
      const break1Val = this.mergedValue(ws, r, COL.break1);
      const break1Title = normalizeCellString(break1Val);

      rows.push({
        rowNumber: r,
        phaseMasterRow: this.masterRow(ws.getCell(r, COL.phase)),
        phaseTitle,
        break1MasterRow: break1Title ? this.masterRow(ws.getCell(r, COL.break1)) : null,
        break1Title,
        rawTitle: rawTitleFull.replace(/\s+$/, ''),
        normalizedTitle,
        indent: countLeadingSpaces(rawTitleFull),
        startRaw: normalizeCellString(this.rawCell(ws.getCell(r, COL.start))),
        finishRaw: normalizeCellString(this.rawCell(ws.getCell(r, COL.finish))),
        budgetRaw: this.rawCell(ws.getCell(r, COL.budget)),
        ownerRaw: normalizeCellString(this.rawCell(ws.getCell(r, COL.owner))),
        dodRaw: normalizeCellString(this.rawCell(ws.getCell(r, COL.dod))),
        periodPlanStart: parseNumeric(this.rawCell(ws.getCell(r, COL.periodPlanStart))),
        periodPlanDuration: parseNumeric(this.rawCell(ws.getCell(r, COL.periodPlanDuration))),
        periodActualStart: parseNumeric(this.rawCell(ws.getCell(r, COL.periodActualStart))),
        periodActualDuration: parseNumeric(
          this.rawCell(ws.getCell(r, COL.periodActualDuration)),
        ),
        percent: parseNumeric(this.rawCell(ws.getCell(r, COL.percent))),
      });
    }
    return rows;
  }

  private buildRows(rawRows: RawRow[], issues: ImportIssue[]): ParsedWbsRow[] {
    // شماره‌گذاری فازها بر اساس ترتیب ظهور Merge Master.
    const phaseOrder = new Map<number, number>();
    for (const rr of rawRows) {
      if (!phaseOrder.has(rr.phaseMasterRow)) {
        phaseOrder.set(rr.phaseMasterRow, phaseOrder.size + 1);
      }
    }

    // شماره‌گذاری Break1 داخل هر فاز.
    const break1Order = new Map<string, number>();
    const break1CountPerPhase = new Map<number, number>();
    for (const rr of rawRows) {
      const phaseIdx = phaseOrder.get(rr.phaseMasterRow)!;
      if (rr.break1MasterRow !== null) {
        const key = `${phaseIdx}:${rr.break1MasterRow}`;
        if (!break1Order.has(key)) {
          const next = (break1CountPerPhase.get(phaseIdx) ?? 0) + 1;
          break1CountPerPhase.set(phaseIdx, next);
          break1Order.set(key, next);
        }
      }
    }

    // محاسبهٔ Outline Level به‌ازای هر گروه Break1 (بر اساس تورفتگی).
    const groups = new Map<string, RawRow[]>();
    for (const rr of rawRows) {
      const phaseIdx = phaseOrder.get(rr.phaseMasterRow)!;
      const key = `${phaseIdx}:${rr.break1MasterRow ?? 'none'}`;
      const arr = groups.get(key) ?? [];
      arr.push(rr);
      groups.set(key, arr);
    }
    const outlineByRow = new Map<number, number>();
    for (const arr of groups.values()) {
      const levels = computeOutlineLevels(arr.map((x) => x.indent));
      arr.forEach((rr, i) => outlineByRow.set(rr.rowNumber, levels[i]!));
    }

    const result: ParsedWbsRow[] = [];
    for (const rr of rawRows) {
      const phaseIdx = phaseOrder.get(rr.phaseMasterRow)!;
      const phaseCode = String(phaseIdx);
      const break1Idx =
        rr.break1MasterRow !== null
          ? break1Order.get(`${phaseIdx}:${rr.break1MasterRow}`)!
          : null;
      const break1Code = break1Idx !== null ? `${phaseIdx}-${break1Idx}` : null;

      const start = tryParseJalali(rr.startRaw);
      const finish = tryParseJalali(rr.finishRaw);
      if (rr.startRaw && !start.valid) {
        issues.push({
          level: ImportIssueLevel.WARNING,
          code: ImportIssueCode.INVALID_DATE,
          message: `تاریخ شروع نامعتبر در سطر ${rr.rowNumber}: ${rr.startRaw}`,
          sheet: GANTT_SHEET,
          row: rr.rowNumber,
          column: 'E',
          value: rr.startRaw,
        });
      }
      if (rr.finishRaw && !finish.valid) {
        issues.push({
          level: ImportIssueLevel.WARNING,
          code: ImportIssueCode.INVALID_DATE,
          message: `تاریخ پایان نامعتبر در سطر ${rr.rowNumber}: ${rr.finishRaw}`,
          sheet: GANTT_SHEET,
          row: rr.rowNumber,
          column: 'F',
          value: rr.finishRaw,
        });
      }
      if (start.valid && finish.valid && start.sortKey! > finish.sortKey!) {
        issues.push({
          level: ImportIssueLevel.CRITICAL,
          code: ImportIssueCode.START_AFTER_FINISH,
          message: `تاریخ شروع بعد از پایان در سطر ${rr.rowNumber}.`,
          sheet: GANTT_SHEET,
          row: rr.rowNumber,
        });
      }

      const budget = parseBudgetToman(rr.budgetRaw);

      result.push({
        sourceRow: rr.rowNumber,
        phaseCode,
        phaseTitle: rr.phaseTitle,
        break1Code,
        break1Title: rr.break1Title,
        rawTitle: rr.rawTitle,
        normalizedTitle: rr.normalizedTitle,
        indent: rr.indent,
        outlineLevel: outlineByRow.get(rr.rowNumber) ?? 0,
        plannedStartJalali: start.normalized,
        plannedFinishJalali: finish.normalized,
        startProvided: rr.startRaw !== null,
        finishProvided: rr.finishRaw !== null,
        plannedStartValid: start.valid,
        plannedFinishValid: finish.valid,
        budgetAmount: budget,
        ownerText: rr.ownerRaw,
        definitionOfDone: rr.dodRaw,
        periodPlanStart: rr.periodPlanStart,
        periodPlanDuration: rr.periodPlanDuration,
        periodActualStart: rr.periodActualStart,
        periodActualDuration: rr.periodActualDuration,
        percentComplete: rr.percent,
      });
    }
    return result;
  }

  private buildManifest(
    rows: ParsedWbsRow[],
    periodCount: number,
    totalDays: number | null,
    totalMonths: number | null,
  ): ExcelManifest {
    const phases = new Set<string>();
    const break1s = new Set<string>();
    const perPhaseMap = new Map<string, number>();
    let budgetRowCount = 0;
    let budgetTotal = 0;
    let ownerCount = 0;
    let dodCount = 0;
    let progressCount = 0;
    let startNonEmpty = 0;
    let startValid = 0;
    let finishNonEmpty = 0;
    let finishValid = 0;
    let dateMinKey: number | null = null;
    let dateMaxKey: number | null = null;
    let dateMin: string | null = null;
    let dateMax: string | null = null;

    for (const row of rows) {
      phases.add(row.phaseCode);
      perPhaseMap.set(row.phaseCode, (perPhaseMap.get(row.phaseCode) ?? 0) + 1);
      if (row.break1Code) break1s.add(row.break1Code);

      if (row.budgetAmount !== null) {
        budgetRowCount += 1;
        budgetTotal += row.budgetAmount;
      }
      if (row.ownerText) ownerCount += 1;
      if (row.definitionOfDone) dodCount += 1;
      if (row.percentComplete !== null) progressCount += 1;

      if (row.startProvided) startNonEmpty += 1;
      if (row.finishProvided) finishNonEmpty += 1;

      if (row.plannedStartValid) {
        startValid += 1;
        const key = jalaliKey(row.plannedStartJalali);
        if (key !== null && (dateMinKey === null || key < dateMinKey)) {
          dateMinKey = key;
          dateMin = row.plannedStartJalali;
        }
      }
      if (row.plannedFinishValid) {
        finishValid += 1;
        const key = jalaliKey(row.plannedFinishJalali);
        if (key !== null && (dateMaxKey === null || key > dateMaxKey)) {
          dateMaxKey = key;
          dateMax = row.plannedFinishJalali;
        }
      }
    }

    return {
      phaseCount: phases.size,
      break1Count: break1s.size,
      sourceRowCount: rows.length,
      perPhaseCounts: [...phases]
        .sort((a, b) => Number(a) - Number(b))
        .map((p) => perPhaseMap.get(p) ?? 0),
      periodCount,
      totalDays,
      totalMonths,
      budgetRowCount,
      budgetTotal,
      ownerCount,
      dodCount,
      progressCount,
      startNonEmpty,
      startValid,
      finishNonEmpty,
      finishValid,
      dateMin,
      dateMax,
    };
  }

  private emitDataQualityIssues(rows: ParsedWbsRow[], issues: ImportIssue[]): void {
    const seen = new Map<string, number>();
    for (const row of rows) {
      const key = `${row.phaseCode}|${row.break1Code ?? ''}|${row.normalizedTitle}`;
      if (seen.has(key)) {
        issues.push({
          level: ImportIssueLevel.WARNING,
          code: ImportIssueCode.DUPLICATE_TITLE,
          message: `عنوان تکراری در سطر ${row.sourceRow}: ${row.normalizedTitle}`,
          sheet: GANTT_SHEET,
          row: row.sourceRow,
        });
      } else {
        seen.set(key, row.sourceRow);
      }
    }
  }
}

function jalaliKey(normalized: string | null): number | null {
  if (!normalized) return null;
  const parts = normalized.split('/');
  if (parts.length !== 3) return null;
  return Number(parts[0]) * 10000 + Number(parts[1]) * 100 + Number(parts[2]);
}
