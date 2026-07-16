/**
 * ابزارهای خالص (Pure) تجزیهٔ اکسل گانت — مستقل از ExcelJS و Nest برای تست‌پذیری.
 */
import { isValidJalaliDate, toLatinDigits } from '@ppm/contracts';

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
 * تجزیهٔ مبلغ بودجه از متن فارسی «۸۷۵٬۰۰۰٬۰۰۰ تومان».
 * جداکنندهٔ هزار، پسوند واحد و ارقام فارسی/عربی حذف می‌شوند.
 * برمی‌گرداند عدد تومان یا null اگر رقمی وجود نداشته باشد.
 */
export function parseBudgetToman(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  let text = toLatinDigits(String(raw));
  // حذف واحدهای پولی رایج و کاراکترهای جداکننده.
  text = text
    .replace(/تومان|ريال|ریال|rial|toman/gi, '')
    .replace(/[,٬،\s]/g, '')
    .replace(/[^0-9.]/g, '')
    .trim();
  if (text.length === 0) return null;
  const n = Number(text);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
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
