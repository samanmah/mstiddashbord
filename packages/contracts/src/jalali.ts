/**
 * تبدیل و اعتبارسنجی تقویم جلالی (شمسی) ↔ میلادی.
 * هستهٔ تبدیل بر پایهٔ کتابخانهٔ آزمون‌شدهٔ `jalaali-js` است و مستقل از Locale سیستم‌عامل عمل می‌کند.
 */
import jalaali from 'jalaali-js';
import { toLatinDigits } from './normalize';

export interface JalaliDate {
  jy: number;
  jm: number;
  jd: number;
}

export interface GregorianDate {
  gy: number;
  gm: number;
  gd: number;
}

export const JALALI_MONTH_NAMES: readonly string[] = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];

/** آیا سال جلالی کبیسه است؟ */
export function isLeapJalaliYear(jy: number): boolean {
  return jalaali.isLeapJalaaliYear(jy);
}

/** تعداد روزهای یک ماه جلالی. */
export function jalaliMonthLength(jy: number, jm: number): number {
  if (jm < 1 || jm > 12) throw new RangeError(`ماه جلالی نامعتبر است: ${jm}`);
  return jalaali.jalaaliMonthLength(jy, jm);
}

/** تبدیل تاریخ جلالی به میلادی. */
export function jalaliToGregorian(jy: number, jm: number, jd: number): GregorianDate {
  return jalaali.toGregorian(jy, jm, jd);
}

/** تبدیل تاریخ میلادی به جلالی. */
export function gregorianToJalali(gy: number, gm: number, gd: number): JalaliDate {
  return jalaali.toJalaali(gy, gm, gd);
}

/** اعتبارسنجی تاریخ جلالی. */
export function isValidJalaliDate(jy: number, jm: number, jd: number): boolean {
  if (!Number.isInteger(jy) || !Number.isInteger(jm) || !Number.isInteger(jd)) return false;
  return jalaali.isValidJalaaliDate(jy, jm, jd);
}

/**
 * تبدیل رشته تاریخ جلالی (YYYY/MM/DD) به شیء Date میلادی.
 * ساعت روی ۱۲ ظهر UTC تنظیم می‌شود تا خطای Timezone رخ ندهد.
 */
export function jalaliStringToDate(input: string): Date {
  const parts = toLatinDigits(input.trim()).replace(/-/g, '/').split('/');
  if (parts.length !== 3) {
    throw new RangeError(`فرمت تاریخ جلالی نامعتبر است: ${input}`);
  }
  const jy = Number(parts[0]);
  const jm = Number(parts[1]);
  const jd = Number(parts[2]);
  if (!isValidJalaliDate(jy, jm, jd)) {
    throw new RangeError(`تاریخ جلالی نامعتبر است: ${input}`);
  }
  const g = jalaliToGregorian(jy, jm, jd);
  return new Date(Date.UTC(g.gy, g.gm - 1, g.gd, 12, 0, 0));
}

/** تبدیل Date میلادی به رشته جلالی YYYY/MM/DD. */
export function dateToJalaliString(date: Date): string {
  const j = gregorianToJalali(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
  );
  const mm = String(j.jm).padStart(2, '0');
  const dd = String(j.jd).padStart(2, '0');
  return `${j.jy}/${mm}/${dd}`;
}

/** تبدیل Date به {jy,jm,jd}. */
export function dateToJalali(date: Date): JalaliDate {
  return gregorianToJalali(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
  );
}

/** نام ماه جلالی (۱..۱۲). */
export function jalaliMonthName(jm: number): string {
  const name = JALALI_MONTH_NAMES[jm - 1];
  if (!name) throw new RangeError(`شماره ماه جلالی نامعتبر است: ${jm}`);
  return name;
}

/** شماره ماه از روی نام (۱..۱۲) یا null. */
export function jalaliMonthNumberFromName(name: string): number | null {
  const idx = JALALI_MONTH_NAMES.indexOf(name.trim());
  return idx === -1 ? null : idx + 1;
}

/**
 * Parse برچسب ماه به‌شکل «نام‌ماه (سال)» مثل «تیر (1405)».
 */
export function parseMonthLabel(
  label: string,
): { jalaliYear: number; jalaliMonth: number; monthLabel: string } | null {
  const cleaned = toLatinDigits(label.trim());
  const match = cleaned.match(/^(.+?)\s*\(\s*(\d{3,4})\s*\)\s*$/);
  if (!match) return null;
  const monthName = match[1]!.trim();
  const year = Number(match[2]);
  const monthNumber = jalaliMonthNumberFromName(monthName);
  if (monthNumber === null || !Number.isFinite(year)) return null;
  return {
    jalaliYear: year,
    jalaliMonth: monthNumber,
    monthLabel: `${monthName} (${year})`,
  };
}

/** مقدار sortOrder پایدار برای مرتب‌سازی دوره‌های ماهانه. */
export function monthSortKey(jalaliYear: number, jalaliMonth: number): number {
  return jalaliYear * 12 + (jalaliMonth - 1);
}
