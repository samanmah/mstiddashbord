import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  EMPTY_PLACEHOLDER,
  dateToJalaliString,
  formatNumber,
  toPersianDigits,
} from '@ppm/contracts';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** نمایش عدد با جداکننده هزارگان و ارقام فارسی. */
export function faNumber(value: number | null | undefined, fractionDigits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return EMPTY_PLACEHOLDER;
  }
  return toPersianDigits(formatNumber(value, fractionDigits));
}

/** نمایش درصد با علامت ٪ و ارقام فارسی. */
export function faPercent(value: number | null | undefined, fractionDigits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return EMPTY_PLACEHOLDER;
  }
  const rounded = Number.isInteger(value) ? value : Number(value.toFixed(fractionDigits));
  return `${toPersianDigits(formatNumber(rounded, Number.isInteger(rounded) ? 0 : fractionDigits))}٪`;
}

/** تبدیل رشته تاریخ ISO میلادی به رشته جلالی با ارقام فارسی. */
export function isoToJalaliFa(iso: string | null | undefined): string {
  if (!iso) return EMPTY_PLACEHOLDER;
  try {
    const jalali = dateToJalaliString(new Date(iso));
    return toPersianDigits(jalali);
  } catch {
    return EMPTY_PLACEHOLDER;
  }
}

/** تبدیل رشته تاریخ ISO میلادی به رشته جلالی لاتین (برای فرم‌ها). */
export function isoToJalaliInput(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return dateToJalaliString(new Date(iso));
  } catch {
    return '';
  }
}

/** نمایش مقدار متنی یا جایگزین خالی. */
export function orDash(value: string | null | undefined): string {
  if (value === null || value === undefined || value.trim() === '') {
    return EMPTY_PLACEHOLDER;
  }
  return value;
}
