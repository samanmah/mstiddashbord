/**
 * ابزارهای خالص (Pure) تجزیهٔ اکسل گانت — مستقل از ExcelJS و Nest برای تست‌پذیری.
 */
import { isValidJalaliDate, normalizeText, toLatinDigits } from '@ppm/contracts';

/** شمارش فاصله‌های ابتدایی متن خام ستون D (تشخیص تورفتگی/Outline). */
export function countLeadingSpaces(raw: string): number {
  const match = raw.match(/^[ \t\u00a0]*/);
  if (!match) return 0;
  // Tab و NBSP معادل یک فاصله شمرده می‌شوند.
  return match[0].replace(/\t/g, ' ').replace(/\u00a0/g, ' ').length;
}

/**
 * محاسبهٔ سطح Outline (0-based) از روی توالی تورفتگی‌ها با الگوریتم Stack.
 * تورفتگی بزرگ‌تر = عمیق‌تر. مستقل از مقدار مطلق تورفتگی (۰/۱/۳/۶ ...).
 */
export function computeOutlineLevels(indents: number[]): number[] {
  const levels: number[] = [];
  const stack: number[] = []; // مقادیر تورفتگی نیاکان
  for (const indent of indents) {
    while (stack.length > 0 && stack[stack.length - 1]! >= indent) {
      stack.pop();
    }
    levels.push(stack.length);
    stack.push(indent);
  }
  return levels;
}

/**
 * Normalize برچسب ردیف جمع برای تطبیق Anchored (نه substring داخل عنوان فعالیت).
 */
export function normalizeTotalsLabel(raw: string): string {
  return normalizeText(toLatinDigits(raw))
    .replace(/[.:،,;؛!؟?]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const TOTALS_FA = /^(جمع|مجموع)(\s+(کل|ماه|روز|دوره))?$/;
const TOTALS_EN = /^(grand\s+total|total)$/i;

/**
 * آیا برچسب دقیقاً یک Totals Row است؟
 * «روز»/«ماه» فقط به‌صورت Exact (نه includes داخل عنوان Break/Activity).
 */
export function isTotalsLabel(raw: string | null | undefined): boolean {
  if (raw === null || raw === undefined) return false;
  const label = normalizeTotalsLabel(String(raw));
  if (label.length === 0) return false;
  if (TOTALS_FA.test(label)) return true;
  if (TOTALS_EN.test(label)) return true;
  // برچسب‌های کوتاه جمع روز/ماه در انتهای Workbook (anchored exact).
  if (label === 'روز' || label === 'ماه') return true;
  return false;
}

/** برچسب‌های قوی جمع (همیشه Totals، حتی اگر ستون‌های دیگر پر باشند). */
export function isStrongTotalsLabel(raw: string | null | undefined): boolean {
  if (raw === null || raw === undefined) return false;
  const label = normalizeTotalsLabel(String(raw));
  if (TOTALS_FA.test(label)) return true;
  if (TOTALS_EN.test(label)) return true;
  return false;
}

/**
 * تجزیهٔ مبلغ بودجه از متن فارسی «۸۷۵٬۰۰۰٬۰۰۰ تومان».
 * صفر معتبر است و حفظ می‌شود؛ فقط مقادیر منفی یا بدون رقم → null.
 */
export function parseBudgetToman(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw < 0) return null;
    return Math.round(raw);
  }
  let text = toLatinDigits(String(raw));
  // حذف واحدهای پولی رایج و کاراکترهای جداکننده.
  text = text
    .replace(/تومان|ريال|ریال|rial|toman/gi, '')
    .replace(/[,٬،\s]/g, '')
    .replace(/[^0-9.]/g, '')
    .trim();
  if (text.length === 0) return null;
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

export type PercentScaleKind = 'fraction' | 'percent' | 'mixed' | 'empty';

export interface PercentScaleResult {
  values: Array<number | null>;
  scale: PercentScaleKind;
}

/**
 * نرمال‌سازی مقیاس Percent در سطح ستون:
 * - همه در [0,1] → ×100 (صفر می‌ماند صفر)
 * - همه در [0,100] با حداقل یک مقدار >1 → بدون تغییر
 * - مخلوط (مثلاً 0.5 و 75) → بدون حدس مقیاس
 */
export function detectAndScalePercents(values: Array<number | null>): PercentScaleResult {
  const present = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (present.length === 0) {
    return { values: [...values], scale: 'empty' };
  }

  const hasFractionExclusive = present.some((v) => v > 0 && v < 1);
  const hasAboveOne = present.some((v) => v > 1);
  if (hasFractionExclusive && hasAboveOne) {
    return { values: [...values], scale: 'mixed' };
  }

  const allInUnitInterval = present.every((v) => v >= 0 && v <= 1);
  if (allInUnitInterval) {
    return {
      values: values.map((v) => (v === null || !Number.isFinite(v) ? null : v * 100)),
      scale: 'fraction',
    };
  }

  const allInPercent = present.every((v) => v >= 0 && v <= 100);
  if (allInPercent) {
    return { values: [...values], scale: 'percent' };
  }

  return { values: [...values], scale: 'mixed' };
}

/** کلید مرتب‌سازی/مقایسهٔ تاریخ جلالی «YYYY/MM/DD». */
export function jalaliSortKey(jy: number, jm: number, jd: number): number {
  return jy * 10000 + jm * 100 + jd;
}

export interface ParsedJalali {
  valid: boolean;
  normalized: string | null; // «YYYY/MM/DD» با ارقام لاتین
  sortKey: number | null;
}

/**
 * اعتبارسنجی و Normalize رشتهٔ تاریخ جلالی بدون پرتاب استثنا.
 * فرمت‌های «YYYY/MM/DD» و «YYYY-MM-DD» با ارقام فارسی/عربی پشتیبانی می‌شوند.
 */
export function tryParseJalali(input: string | null): ParsedJalali {
  if (!input) return { valid: false, normalized: null, sortKey: null };
  const parts = toLatinDigits(input.trim()).replace(/-/g, '/').split('/');
  if (parts.length !== 3) return { valid: false, normalized: null, sortKey: null };
  const jy = Number(parts[0]);
  const jm = Number(parts[1]);
  const jd = Number(parts[2]);
  if (!isValidJalaliDate(jy, jm, jd)) {
    return { valid: false, normalized: null, sortKey: null };
  }
  const mm = String(jm).padStart(2, '0');
  const dd = String(jd).padStart(2, '0');
  return {
    valid: true,
    normalized: `${jy}/${mm}/${dd}`,
    sortKey: jalaliSortKey(jy, jm, jd),
  };
}

/** تقسیم متن مسئولین چندنفره با «،/,/-/؛/\n». */
export function splitOwners(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(/[،,؛;\n/]|\s-\s/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
