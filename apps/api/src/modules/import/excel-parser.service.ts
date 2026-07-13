import { Injectable } from '@nestjs/common';
import {
  type ApiErrorDetail,
  DecisionStatus,
  jalaliStringToDate,
  normalizeCellString,
  normalizeKey,
  normalizeText,
  parseMonthLabel,
  parseNumeric,
  Probability,
  RiskLevel,
} from '@ppm/contracts';
import ExcelJS from 'exceljs';

export interface ParsedProject {
  titleFa: string;
  titleEn: string | null;
  projectCode: string | null;
  projectManager: string;
  projectType: string;
  budgetBillionRial: number;
  description: string;
  startDate: string;
  plannedEndDate: string;
  reportDate: string;
  indicatorTitle: string;
  indicatorPlanned: number;
  indicatorActual: number;
}

export interface ParsedMonth {
  jalaliYear: number;
  jalaliMonth: number;
  monthLabel: string;
  plannedPercent: number;
  actualPercent: number | null;
}

export interface ParsedActivity {
  rowNumber: number;
  title: string;
  weightPercent: number;
  startDate: string;
  endDate: string;
  plannedPercent: number;
  actualPercent: number;
}

export interface ParsedRisk {
  rowNumber: number;
  title: string;
  probability: Probability;
  riskLevel: RiskLevel;
  mitigationAction: string;
  owner: string;
}

export interface ParsedDecision {
  rowNumber: number;
  subject: string | null;
  description: string | null;
  owner: string | null;
  dueDate: string | null;
  status: DecisionStatus;
}

export interface ParsedWorkbook {
  project: ParsedProject;
  months: ParsedMonth[];
  activities: ParsedActivity[];
  risks: ParsedRisk[];
  decisions: ParsedDecision[];
  errors: ApiErrorDetail[];
}

const SHEET_NAMES = {
  project: 'اطلاعات پروژه',
  monthly: 'پیشرفت ماهیانه',
  activities: 'فعالیت ها',
  risks: 'ریسک ها',
  decisions: 'تصمیمات',
};

const PROBABILITY_MAP: Record<string, Probability> = {
  پایین: Probability.LOW,
  کم: Probability.LOW,
  متوسط: Probability.MEDIUM,
  بالا: Probability.HIGH,
  زیاد: Probability.HIGH,
};

const RISK_LEVEL_MAP: Record<string, RiskLevel> = {
  پایین: RiskLevel.LOW,
  کم: RiskLevel.LOW,
  متوسط: RiskLevel.MEDIUM,
  بالا: RiskLevel.HIGH,
  زیاد: RiskLevel.HIGH,
};

const DECISION_STATUS_MAP: Record<string, DecisionStatus> = {
  جدید: DecisionStatus.NEW,
  'در حال اجرا': DecisionStatus.IN_PROGRESS,
  'در انتظار گزارش': DecisionStatus.WAITING_FOR_REPORT,
  'انجام شد': DecisionStatus.DONE,
  سایر: DecisionStatus.OTHER,
};

/** نگاشت متن فارسی احتمال به Enum انگلیسی (پیش‌فرض MEDIUM). */
export function mapProbability(value: string | null): Probability {
  return (value && PROBABILITY_MAP[value]) || Probability.MEDIUM;
}

/** نگاشت متن فارسی سطح ریسک به Enum انگلیسی (پیش‌فرض MEDIUM). */
export function mapRiskLevel(value: string | null): RiskLevel {
  return (value && RISK_LEVEL_MAP[value]) || RiskLevel.MEDIUM;
}

/** نگاشت متن فارسی وضعیت تصمیم به Enum انگلیسی (پیش‌فرض NEW). */
export function mapDecisionStatus(value: string | null): DecisionStatus {
  return (value && DECISION_STATUS_MAP[value]) || DecisionStatus.NEW;
}

@Injectable()
export class ExcelParserService {
  /** خواندن مقدار خام یک سلول (با مدیریت فرمول، RichText و لینک). */
  private cellValue(cell: ExcelJS.Cell): unknown {
    const v = cell.value;
    if (v === null || v === undefined) return null;
    if (v instanceof Date) return v;
    if (typeof v === 'object') {
      const obj = v as unknown as Record<string, unknown>;
      if ('result' in obj) return obj.result; // فرمول: مقدار Cache شده
      if ('richText' in obj && Array.isArray(obj.richText)) {
        return (obj.richText as Array<{ text: string }>).map((r) => r.text).join('');
      }
      if ('text' in obj) return obj.text;
      if (v instanceof Date) return v;
    }
    return v;
  }

  private findSheet(
    wb: ExcelJS.Workbook,
    target: string,
  ): ExcelJS.Worksheet | null {
    const normTarget = normalizeKey(target);
    for (const ws of wb.worksheets) {
      if (normalizeKey(ws.name) === normTarget) return ws;
    }
    return null;
  }

