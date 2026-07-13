/** ابزارهای استانداردسازی متن و اعداد فارسی/عربی. */

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** تبدیل اعداد فارسی و عربی به لاتین. */
export function toLatinDigits(input: string): string {
  let out = '';
  for (const ch of input) {
    const pIdx = PERSIAN_DIGITS.indexOf(ch);
    if (pIdx !== -1) {
      out += String(pIdx);
      continue;
    }
    const aIdx = ARABIC_DIGITS.indexOf(ch);
    if (aIdx !== -1) {
      out += String(aIdx);
      continue;
    }
    out += ch;
  }
  return out;
}

/** تبدیل اعداد لاتین به فارسی (برای نمایش). */
export function toPersianDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => PERSIAN_DIGITS[Number(d)]!);
}

/**
 * Normalize کامل متن:
 * - حذف Zero-Width و کاراکترهای کنترلی جهت
 * - یکسان‌سازی «ي/ی» و «ك/ک» عربی→فارسی
 * - فشرده‌سازی فاصله‌ها و trim
 */
export function normalizeText(input: string): string {
  return input
    .replace(/\u200b|\u200c|\u200d|\u200e|\u200f|\ufeff/g, ' ')
    .replace(/\u064a/g, '\u06cc') // ي → ی
    .replace(/\u0643/g, '\u06a9') // ك → ک
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normalize برای مقایسه کلید/عنوان (بدون فاصله‌های اضافی، اعداد لاتین). */
export function normalizeKey(input: string): string {
  return toLatinDigits(normalizeText(input)).toLowerCase();
}

/** Normalize نام کاربری برای یکتایی (lowercase + trim + latin digits). */
export function normalizeUsername(input: string): string {
  return toLatinDigits(input.trim().toLowerCase());
}

const NULL_TOKENS = new Set(['', '-', '—', 'none', 'null', 'nan', 'n/a', 'na']);

/** تبدیل مقدار خام سلول به رشته یا null. */
export function normalizeCellString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = normalizeText(String(value));
  if (NULL_TOKENS.has(text.toLowerCase())) return null;
  return text.length === 0 ? null : text;
}

/**
 * Parse عدد از مقدار خام سلول (اعداد فارسی/عربی، %، جداکننده هزارگان).
 * برمی‌گرداند number یا null.
 */
export function parseNumeric(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  let text = normalizeText(String(value));
  if (NULL_TOKENS.has(text.toLowerCase())) return null;
  text = toLatinDigits(text)
    .replace(/[%٪]/g, '')
    .replace(/,/g, '')
    .replace(/\s/g, '')
    .trim();
  if (text.length === 0) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

/** Parse درصد در بازه ۰..۱۰۰؛ خارج از بازه clamp نمی‌شود اما null-safe است. */
export function parsePercent(value: unknown): number | null {
  return parseNumeric(value);
}

/** نمایش عدد با جداکننده هزارگان (اعداد لاتین). */
export function formatNumber(value: number, fractionDigits = 0): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

/**
 * محافظت در برابر Formula Injection هنگام Export به Excel.
 * سلول‌هایی که با = + - @ یا tab/CR شروع می‌شوند، با آپاستروف پیشوند می‌گیرند.
 */
export function sanitizeForSpreadsheet(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) {
    return `'${text}`;
  }
  return text;
}