  /** یافتن سطر سربرگ و نگاشت عنوان ستون‌ها به شماره ستون. */
  private detectHeader(
    ws: ExcelJS.Worksheet,
    expected: string[],
    maxScanRows = 8,
  ): { headerRow: number; columns: Record<string, number> } | null {
    const normExpected = expected.map(normalizeKey);
    const threshold = Math.ceil(expected.length / 2);
    let best: { headerRow: number; columns: Record<string, number>; count: number } | null =
      null;

    for (let r = 1; r <= Math.min(ws.rowCount, maxScanRows); r += 1) {
      const row = ws.getRow(r);
      const columns: Record<string, number> = {};
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const text = normalizeCellString(this.cellValue(cell));
        if (!text) return;
        const norm = normalizeKey(text);
        // فقط تطبیق دقیق پذیرفته می‌شود تا سطر عنوان (مثل «وضعیت پیشرفت فعالیت‌ها»)
        // به‌اشتباه به‌عنوان سربرگ شناسایی نشود.
        const idx = normExpected.indexOf(norm);
        if (idx !== -1 && columns[expected[idx]!] === undefined) {
          columns[expected[idx]!] = colNumber;
        }
      });
      const count = Object.keys(columns).length;
      // بهترین سطر بر اساس بیشترین تعداد ستون منحصربه‌فرد انتخاب می‌شود.
      if (count >= threshold && (!best || count > best.count)) {
        best = { headerRow: r, columns, count };
      }
    }
    return best ? { headerRow: best.headerRow, columns: best.columns } : null;
  }

  parse(buffer: Buffer): Promise<ParsedWorkbook> {
    return this.parseAsync(buffer);
  }

  private async parseAsync(buffer: Buffer): Promise<ParsedWorkbook> {
    const errors: ApiErrorDetail[] = [];
    const wb = new ExcelJS.Workbook();
    try {
      // فقط ساختار XLSX خوانده می‌شود؛ ماکروهای VBA اجرا نمی‌شوند.
      await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    } catch {
      throw new Error('فایل Excel قابل خواندن نیست یا خراب است.');
    }

    const project = this.parseProject(wb, errors);
    const months = this.parseMonths(wb, errors);
    const activities = this.parseActivities(wb, errors);
    const risks = this.parseRisks(wb, errors);
    const decisions = this.parseDecisions(wb, errors);

    return { project, months, activities, risks, decisions, errors };
  }

  private parseProject(wb: ExcelJS.Workbook, errors: ApiErrorDetail[]): ParsedProject {
    const ws = this.findSheet(wb, SHEET_NAMES.project);
    const kv = new Map<string, unknown>();
    if (!ws) {
      errors.push({ sheet: SHEET_NAMES.project, message: 'شیت «اطلاعات پروژه» یافت نشد.' });
    } else {
      for (let r = 1; r <= ws.rowCount; r += 1) {
        const key = normalizeCellString(this.cellValue(ws.getCell(r, 1)));
        if (!key) continue;
        const value = this.cellValue(ws.getCell(r, 2));
        kv.set(normalizeKey(key), value);
      }
    }

    const get = (...keys: string[]): unknown => {
      for (const k of keys) {
        const nk = normalizeKey(k);
        if (kv.has(nk)) return kv.get(nk);
      }
      return null;
    };

    const rawName = normalizeCellString(get('نام پروژه')) ?? '';
    const nameLines = String(this.cellValue2(get('نام پروژه')) ?? rawName)
      .split(/\r?\n/)
      .map((s) => normalizeText(s))
      .filter(Boolean);
    const titleFa = nameLines[0] ?? rawName;
    const titleEn = nameLines.length > 1 ? nameLines.slice(1).join(' ') : null;

    const parseDate = (value: unknown, label: string): string => {
      const str = normalizeCellString(value);
      if (!str) {
        errors.push({ sheet: SHEET_NAMES.project, message: `${label} خالی است.` });
        return '';
      }
      try {
        jalaliStringToDate(str);
        return str;
      } catch {
        errors.push({ sheet: SHEET_NAMES.project, message: `${label} تاریخ جلالی معتبری نیست: ${str}` });
        return '';
      }
    };

    return {
      titleFa,
      titleEn,
      projectCode: normalizeCellString(get('کد پروژه')),
      projectManager: normalizeCellString(get('مسئول پروژه')) ?? '',
      projectType: normalizeCellString(get('نوع پروژه')) ?? '',
      budgetBillionRial: parseNumeric(get('بودجه مصوب (میلیارد ریال)', 'بودجه مصوب')) ?? 0,
      description: normalizeCellString(get('شرح پروژه')) ?? '',
      startDate: parseDate(get('تاریخ شروع'), 'تاریخ شروع'),
      plannedEndDate: parseDate(get('تاریخ پایان برنامه ای', 'تاریخ پایان'), 'تاریخ پایان برنامه‌ای'),
      reportDate: parseDate(get('آخرین به روزرسانی', 'تاریخ گزارش'), 'تاریخ گزارش'),
      indicatorTitle: normalizeCellString(get('نام شاخص اثربخشی')) ?? '',
      indicatorPlanned: parseNumeric(get('مقدار برنامه ای شاخص')) ?? 0,
      indicatorActual: parseNumeric(get('مقدار واقعی شاخص')) ?? 0,
    };
  }

  /** نسخهٔ خام رشته بدون Normalize چندخطی (برای تفکیک نام فارسی/انگلیسی). */
  private cellValue2(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    return String(value);
  }

  private parseMonths(wb: ExcelJS.Workbook, errors: ApiErrorDetail[]): ParsedMonth[] {
    const ws = this.findSheet(wb, SHEET_NAMES.monthly);
    if (!ws) {
      errors.push({ sheet: SHEET_NAMES.monthly, message: 'شیت «پیشرفت ماهیانه» یافت نشد.' });
      return [];
    }
    const header = this.detectHeader(ws, ['ماه', 'برنامه (%)', 'واقعی (%)', 'انحراف (%)']);
    if (!header) {
      errors.push({ sheet: SHEET_NAMES.monthly, message: 'سربرگ ستون‌ها یافت نشد.' });
      return [];
    }
    const months: ParsedMonth[] = [];
    for (let r = header.headerRow + 1; r <= ws.rowCount; r += 1) {
      const label = normalizeCellString(this.cellValue(ws.getCell(r, header.columns['ماه']!)));
      if (!label) continue;
      if (normalizeKey(label).startsWith('راهنما')) continue;
      const parsed = parseMonthLabel(label);
      if (!parsed) {
        errors.push({
          sheet: SHEET_NAMES.monthly,
          row: r,
          column: 'ماه',
          value: label,
          message: `برچسب ماه نامعتبر است: ${label}`,
        });
        continue;
      }
      const planned = parseNumeric(this.cellValue(ws.getCell(r, header.columns['برنامه (%)']!))) ?? 0;
      const actualCol = header.columns['واقعی (%)'];
      const actual = actualCol ? parseNumeric(this.cellValue(ws.getCell(r, actualCol))) : null;
      months.push({
        jalaliYear: parsed.jalaliYear,
        jalaliMonth: parsed.jalaliMonth,
        monthLabel: parsed.monthLabel,
        plannedPercent: planned,
        actualPercent: actual,
      });
    }
    return months;
  }

  private parseActivities(wb: ExcelJS.Workbook, errors: ApiErrorDetail[]): ParsedActivity[] {
    const ws = this.findSheet(wb, SHEET_NAMES.activities);
    if (!ws) {
      errors.push({ sheet: SHEET_NAMES.activities, message: 'شیت «فعالیت‌ها» یافت نشد.' });
      return [];
    }
    const header = this.detectHeader(ws, [
      'ردیف',
      'فعالیت',
      'وزن (%)',
      'تاریخ شروع',
      'تاریخ پایان',
      'پیشرفت برنامه ای(%)',
      'پیشرفت واقعی(%)',
      'وضعیت',
    ]);
    if (!header) {
      errors.push({ sheet: SHEET_NAMES.activities, message: 'سربرگ ستون‌ها یافت نشد.' });
      return [];
    }
    const activities: ParsedActivity[] = [];
    let auto = 0;
    for (let r = header.headerRow + 1; r <= ws.rowCount; r += 1) {
      const title = normalizeCellString(this.cellValue(ws.getCell(r, header.columns['فعالیت']!)));
      const rowNo = parseNumeric(this.cellValue(ws.getCell(r, header.columns['ردیف']!)));
      if (!title) continue; // سطر جمع/خالی
      if (normalizeKey(title).startsWith('راهنما') || normalizeKey(title).startsWith('جمع')) continue;

      auto += 1;
      const start = normalizeCellString(this.cellValue(ws.getCell(r, header.columns['تاریخ شروع']!)));
      const end = normalizeCellString(this.cellValue(ws.getCell(r, header.columns['تاریخ پایان']!)));
      const validDate = (value: string | null, col: string): string => {
        if (!value) {
          errors.push({ sheet: SHEET_NAMES.activities, row: r, column: col, message: `${col} خالی است.` });
          return '';
        }
        try {
          jalaliStringToDate(value);
          return value;
        } catch {
          errors.push({
            sheet: SHEET_NAMES.activities,
            row: r,
            column: col,
            value,
            message: `${col} تاریخ معتبری نیست: ${value}`,
          });
          return '';
        }
      };

      activities.push({
        rowNumber: rowNo ?? auto,
        title,
        weightPercent: parseNumeric(this.cellValue(ws.getCell(r, header.columns['وزن (%)']!))) ?? 0,
        startDate: validDate(start, 'تاریخ شروع'),
        endDate: validDate(end, 'تاریخ پایان'),
        plannedPercent:
          parseNumeric(this.cellValue(ws.getCell(r, header.columns['پیشرفت برنامه ای(%)']!))) ?? 0,
        actualPercent:
          parseNumeric(this.cellValue(ws.getCell(r, header.columns['پیشرفت واقعی(%)']!))) ?? 0,
      });
    }
    return activities;
  }

  private parseRisks(wb: ExcelJS.Workbook, errors: ApiErrorDetail[]): ParsedRisk[] {
    const ws = this.findSheet(wb, SHEET_NAMES.risks);
    if (!ws) {
      errors.push({ sheet: SHEET_NAMES.risks, message: 'شیت «ریسک‌ها» یافت نشد.' });
      return [];
    }
    const header = this.detectHeader(ws, [
      'ردیف',
      'ریسک / چالش',
      'احتمال',
      'سطح ریسک',
      'اقدام / برنامه مقابله',
      'مسئول',
    ]);
    if (!header) {
      errors.push({ sheet: SHEET_NAMES.risks, message: 'سربرگ ستون‌ها یافت نشد.' });
      return [];
    }
    const risks: ParsedRisk[] = [];
    let auto = 0;
    for (let r = header.headerRow + 1; r <= ws.rowCount; r += 1) {
      const title = normalizeCellString(this.cellValue(ws.getCell(r, header.columns['ریسک / چالش']!)));
      if (!title) continue;
      if (normalizeKey(title).startsWith('راهنما')) continue;
      auto += 1;
      const rowNo = parseNumeric(this.cellValue(ws.getCell(r, header.columns['ردیف']!)));
      const prob = normalizeCellString(this.cellValue(ws.getCell(r, header.columns['احتمال']!)));
      const level = normalizeCellString(this.cellValue(ws.getCell(r, header.columns['سطح ریسک']!)));
      risks.push({
        rowNumber: rowNo ?? auto,
        title,
        probability: mapProbability(prob),
        riskLevel: mapRiskLevel(level),
        mitigationAction:
          normalizeCellString(this.cellValue(ws.getCell(r, header.columns['اقدام / برنامه مقابله']!))) ??
          '',
        owner: normalizeCellString(this.cellValue(ws.getCell(r, header.columns['مسئول']!))) ?? '',
      });
    }
    return risks;
  }

  private parseDecisions(wb: ExcelJS.Workbook, errors: ApiErrorDetail[]): ParsedDecision[] {
    const ws = this.findSheet(wb, SHEET_NAMES.decisions);
    if (!ws) {
      errors.push({ sheet: SHEET_NAMES.decisions, message: 'شیت «تصمیمات» یافت نشد.' });
      return [];
    }
    const header = this.detectHeader(ws, [
      'ردیف',
      'موضوع دستور',
      'شرح دستور',
      'مسئول',
      'مهلت اجرا',
      'وضعیت',
    ]);
    if (!header) {
      errors.push({ sheet: SHEET_NAMES.decisions, message: 'سربرگ ستون‌ها یافت نشد.' });
      return [];
    }
    const decisions: ParsedDecision[] = [];
    let auto = 0;
    for (let r = header.headerRow + 1; r <= ws.rowCount; r += 1) {
      const rowNo = parseNumeric(this.cellValue(ws.getCell(r, header.columns['ردیف']!)));
      const status = normalizeCellString(this.cellValue(ws.getCell(r, header.columns['وضعیت']!)));
      const subject = normalizeCellString(this.cellValue(ws.getCell(r, header.columns['موضوع دستور']!)));
      // سطر معتبر: حداقل شماره ردیف یا وضعیت داشته باشد.
      if (rowNo === null && !status && !subject) continue;
      if (status && normalizeKey(status).startsWith('راهنما')) continue;
      auto += 1;
      const dueRaw = normalizeCellString(this.cellValue(ws.getCell(r, header.columns['مهلت اجرا']!)));
      let dueDate: string | null = null;
      if (dueRaw) {
        try {
          jalaliStringToDate(dueRaw);
          dueDate = dueRaw;
        } catch {
          dueDate = null;
        }
      }
      decisions.push({
        rowNumber: rowNo ?? auto,
        subject,
        description: normalizeCellString(this.cellValue(ws.getCell(r, header.columns['شرح دستور']!))),
        owner: normalizeCellString(this.cellValue(ws.getCell(r, header.columns['مسئول']!))),
        dueDate,
        status: mapDecisionStatus(status),
      });
    }
    return decisions;
  }
}
